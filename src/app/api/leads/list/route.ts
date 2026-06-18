import { NextResponse } from "next/server";
import { requireRequestUser } from "@/lib/request-user";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const limit = parseLimit(searchParams.get("limit"));
    const searchFilters: Record<string, unknown>[] = [];

    if (search) {
      searchFilters.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Record<string, unknown> = {
      ...(searchFilters.length
        ? {
            AND: [...searchFilters],
          }
        : {}),
    };

    const rows = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        title: true,
        customerName: true,
        email: true,
        phone: true,
        company: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.customerName || row.title,
        phone: row.phone,
        companyName: row.company?.name ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load leads.",
      },
      { status: 500 },
    );
  }
}
