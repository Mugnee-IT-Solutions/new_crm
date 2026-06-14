"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { roleHome, type Role } from "@/lib/utils";

function normalizeMobile(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("88") ? digits.slice(2) : digits;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function intValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(value) : undefined;
}

async function actionUser() {
  const session = await getCurrentSession();
  if (!session.mobile) throw new Error("You must be logged in.");

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: {
      mobile: session.mobile,
      ...(session.role ? { role: session.role } : {}),
      status: "ACTIVE",
    },
  });

  if (!user) throw new Error("Active user session was not found.");
  return user;
}

function canManage(role: Role) {
  return role === "ADMIN" || role === "SUPERVISOR";
}

function clampEngagementRating(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(10, Math.round(parsed)));
}

async function getTaskScopeUserIds(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: string }) {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "MARKETER") return [user.id];

  const team = await prisma.user.findMany({
    where: { supervisorId: user.id, status: "ACTIVE" },
    select: { id: true },
  });

  return [user.id, ...team.map((member) => member.id)];
}

async function hasTaskAccess(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { assignedToId: true, assignedById: true } });
  if (!task) return false;

  if (user.role === "ADMIN") return true;

  const scopeIds = await getTaskScopeUserIds(prisma, user);
  if (!scopeIds) return false;

  return scopeIds.includes(task.assignedToId ?? "") || scopeIds.includes(task.assignedById ?? "");
}

async function addTimeline(input: {
  title: string;
  description?: string;
  entity: string;
  entityId?: string;
  userId?: string;
  companyId?: string;
  leadId?: string;
  taskId?: string;
  followUpId?: string;
  communicationLogId?: string;
}) {
  const prisma = getPrisma();
  await prisma.activityTimeline.create({ data: input });
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.title,
      entity: input.entity,
      entityId: input.entityId,
    },
  });
}

async function applyReward(trigger: string, userId: string, entity: string, entityId: string) {
  const prisma = getPrisma();
  const rule = await prisma.rewardRule.findFirst({ where: { trigger, active: true } });
  if (!rule) return;

  const eventKey = `${trigger}:${entity}:${entityId}`;
  const existing = await prisma.rewardExecutionLog.findUnique({
    where: { ruleId_eventKey: { ruleId: rule.id, eventKey } },
  });
  if (existing) return;

  await prisma.$transaction([
    prisma.rewardExecutionLog.create({
      data: {
        ruleId: rule.id,
        userId,
        eventKey,
        entity,
        entityId,
        points: rule.points,
      },
    }),
    prisma.rewardHistory.create({
      data: {
        userId,
        ruleId: rule.id,
        points: rule.points,
        reason: rule.name,
        source: "AUTO",
        entity,
        entityId,
      },
    }),
    prisma.reward.create({
      data: {
        userId,
        ruleId: rule.id,
        eventKey,
        points: rule.points,
        reason: rule.name,
        source: "AUTO",
      },
    }),
    prisma.notification.create({
      data: {
        recipientId: userId,
        title: "Reward Earned",
        message: `${rule.points} points earned for ${rule.name}.`,
        type: "REWARD_EARNED",
        entity,
        entityId,
      },
    }),
  ]);
}

export async function sendOtpAction(formData: FormData) {
  const mobile = normalizeMobile(formData.get("mobile"));
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { mobile } });

  if (!user || user.status !== "ACTIVE") {
    return { ok: false, message: "No active CRM user exists for this mobile number." };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.oTP.create({
    data: {
      mobile,
      otp,
      userId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return {
    ok: true,
    message: process.env.NODE_ENV === "production" ? "OTP sent to your mobile number." : `Development OTP: ${otp}`,
    otp: process.env.NODE_ENV === "production" ? undefined : otp,
  };
}

export async function verifyOtpAction(formData: FormData) {
  const mobile = normalizeMobile(formData.get("mobile"));
  const otp = text(formData, "otp");
  const prisma = getPrisma();

  if (!otp) return { ok: false, message: "Enter the OTP." };

  const record = await prisma.oTP.findFirst({
    where: {
      mobile,
      otp,
      used: false,
      expiresAt: { gt: new Date() },
      user: { status: "ACTIVE" },
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  if (!record?.user) {
    return { ok: false, message: "OTP is invalid or expired." };
  }

  await prisma.oTP.update({ where: { id: record.id }, data: { used: true } });

  const store = await cookies();
  store.set("crm_role", record.user.role, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  store.set("crm_mobile", record.user.mobile, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });

  return { ok: true, redirectTo: roleHome[record.user.role as Role] };
}

export async function createLeadAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const assignedToId = canManage(user.role as Role) ? text(formData, "assignedToId") ?? user.id : user.id;
  const companyId = text(formData, "companyId");
  const productInterestId = text(formData, "productId");

  const lead = await prisma.lead.create({
    data: {
      title: text(formData, "title") ?? "New Lead",
      customerName: text(formData, "customerName") ?? "New Customer",
      phone: text(formData, "phone") ?? "",
      email: text(formData, "email"),
      companyId,
      productInterestId,
      assignedToId,
      createdById: user.id,
      status: "NEW_LEAD",
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      score: intValue(formData, "score", 10),
      purchaseProbability: intValue(formData, "purchaseProbability", 10),
      followUpDate: dateValue(formData, "followUpDate"),
      notes: text(formData, "notes"),
    },
  });

  await addTimeline({
    title: "Lead Created",
    description: lead.title,
    entity: "Lead",
    entityId: lead.id,
    userId: user.id,
    companyId,
    leadId: lead.id,
  });
  if (assignedToId && assignedToId !== user.id) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "New Lead Assigned",
        message: `${lead.title} has been assigned to you.`,
        type: "NEW_LEAD_ASSIGNED",
        entity: "Lead",
        entityId: lead.id,
      },
    });
  }
  await applyReward("LEAD_CREATED", assignedToId ?? user.id, "Lead", lead.id);
  revalidatePath("/");
  return { ok: true, id: lead.id };
}

export async function createCustomerAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const company = await prisma.customerCompany.create({
    data: {
      name: text(formData, "name") ?? "New Company",
      industry: text(formData, "industry") ?? "General",
      address: text(formData, "address"),
      website: text(formData, "website"),
      notes: text(formData, "notes"),
      assignedToId: text(formData, "assignedToId") ?? user.id,
      contacts: {
        create: {
          name: text(formData, "contactPerson") ?? "Primary Contact",
          designation: text(formData, "designation"),
          email: text(formData, "email"),
          mobile: text(formData, "phone"),
          whatsapp: text(formData, "whatsapp"),
          isPrimary: true,
        },
      },
    },
  });

  await addTimeline({
    title: "Customer Created",
    description: company.name,
    entity: "CustomerCompany",
    entityId: company.id,
    userId: user.id,
    companyId: company.id,
  });
  revalidatePath("/");
  return { ok: true, id: company.id };
}

export async function createTaskAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const assignedToId = canManage(user.role as Role) ? text(formData, "assignedToId") ?? user.id : user.id;

  const task = await prisma.task.create({
    data: {
      title: text(formData, "title") ?? "New Task",
      description: text(formData, "description"),
      assignedById: user.id,
      assignedToId,
      companyId: text(formData, "companyId"),
      leadId: text(formData, "leadId"),
      productId: text(formData, "productId"),
      dueDate: dateValue(formData, "dueDate"),
      taskTime: dateValue(formData, "taskTime"),
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      status: (text(formData, "status") ?? "TODO") as never,
      reminder: text(formData, "reminder"),
      notes: text(formData, "notes"),
    },
  });

  await addTimeline({
    title: "Task Created",
    description: task.title,
    entity: "Task",
    entityId: task.id,
    userId: user.id,
    companyId: task.companyId ?? undefined,
    leadId: task.leadId ?? undefined,
    taskId: task.id,
  });
  if (assignedToId) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "Task Assigned",
        message: task.title,
        type: "TASK_ASSIGNED",
        entity: "Task",
        entityId: task.id,
      },
    });
  }
  revalidatePath("/");
  return { ok: true, id: task.id };
}

export async function completeTaskFromTodayAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const status = text(formData, "status");

  if (!id || status !== "COMPLETED") {
    return { ok: false, message: "Invalid completion request." };
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      companyId: true,
      leadId: true,
      assignedToId: true,
      assignedById: true,
    },
  });
  if (!task) return { ok: false, message: "Task not found." };
  if (!(await hasTaskAccess(prisma, user, id))) {
    return { ok: false, message: "You are not allowed to complete this task." };
  }

  const updatedTask = await prisma.task.update({ where: { id }, data: { status: "COMPLETED" } });
  await addTimeline({
    title: "Task Completed",
    description: `${updatedTask.title} marked completed`,
    entity: "Task",
    entityId: updatedTask.id,
    userId: user.id,
    companyId: updatedTask.companyId ?? undefined,
    leadId: updatedTask.leadId ?? undefined,
    taskId: updatedTask.id,
  });

  if (updatedTask.assignedById) {
    await prisma.notification.create({
      data: {
        recipientId: updatedTask.assignedById,
        title: "Task Completed",
        message: updatedTask.title,
        type: "TASK_COMPLETED",
        entity: "Task",
        entityId: updatedTask.id,
      },
    });
  }

  revalidatePath("/");
  return { ok: true, task };
}

export async function updateTaskStatusAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return;

  const task = await prisma.task.update({ where: { id }, data: { status: status as never } });
  await addTimeline({
    title: "Task Status Updated",
    description: `${task.title} marked ${status.replace(/_/g, " ")}`,
    entity: "Task",
    entityId: task.id,
    userId: user.id,
    taskId: task.id,
  });
  if (status === "COMPLETED" && task.assignedById) {
    await prisma.notification.create({
      data: {
        recipientId: task.assignedById,
        title: "Task Completed",
        message: task.title,
        type: "TASK_COMPLETED",
        entity: "Task",
        entityId: task.id,
      },
    });
  }
  revalidatePath("/");
}

export async function createTodayPlanAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const plan = await prisma.todayPlan.create({
    data: {
      userId: user.id,
      title: text(formData, "title") ?? "Daily Plan",
      plannedAt: dateValue(formData, "plannedAt") ?? new Date(),
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      status: (text(formData, "status") ?? "TODO") as never,
      note: text(formData, "note"),
      companyId: text(formData, "companyId"),
      leadId: text(formData, "leadId"),
      productId: text(formData, "productId"),
    },
  });

  await addTimeline({
    title: "Plan Added",
    description: plan.title,
    entity: "TodayPlan",
    entityId: plan.id,
    userId: user.id,
    companyId: plan.companyId ?? undefined,
    leadId: plan.leadId ?? undefined,
  });
  revalidatePath("/");
  return { ok: true, id: plan.id };
}

export async function createFollowUpAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const linkedTaskId = text(formData, "taskId");
  if (linkedTaskId && !(await hasTaskAccess(prisma, user, linkedTaskId))) {
    return { ok: false, message: "You are not allowed to create follow-up for this task." };
  }

  let assignedToId = canManage(user.role as Role) ? text(formData, "assignedToId") ?? user.id : user.id;
  if (!assignedToId && linkedTaskId) {
    const linkedTask = await prisma.task.findUnique({
      where: { id: linkedTaskId },
      select: { assignedToId: true },
    });
    if (linkedTask?.assignedToId) assignedToId = linkedTask.assignedToId;
  }

  const rating = clampEngagementRating(formData.get("rating"));
  const priority = (text(formData, "priority") ?? "MEDIUM") as never;
  const date = dateValue(formData, "followUpDate") ?? new Date();
  const followUpData = {
    leadId: text(formData, "leadId"),
    companyId: text(formData, "companyId"),
    assignedToId,
    method: text(formData, "method") ?? "Phone Call",
    note: text(formData, "note"),
    nextDiscussionPlan: text(formData, "nextDiscussionPlan"),
    followUpDate: date,
    status: date < new Date() ? "OVERDUE" : "UPCOMING",
    priority,
    rating,
    ...(linkedTaskId ? { taskId: linkedTaskId } : {}),
  } as any;

  const followUp = await prisma.followUp.create({
    data: followUpData,
  });

  await addTimeline({
    title: "Follow-up Scheduled",
    description: followUp.note ?? followUp.method,
    entity: "FollowUp",
    entityId: followUp.id,
    userId: user.id,
    companyId: followUp.companyId ?? undefined,
    leadId: followUp.leadId ?? undefined,
    followUpId: followUp.id,
  });
  if (assignedToId) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "Follow-up Reminder",
        message: followUp.note ?? "A follow-up has been scheduled.",
        type: "FOLLOW_UP_REMINDER",
        entity: "FollowUp",
        entityId: followUp.id,
        followUpId: followUp.id,
      },
    });
  }

  if (linkedTaskId && followUp.leadId && rating > 0) {
    await prisma.lead.update({ where: { id: followUp.leadId }, data: { score: { increment: rating } } });
  }
  revalidatePath("/");
  return { ok: true, id: followUp.id };
}

export async function updateFollowUpStatusAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return;

  const followUp = await prisma.followUp.update({
    where: { id },
    data: {
      status: status as never,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });
  await addTimeline({
    title: "Follow-up Updated",
    description: `Marked ${status.replace(/_/g, " ")}`,
    entity: "FollowUp",
    entityId: followUp.id,
    userId: user.id,
    companyId: followUp.companyId ?? undefined,
    leadId: followUp.leadId ?? undefined,
    followUpId: followUp.id,
  });
  if (status === "COMPLETED") await applyReward("FOLLOW_UP_COMPLETED", followUp.assignedToId ?? user.id, "FollowUp", followUp.id);
  revalidatePath("/");
}

export async function createCommunicationAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const nextFollowUpDate = dateValue(formData, "nextFollowUpDate");
  const log = await prisma.communicationLog.create({
    data: {
      companyId: text(formData, "companyId"),
      leadId: text(formData, "leadId"),
      userId: user.id,
      method: text(formData, "method") ?? "Phone Call",
      note: text(formData, "note") ?? "Customer contacted.",
      communicationAt: dateValue(formData, "communicationAt") ?? new Date(),
      outcome: text(formData, "outcome"),
      rating: intValue(formData, "rating", 0),
      nextFollowUpDate,
      followUpNote: text(formData, "followUpNote"),
    },
  });

  await addTimeline({
    title: `${log.method} Logged`,
    description: log.note,
    entity: "CommunicationLog",
    entityId: log.id,
    userId: user.id,
    companyId: log.companyId ?? undefined,
    leadId: log.leadId ?? undefined,
    communicationLogId: log.id,
  });

  if (nextFollowUpDate) {
    await prisma.followUp.create({
      data: {
        companyId: log.companyId,
        leadId: log.leadId,
        assignedToId: user.id,
        method: log.method,
        note: log.followUpNote ?? "Next follow-up",
        followUpDate: nextFollowUpDate,
        status: "UPCOMING",
      },
    });
  }
  revalidatePath("/");
  return { ok: true, id: log.id };
}

export async function createUserAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, message: "Only Admin can create users." };

  const prisma = getPrisma();
  const created = await prisma.user.create({
    data: {
      name: text(formData, "name") ?? "CRM User",
      mobile: normalizeMobile(formData.get("mobile")),
      email: text(formData, "email"),
      role: (text(formData, "role") ?? "MARKETER") as never,
      designation: text(formData, "designation"),
      supervisorId: text(formData, "supervisorId"),
    },
  });
  await addTimeline({
    title: "User Created",
    description: created.name,
    entity: "User",
    entityId: created.id,
    userId: user.id,
  });
  revalidatePath("/");
  return { ok: true, id: created.id };
}

export async function saveSettingsAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, message: "Only Admin can update settings." };

  const prisma = getPrisma();
  await prisma.systemSetting.upsert({
    where: { key: "company.profile" },
    update: {
      value: {
        company: text(formData, "company"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        address: text(formData, "address"),
      },
    },
    create: {
      key: "company.profile",
      group: "company",
      value: {
        company: text(formData, "company"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        address: text(formData, "address"),
      },
    },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function giveManualRewardAction(formData: FormData) {
  const user = await actionUser();
  if (!canManage(user.role as Role)) return { ok: false, message: "Only Admin or Supervisor can give rewards." };

  const prisma = getPrisma();
  const userId = text(formData, "userId");
  if (!userId) return { ok: false, message: "Employee is required." };
  const points = intValue(formData, "points", 0);
  const reason = text(formData, "reason") ?? "Manual reward";

  const reward = await prisma.reward.create({
    data: { userId, points, reason, source: "MANUAL" },
  });
  await prisma.rewardHistory.create({
    data: { userId, points, reason, source: "MANUAL", entity: "Reward", entityId: reward.id },
  });
  await prisma.notification.create({
    data: {
      recipientId: userId,
      title: "Reward Earned",
      message: `${points} points: ${reason}`,
      type: "REWARD_EARNED",
      entity: "Reward",
      entityId: reward.id,
    },
  });
  revalidatePath("/");
  return { ok: true, id: reward.id };
}

export async function createRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, message: "Only Admin can manage reward rules." };
  const prisma = getPrisma();
  const rule = await prisma.rewardRule.create({
    data: {
      name: text(formData, "name") ?? "Reward Rule",
      trigger: text(formData, "trigger") ?? "LEAD_CREATED",
      points: intValue(formData, "points", 0),
      active: formData.get("active") !== "false",
    },
  });
  revalidatePath("/");
  return { ok: true, id: rule.id };
}

export async function createImportExportLogAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const log = await prisma.importExportLog.create({
    data: {
      type: (text(formData, "type") ?? "IMPORT") as never,
      module: (text(formData, "module") ?? "CUSTOMERS") as never,
      format: (text(formData, "format") ?? "CSV") as never,
      requestedById: user.id,
      fileName: text(formData, "fileName"),
      status: "COMPLETED",
      processedRows: intValue(formData, "processedRows", 0),
    },
  });
  revalidatePath("/");
  return { ok: true, id: log.id };
}

export async function createReportLogAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  await prisma.reportLog.create({
    data: {
      reportType: (text(formData, "reportType") ?? "SALES") as never,
      format: (text(formData, "format") ?? "PDF") as never,
      requestedById: user.id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  revalidatePath("/");
}

export async function markNotificationReadAction(formData: FormData) {
  await actionUser();
  const id = text(formData, "id");
  if (!id) return;
  await getPrisma().notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/");
}
