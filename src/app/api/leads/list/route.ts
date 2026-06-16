import type * as Prisma from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}

async function resolveScopedUserIds(role: string, userId: string) {
  if (role === "ADMIN") return undefined;
  if (role === "MARKETER") return [userId];

  const prisma = getPrisma();
  const team = await prisma.user.findMany({
    where: { supervisorId: userId, status: "ACTIVE" },
    select: { id: true },
  });

  return [userId, ...team.map((item) => item.id)];
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
    const scopedUserIds = await resolveScopedUserIds(auth.user.role, auth.user.id);

    const searchFilters: Prisma.LeadWhereInput[] = [];
    const roleFilters: Prisma.LeadWhereInput[] = [];

    if (search) {
      searchFilters.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (scopedUserIds) {
      roleFilters.push({
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { createdById: { in: scopedUserIds } },
        ],
      });
    }

    const where: Prisma.LeadWhereInput = {
      ...(searchFilters.length || roleFilters.length
        ? {
            AND: [...searchFilters, ...roleFilters],
          }
        : {}),
    };

    const rows = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        title: true,
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
        name: row.title,
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
