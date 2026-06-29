import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateFollowUpBody = {
  method?: string;
  note?: string;
  nextDiscussionPlan?: string;
  followUpDate?: string;
};

function parseFollowUpDate(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = normalized.includes("T") ? new Date(normalized) : new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function visibleFollowUpWhere(user: { id: string; role: "ADMIN" | "SUPERVISOR" | "MARKETER" }, id: string): Promise<Prisma.FollowUpWhereInput> {
  if (user.role === "ADMIN") {
    return { id };
  }

  if (user.role === "MARKETER") {
    return { id, assignedToId: user.id };
  }

  return {
    id,
    assignedTo: {
      is: {
        OR: [
          { id: user.id },
          { supervisorId: user.id, role: "MARKETER" as const, status: "ACTIVE" as const },
        ],
      },
    },
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { id } = await context.params;
    const body = (await request.json()) as UpdateFollowUpBody;
    const followUpDate = parseFollowUpDate(body.followUpDate);

    if (!followUpDate) {
      return NextResponse.json({ success: false, message: "Follow-up date is required." }, { status: 400 });
    }

    const existing = await prisma.followUp.findFirst({
      where: await visibleFollowUpWhere({ id: auth.user.id, role: auth.user.role }, id),
      select: {
        id: true,
        companyId: true,
        leadId: true,
        completedAt: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found or you do not have access." }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextStatus = followUpDate < today ? "OVERDUE" : followUpDate < tomorrow ? "TODAY" : "UPCOMING";
    const isCompleted = Boolean(existing.completedAt || existing.status === "COMPLETED");

    const updated = await prisma.followUp.update({
      where: { id: existing.id },
      data: {
        method: body.method?.trim() || "Phone Call",
        note: body.note?.trim() || "Follow-up",
        nextDiscussionPlan: body.nextDiscussionPlan?.trim() || null,
        followUpDate,
        ...(isCompleted ? {} : { status: nextStatus, reminderSentAt: null }),
      },
      select: { id: true, followUpDate: true },
    });

    await prisma.activityTimeline.create({
      data: {
        title: isCompleted ? "Completed Follow-up Updated" : "Follow-up Updated",
        description: body.note?.trim() || (isCompleted ? "Completed follow-up updated" : "Follow-up updated"),
        entity: "FollowUp",
        entityId: updated.id,
        userId: auth.user.id,
        companyId: existing.companyId ?? undefined,
        leadId: existing.leadId ?? undefined,
        followUpId: updated.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: isCompleted ? "Completed Follow-up Updated" : "Follow-up Updated",
        entity: "FollowUp",
        entityId: updated.id,
      },
    });

    return NextResponse.json({ success: true, row: { id: updated.id, followUpDate: updated.followUpDate.toISOString() } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Follow-up update failed." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { id } = await context.params;

    const existing = await prisma.followUp.findFirst({
      where: await visibleFollowUpWhere({ id: auth.user.id, role: auth.user.role }, id),
      select: {
        id: true,
        companyId: true,
        leadId: true,
        completedAt: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found or you do not have access." }, { status: 404 });
    }

    if (existing.completedAt || existing.status === "COMPLETED") {
      return NextResponse.json({ success: false, message: "Completed follow-up cannot be deleted." }, { status: 400 });
    }

    await prisma.followUp.delete({ where: { id: existing.id } });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "Follow-up Deleted",
        entity: "FollowUp",
        entityId: existing.id,
      },
    });

    return NextResponse.json({ success: true, id: existing.id });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Follow-up delete failed." },
      { status: 500 },
    );
  }
}
