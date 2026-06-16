import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerUpsertPayload = {
  name?: unknown;
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

        return {
          ...row,
          email: primaryEmail ?? (typeof rawEmail === "string" ? rawEmail.trim() : rawEmail?.toString() ?? null),
          phone: row.phone || row.phoneNumbers[0]?.number || "",
          whatsapp: row.phoneNumbers.find((item) => item.whatsapp)?.number ?? "",
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
    const name = trimText(payload.companyName ?? payload.name) as string | undefined;
    const phone = trimText(payload.phone);
    const assignedToId = trimText(payload.assignedToId);

    if (!name) {
      return NextResponse.json({ success: false, message: "Company Name is required." }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ success: false, message: "Phone is required." }, { status: 400 });
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
      contactPerson: trimText(payload.contactPerson) ?? null,
      phone,
      industry: trimText(payload.industry) ?? "General",
      totalLeads: normalizeToInt(payload.totalLeads, 0),
      lastCommunication: parseDate(payload.lastCommunication),
      ...(assignedTo ? { assignedTo: { connect: { id: assignedTo.id } } } : {}),
    };

    if (matches.length === 1) {
      const updated = await prisma.customerCompany.update({
        where: { id: matches[0].id },
        data,
      });

      return NextResponse.json({ success: true, action: "updated", customer: updated });
    }

    const created = await prisma.customerCompany.create({
      data,
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
