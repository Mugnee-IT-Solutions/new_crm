import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerPatchPayload = {
  companyName?: unknown;
  contactPerson?: unknown;
  name?: unknown;
  industry?: unknown;
  city?: unknown;
  cityOrZilla?: unknown;
  phone?: unknown;
  primaryPhone?: unknown;
  phone2?: unknown;
  phone3?: unknown;
  address?: unknown;
  website?: unknown;
  notes?: unknown;
  note?: unknown;
  assignedToId?: unknown;
  totalLeads?: unknown;
  lastCommunication?: unknown;
  sl?: unknown;
  email?: unknown;
  primaryEmail?: unknown;
  email2?: unknown;
  designation1?: unknown;
  department1?: unknown;
  cp1Phone1?: unknown;
  cp1Phone2?: unknown;
  cp1Email1?: unknown;
  cp1Email2?: unknown;
  contactPerson1Name?: unknown;
  designation2?: unknown;
  department2?: unknown;
  cp2Phone1?: unknown;
  cp2Phone2?: unknown;
  cp2Email1?: unknown;
  cp2Email2?: unknown;
  contactPerson2Name?: unknown;
  leadSource?: unknown;
  rawData?: unknown;
};

function trimText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseDate(value: unknown) {
  if (!value) return undefined;

  const text = trimText(value);
  if (!text) return undefined;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeToInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

type CustomerTemplateRaw = Record<string, string>;

const TEMPLATE_FIELD_MAP = [
  ["sl", "SL"],
  ["industry", "Industry"],
  ["companyName", "Company Name"],
  ["name", "Company Name"],
  ["cityOrZilla", "City/Zilla"],
  ["address", "Address"],
  ["primaryPhone", "Primary Phone"],
  ["phone", "Primary Phone"],
  ["phone2", "Phone 2"],
  ["phone3", "Phone 3"],
  ["primaryEmail", "Primary Email"],
  ["email", "Primary Email"],
  ["email2", "Email 2"],
  ["website", "Website"],
  ["note", "Note"],
  ["notes", "Note"],
  ["contactPerson1Name", "Contact Person 1 Name"],
  ["designation1", "Contact Person 1 Designation"],
  ["department1", "Contact Person 1 Department"],
  ["cp1Phone1", "Contact Person 1 Phone 1"],
  ["cp1Phone2", "Contact Person 1 Phone 2"],
  ["cp1Email1", "Contact Person 1 Email 1"],
  ["cp1Email2", "Contact Person 1 Email 2"],
  ["contactPerson2Name", "Contact Person 2 Name"],
  ["designation2", "Contact Person 2 Designation"],
  ["department2", "Contact Person 2 Department"],
  ["cp2Phone1", "Contact Person 2 Phone 1"],
  ["cp2Phone2", "Contact Person 2 Phone 2"],
  ["cp2Email1", "Contact Person 2 Email 1"],
  ["cp2Email2", "Contact Person 2 Email 2"],
  ["leadSource", "Lead Source"],
] as const;

function hasPayloadKey(payload: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function readTemplatePayload(payload: CustomerPatchPayload, includeAll = false) {
  const raw: CustomerTemplateRaw = {};
  for (const [sourceKey, rawKey] of TEMPLATE_FIELD_MAP) {
    if (!includeAll && !hasPayloadKey(payload, sourceKey)) continue;
    const value = trimText(payload[sourceKey as keyof CustomerPatchPayload]);
    raw[rawKey] = value ?? "";
  }
  return raw;
}

type CustomerRecord = {
  id: string;
  name: string;
  industry: string;
  contactPerson: string | null;
  phone: string;
  city?: string | null;
  phone2?: string | null;
  totalLeads: number;
  lastCommunication: Date | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  rawData?: unknown;
  [key: string]: unknown;
};

function mergeRawTemplate(rawData: unknown, payload: CustomerPatchPayload) {
  const base = (typeof rawData === "object" && rawData !== null && !Array.isArray(rawData)) ? rawData as Record<string, unknown> : {};
  const payloadRaw = (typeof payload.rawData === "object" && payload.rawData !== null && !Array.isArray(payload.rawData))
    ? payload.rawData as Record<string, unknown>
    : {};
  const incoming = readTemplatePayload(payload, false);
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    merged[key] = value;
  }
  return { ...merged, ...payloadRaw };
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as CustomerPatchPayload;
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload: CustomerPatchPayload = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        payload[key as keyof CustomerPatchPayload] = value;
      }
    }
    return payload;
  }

  return {};
}

function selectCustomerPayload(customer: {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string;
  industry: string;
  address: string | null;
  website: string | null;
  notes: string | null;
  rawData?: unknown;
  assignedTo: { id: string; name: string } | null;
  totalLeads: number;
  lastCommunication: Date | null;
  contacts: { id: string; name: string; designation: string | null; email: string | null; mobile: string | null; whatsapp: string | null; isPrimary: boolean }[];
  phoneNumbers: { id: string; number: string; label: string; whatsapp: boolean }[];
  leads: { id: string; title: string; status: string; createdAt: Date }[];
}) {
  return {
    id: customer.id,
    name: customer.name,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    industry: customer.industry,
    address: customer.address,
    website: customer.website,
    notes: customer.notes,
    rawData: (customer as { rawData?: unknown }).rawData,
    assignedTo: customer.assignedTo,
    totalLeads: customer.totalLeads,
    lastCommunication: customer.lastCommunication,
    contacts: customer.contacts,
    phoneNumbers: customer.phoneNumbers,
    leads: customer.leads.map((lead) => ({ id: lead.id, title: lead.title, status: lead.status, createdAt: lead.createdAt })),
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Customer id is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    const customer = await prisma.customerCompany.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        contacts: { orderBy: { createdAt: "asc" } },
        phoneNumbers: { orderBy: { createdAt: "asc" } },
        leads: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer: selectCustomerPayload(customer) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer not found.",
      },
      { status: 500 },
    );
  }
}

function normalizeLastAssigned(assignedToIdValue: unknown) {
  const value = trimText(assignedToIdValue);
  if (!value) return undefined;
  if (value.toLowerCase() === "null" || value.toLowerCase() === "none") return null;
  return value;
}

export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Customer id is required." }, { status: 400 });
    }

    const payload = await parsePayload(_);
    const prisma = getPrisma();
    const existing = (await prisma.customerCompany.findUnique({ where: { id } })) as CustomerRecord | null;
    if (!existing) {
      return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
    }

    const hasCompanyName = hasPayloadKey(payload, "companyName") || hasPayloadKey(payload, "name");
    const name = trimText(hasPayloadKey(payload, "companyName") ? payload.companyName : payload.name).trim();

    const hasContactPerson = hasPayloadKey(payload, "contactPerson") || hasPayloadKey(payload, "contactPerson1Name");
    const contactPerson = hasContactPerson
      ? (trimText(hasPayloadKey(payload, "contactPerson") ? payload.contactPerson : payload.contactPerson1Name) || "")
      : existing.contactPerson;

    const hasPrimaryPhone = hasPayloadKey(payload, "primaryPhone") || hasPayloadKey(payload, "phone");
    const hasCityOrZilla = hasPayloadKey(payload, "cityOrZilla") || hasPayloadKey(payload, "city");
    const hasIndustry = hasPayloadKey(payload, "industry");
    const hasAddress = hasPayloadKey(payload, "address");
    const hasWebsite = hasPayloadKey(payload, "website");
    const hasPhone2 = hasPayloadKey(payload, "phone2");
    const hasNote = hasPayloadKey(payload, "note") || hasPayloadKey(payload, "notes");
    const hasTotalLeads = hasPayloadKey(payload, "totalLeads");
    const hasLastCommunication = hasPayloadKey(payload, "lastCommunication");

    const phone = hasPrimaryPhone ? trimText(hasPayloadKey(payload, "primaryPhone") ? payload.primaryPhone : payload.phone) : existing.phone;
    const cityOrZilla = hasCityOrZilla
      ? trimText(hasPayloadKey(payload, "cityOrZilla") ? payload.cityOrZilla : payload.city)
      : (existing.city || "");
    const industry = hasIndustry ? trimText(payload.industry) : existing.industry;
    const address = hasAddress ? trimText(payload.address) : existing.address || "";
    const website = hasWebsite ? trimText(payload.website) : existing.website || "";
    const phone2 = hasPhone2 ? trimText(payload.phone2) : existing.phone2 || "";
    const notes = hasNote
      ? trimText(hasPayloadKey(payload, "note") ? payload.note : payload.notes)
      : existing.notes || "";
    const totalLeads = payload.totalLeads === undefined ? existing.totalLeads : normalizeToInt(payload.totalLeads, existing.totalLeads);
    const lastCommunication = payload.lastCommunication === undefined ? existing.lastCommunication : parseDate(payload.lastCommunication);
    const resolvedAssignedToId = normalizeLastAssigned(payload.assignedToId);

    const assignedToPatch = resolvedAssignedToId === null
      ? { disconnect: true }
      : resolvedAssignedToId
        ? (await prisma.user.findFirst({ where: { id: resolvedAssignedToId, status: "ACTIVE" }, select: { id: true } }))
          ? { connect: { id: resolvedAssignedToId } }
          : null
        : undefined;

    if (resolvedAssignedToId && !assignedToPatch) {
      return NextResponse.json({ success: false, message: "Assigned marketer not found." }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      ...(hasCompanyName ? { name: name || existing.name } : {}),
      contactPerson,
      phone: hasPrimaryPhone ? phone : existing.phone,
      industry: hasIndustry ? industry : existing.industry,
      city: hasCityOrZilla ? cityOrZilla : existing.city,
      address: hasAddress ? address : existing.address,
      website: hasWebsite ? website : existing.website,
      phone2: hasPhone2 ? phone2 : existing.phone2,
      notes: hasNote ? notes : existing.notes,
      totalLeads,
      lastCommunication,
      ...(assignedToPatch ? { assignedTo: assignedToPatch } : {}),
      rawData: mergeRawTemplate(existing.rawData, payload),
    };

    const customer = await prisma.customerCompany.update({
      where: { id },
      data: data as any,
    });

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer update failed.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Customer id is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    const existing = await prisma.customerCompany.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
    }

    await prisma.customerCompany.delete({ where: { id } });
    return NextResponse.json({ success: true, customerId: id });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer delete failed.",
      },
      { status: 500 },
    );
  }
}
