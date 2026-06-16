import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerPatchPayload = {
  companyName?: unknown;
  contactPerson?: unknown;
  phone?: unknown;
  industry?: unknown;
  assignedToId?: unknown;
  totalLeads?: unknown;
  lastCommunication?: unknown;
};

function trimText(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text || undefined;
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
    const existing = await prisma.customerCompany.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
    }

    const name = trimText(payload.companyName);
    const contactPerson = trimText(payload.contactPerson) ?? null;
    const phone = trimText(payload.phone) ?? existing.phone;
    const industry = trimText(payload.industry) ?? existing.industry;
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

    const customer = await prisma.customerCompany.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        contactPerson,
        phone,
        industry,
        totalLeads,
        lastCommunication,
        ...(assignedToPatch ? { assignedTo: assignedToPatch } : {}),
      },
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
