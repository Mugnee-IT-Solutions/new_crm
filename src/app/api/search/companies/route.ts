import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
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
    const scopedUserIds = await resolveScopedUserIds(auth.user.role, auth.user.id);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = normalizeLimit(searchParams.get("limit"));

    const where: Prisma.CustomerCompanyWhereInput = {
      ...(query
        ? {
            name: {
              contains: query,
              mode: "insensitive",
            },
          }
        : {}),
      ...(scopedUserIds
        ? {
            OR: [
              { assignedToId: { in: scopedUserIds } },
              {
                leads: {
                  some: {
                    OR: [{ assignedToId: { in: scopedUserIds } }, { createdById: { in: scopedUserIds } }],
                  },
                },
              },
              { followUps: { some: { assignedToId: { in: scopedUserIds } } },
              },
            ],
          }
        : {}),
    };

    const rows = await prisma.customerCompany.findMany({
      where,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({ value: row.id, label: row.name })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to search companies.",
      },
      { status: 500 },
    );
  }
}
