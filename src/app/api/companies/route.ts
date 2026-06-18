import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 200);
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
    const limit = parseLimit(searchParams.get("limit"));
    const queryMode = "insensitive" as const;

    const rows = await prisma.customerCompany.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: queryMode } },
              { contactPerson: { contains: query, mode: queryMode } },
              { phone: { contains: query, mode: queryMode } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        companyName: row.name,
        contactPerson: row.contactPerson,
        phone: row.phone,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load companies.",
      },
      { status: 500 },
    );
  }
}
