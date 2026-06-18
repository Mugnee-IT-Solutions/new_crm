import { NextResponse } from "next/server";
import { requireRequestUser } from "@/lib/request-user";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
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
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = normalizeLimit(searchParams.get("limit"));
    const queryMode = "insensitive" as const;

    const searchFilters: Record<string, unknown>[] = [];

    if (query) {
      searchFilters.push({
        OR: [
          { title: { contains: query, mode: queryMode } },
          { customerName: { contains: query, mode: queryMode } },
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
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({ value: row.id, label: row.customerName || row.title })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to search leads.",
      },
      { status: 500 },
    );
  }
}
