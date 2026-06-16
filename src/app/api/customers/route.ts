import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerUpsertPayload = {
  name?: unknown;
  companyName?: unknown;
  contactPerson?: unknown;
  company?: unknown;
  phone?: unknown;
  primaryPhone?: unknown;
  phone2?: unknown;
  phone3?: unknown;
  city?: unknown;
  cityOrZilla?: unknown;
  industry?: unknown;
  address?: unknown;
  website?: unknown;
  note?: unknown;
  notes?: unknown;
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
  assignedToId?: unknown;
  totalLeads?: unknown;
  lastCommunication?: unknown;
  rawData?: unknown;
};

function trimText(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text || undefined;
}

function readRawString(row: Record<string, unknown>, keys: string[]) {
  const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").toLowerCase();
  const normalized = new Map<string, unknown>();
  for (const [rawKey, rawValue] of Object.entries(row)) {
    normalized.set(normalizeKey(rawKey), rawValue);
  }

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) return normalized;
    } else if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (typeof value === "string") {
      const normalizedValue = value.trim();
      if (normalizedValue) return normalizedValue;
    } else if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
}

function inferCityFromAddress(address?: string | null) {
  if (!address) return "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length) return parts[parts.length - 1];

  const dashed = address
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  if (dashed.length) return dashed[dashed.length - 1];

  return "";
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

function readTemplatePayload(payload: CustomerUpsertPayload, includeAll = false) {
  const raw: CustomerTemplateRaw = {};
  for (const [sourceKey, rawKey] of TEMPLATE_FIELD_MAP) {
    if (!includeAll && !hasPayloadKey(payload, sourceKey)) continue;

    const value = trimText(payload[sourceKey as keyof CustomerUpsertPayload]);
    raw[rawKey] = value ?? "";
  }

  return raw;
}

function mergeRawTemplate(rawData: unknown, payload: CustomerUpsertPayload, includeAll = false) {
  const base = (typeof rawData === "object" && rawData !== null && !Array.isArray(rawData)) ? rawData as Record<string, unknown> : {};
  const incoming = readTemplatePayload(payload, includeAll);
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    merged[key] = value;
  }

  return merged;
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as CustomerUpsertPayload;
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload: CustomerUpsertPayload = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        payload[key as keyof CustomerUpsertPayload] = value;
      }
    }
    return payload;
  }

  return {};
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { contactPerson: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const rows = await prisma.customerCompany.findMany({
      where,
      include: {
        assignedTo: { select: { name: true } },
        contacts: {
          orderBy: { createdAt: "asc" },
          take: 3,
          select: {
            email: true,
            whatsapp: true,
          },
        },
        phoneNumbers: {
          orderBy: { createdAt: "asc" },
          take: 3,
          select: {
            number: true,
            whatsapp: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: 500,
    }) as Array<{
      id: string;
      name: string;
      contactPerson: string | null;
      phone: string;
      phone2?: string | null;
      city?: string | null;
      industry: string;
      address: string | null;
      website: string | null;
      notes: string | null;
      totalLeads: number;
      lastCommunication: Date | null;
      assignedToId: string | null;
      rawData?: unknown;
      assignedTo: { name: string } | null;
      contacts: { email: string | null; whatsapp: string | null }[];
      phoneNumbers: { number: string; whatsapp: boolean }[];
    }>;

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => {
        const raw = (row.rawData && typeof row.rawData === "object" && !Array.isArray(row.rawData))
          ? row.rawData as Record<string, unknown>
          : {};
        const primaryEmail = row.contacts.find((item) => Boolean(item.email))?.email ?? null;
        const rawEmail = (raw["Primary Email"] ?? raw["Email"] ?? raw["Email 1"] ?? raw["primaryEmail"] ?? raw["primaryEmail "]) as
          | string
          | number
          | undefined;
        const rawPhone2 = readRawString(raw, ["Phone 2", "Phone2", "Phone 2_1", "Phone_2", "Second Phone"]);
        const rawCity = readRawString(raw, ["City / Zilla", "City/Zilla", "City", "Zilla"]);

        return {
          ...row,
          email: primaryEmail ?? (typeof rawEmail === "string" ? rawEmail.trim() : rawEmail?.toString() ?? null),
          phone: row.phone || row.phoneNumbers[0]?.number || "",
          whatsapp: row.phoneNumbers.find((item) => item.whatsapp)?.number ?? "",
          phone2: row.phone2 || rawPhone2 || "",
          cityOrZilla: row.city || rawCity || inferCityFromAddress(row.address) || "-",
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load customers.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const payload = await parsePayload(request);
    const template = readTemplatePayload(payload, true);
    const name = trimText(payload.companyName ?? payload.name) as string | undefined;
    const primaryPhone = trimText(payload.primaryPhone) ?? trimText(payload.phone);
    const rawData = mergeRawTemplate(payload.rawData, payload, true);
    const assignedToId = trimText(payload.assignedToId);
    const rawContactPerson = trimText(payload.contactPerson) ?? trimText(payload.contactPerson1Name) ?? "";
    const templateContactPerson = trimText(template["Contact Person 1 Name"]) ?? "";
    const templateIndustry = trimText(template["Industry"]) ?? undefined;
    const templateAddress = trimText(template["Address"]) ?? undefined;
    const templateWebsite = trimText(template["Website"]) ?? undefined;
    const templateNotes = trimText(template["Note"]) ?? undefined;

    if (!name) {
      return NextResponse.json({ success: false, message: "Company Name is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    const matches = await prisma.customerCompany.findMany({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (matches.length > 1) {
      return NextResponse.json({ success: false, message: "Multiple customers match this company name." }, { status: 409 });
    }

    const assignedTo = assignedToId
      ? await prisma.user.findFirst({
          where: { id: assignedToId, status: "ACTIVE" },
          select: { id: true },
        })
      : null;

    if (assignedToId && !assignedTo) {
      return NextResponse.json({ success: false, message: "Assigned marketer not found." }, { status: 400 });
    }

    const data = {
      name,
      contactPerson: rawContactPerson || templateContactPerson || undefined,
      phone: primaryPhone ?? "",
      industry: trimText(payload.industry) ?? templateIndustry ?? "General",
      address: templateAddress,
      website: templateWebsite,
      notes: templateNotes,
      totalLeads: normalizeToInt(payload.totalLeads, 0),
      lastCommunication: parseDate(payload.lastCommunication),
      rawData,
      ...(assignedTo ? { assignedTo: { connect: { id: assignedTo.id } } } : {}),
    };

    if (matches.length === 1) {
      const updated = await prisma.customerCompany.update({
        where: { id: matches[0].id },
        data: data as any,
      });

      return NextResponse.json({ success: true, action: "updated", customer: updated });
    }

    const created = await prisma.customerCompany.create({
      data: data as any,
    });

    return NextResponse.json({ success: true, action: "created", customer: created });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer save failed.",
      },
      { status: 500 },
    );
  }
}
