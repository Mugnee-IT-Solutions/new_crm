"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { roleHome, type Role } from "@/lib/utils";

const DEFAULT_ADMIN_EMAIL = "admin@crm.com";
const DEFAULT_ADMIN_PASSWORD = "Crm@admin1234";
const DEFAULT_ADMIN_MOBILE = "01700000001";

function normalizeMobile(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("88") ? digits.slice(2) : digits;
}

function normalizeEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function normalizeLoginIdentifier(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (raw.includes("@")) return raw.toLowerCase();
  return normalizeMobile(raw);
}

function internalMobileForEmail(email: string) {
  return `email:${email}`;
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

function validDate(value: Date | undefined) {
  if (!value) return undefined;
  return Number.isNaN(value.getTime()) ? undefined : value;
}

function startOfCurrentDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toTaskDate(value: Date | undefined) {
  const date = validDate(value) ?? new Date();
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function followUpStatusForDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < today) return "OVERDUE" as const;
  if (date < tomorrow) return "TODAY" as const;
  return "UPCOMING" as const;
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

async function resolveTaskAssignee(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, requestedAssignedToId?: string) {
  if (!canManage(user.role)) return user.id;

  if (!requestedAssignedToId) {
    throw new Error("Assigned marketer is required.");
  }

  const assignee = await prisma.user.findFirst({
    where: {
      id: requestedAssignedToId,
      role: "MARKETER",
      status: "ACTIVE",
      ...(user.role === "SUPERVISOR" ? { supervisorId: user.id } : {}),
    },
    select: { id: true },
  });

  if (!assignee) {
    throw new Error(user.role === "SUPERVISOR" ? "Selected marketer is not in your team." : "Selected marketer was not found.");
  }

  return assignee.id;
}

async function resolveOptionalMarketerAssignee(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, requestedAssignedToId?: string) {
  if (user.role === "MARKETER") return user.id;
  if (!requestedAssignedToId) return undefined;

  const assignee = await prisma.user.findFirst({
    where: {
      id: requestedAssignedToId,
      role: "MARKETER",
      status: "ACTIVE",
      ...(user.role === "SUPERVISOR" ? { supervisorId: user.id } : {}),
    },
    select: { id: true },
  });

  if (!assignee) {
    throw new Error(user.role === "SUPERVISOR" ? "Selected marketer is not in your team." : "Selected marketer was not found.");
  }

  return assignee.id;
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

async function sendLoginOtpEmail(to: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM;
  const appUrl = (process.env.AUTH_EMAIL_REDIRECT_TO ?? "https://crm.mugnee.com").replace(/\/$/, "");

  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Your Mugnee CRM login OTP",
        html: `<p>Your Mugnee CRM login OTP is <strong>${otp}</strong>.</p><p>This code will expire in 5 minutes.</p><p><a href="${appUrl}/login">Open Mugnee CRM</a></p>`,
        text: `Your Mugnee CRM login OTP is ${otp}. This code will expire in 5 minutes. Open CRM: ${appUrl}/login`,
      }),
    });

    if (!response.ok) {
      console.warn("OTP email provider returned an error.", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.warn("OTP email could not be sent.", error);
    return false;
  }
}

async function ensureOfficeAdmin() {
  const prisma = getPrisma();
  const adminEmail = (process.env.CRM_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase();
  const adminMobile = process.env.CRM_ADMIN_MOBILE ?? DEFAULT_ADMIN_MOBILE;

  const existing =
    (await prisma.user.findUnique({ where: { email: adminEmail } })) ??
    (await prisma.user.findUnique({ where: { mobile: adminMobile } })) ??
    (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }));

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name || "CRM Admin",
        email: adminEmail,
        mobile: adminMobile,
        role: "ADMIN",
        status: "ACTIVE",
        designation: existing.designation ?? "Administrator",
      },
    });
  }

  return prisma.user.create({
    data: {
      name: "CRM Admin",
      email: adminEmail,
      mobile: adminMobile,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Administrator",
    },
  });
}

export async function adminPasswordLoginAction(formData: FormData) {
  const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("email") ?? formData.get("mobile"));
  const password = String(formData.get("password") ?? "");
  const adminEmail = (process.env.CRM_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase();
  const adminPassword = process.env.CRM_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;

  if (login !== adminEmail || password !== adminPassword) {
    return { ok: false, message: "Admin email or password is incorrect." };
  }

  const admin = await ensureOfficeAdmin();
  const store = await cookies();
  store.set("crm_role", "ADMIN", { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  store.set("crm_mobile", admin.mobile, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });

  return { ok: true, redirectTo: roleHome.ADMIN };
}

export async function sendOtpAction(formData: FormData) {
  const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("mobile"));
  const prisma = getPrisma();
  const isEmailLogin = login.includes("@");
  const user = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      OR: isEmailLogin ? [{ email: login }, { mobile: internalMobileForEmail(login) }] : [{ mobile: login }],
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return { ok: false, message: "No active CRM user exists for this email or mobile number." };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const emailTarget = user.email ?? (isEmailLogin ? login : undefined);
  const emailSent = emailTarget ? await sendLoginOtpEmail(emailTarget, otp) : false;
  const shouldShowOtp = process.env.CRM_SHOW_LOGIN_OTP === "true" || (!emailSent && process.env.CRM_SHOW_LOGIN_OTP !== "false");

  await prisma.oTP.create({
    data: {
      mobile: login,
      otp,
      userId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return {
    ok: true,
    message: emailSent ? `OTP sent to ${emailTarget}.` : shouldShowOtp ? `Login OTP: ${otp}` : "OTP sent to your account.",
    otp: shouldShowOtp ? otp : undefined,
  };
}

export async function verifyOtpAction(formData: FormData) {
  const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("mobile"));
  const otp = text(formData, "otp");
  const prisma = getPrisma();

  if (!otp) return { ok: false, message: "Enter the OTP." };

  const record = await prisma.oTP.findFirst({
    where: {
      mobile: login,
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
  const assignedToId = await resolveOptionalMarketerAssignee(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"));
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
  const contactPerson = text(formData, "contactPerson");
  const phone = text(formData, "phone") ?? "";
  const assignedToId = await resolveOptionalMarketerAssignee(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"));
  const company = await prisma.customerCompany.create({
    data: {
      name: text(formData, "name") ?? "New Company",
      industry: text(formData, "industry") ?? "General",
      contactPerson,
      phone,
      totalLeads: 0,
      address: text(formData, "address"),
      website: text(formData, "website"),
      notes: text(formData, "notes"),
      assignedToId,
      contacts: {
        create: {
          name: contactPerson ?? "Primary Contact",
          designation: text(formData, "designation"),
          email: text(formData, "email"),
          mobile: phone,
          whatsapp: text(formData, "whatsapp"),
          isPrimary: true,
        },
      },
      phoneNumbers: phone
        ? {
            create: {
              label: "Primary",
              number: phone,
              whatsapp: false,
            },
          }
        : undefined,
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

export async function createProductAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, message: "Only Admin can create products." };

  const prisma = getPrisma();
  const name = text(formData, "name");
  const category = text(formData, "category");
  const price = Number(formData.get("price"));

  if (!name) return { ok: false, message: "Product name is required." };
  if (!category) return { ok: false, message: "Category is required." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Valid price is required." };

  const product = await prisma.productService.create({
    data: {
      name,
      category,
      brand: text(formData, "brand"),
      price,
      imageUrl: text(formData, "imageUrl"),
      description: text(formData, "description"),
      specification: text(formData, "specification"),
      status: "ACTIVE",
    },
  });

  await addTimeline({
    title: "Product Created",
    description: product.name,
    entity: "ProductService",
    entityId: product.id,
    userId: user.id,
  });
  revalidatePath("/");
  return { ok: true, id: product.id };
}

export async function createTaskAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const assignedToId = await resolveTaskAssignee(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"));
  const status = (text(formData, "status") ?? "PENDING") as never;
  const taskDate = toTaskDate(dateValue(formData, "taskDate") ?? dateValue(formData, "dueDate") ?? dateValue(formData, "taskTime"));

  const task = await prisma.task.create({
    data: {
      title: text(formData, "title") ?? "New Task",
      description: text(formData, "description"),
      assignedById: user.id,
      assignedToId,
      companyName: text(formData, "companyName"),
      leadName: text(formData, "leadName"),
      productId: text(formData, "productId"),
      taskDate,
      isPrevious: status !== "COMPLETED" && taskDate < startOfCurrentDay(),
      dueDate: dateValue(formData, "dueDate"),
      taskTime: dateValue(formData, "taskTime"),
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      status,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
      completedById: status === "COMPLETED" ? user.id : undefined,
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

  const completedAt = new Date();
  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt,
      completedById: user.id,
      isPrevious: false,
    },
  });
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
  return { ok: true, task: updatedTask };
}

export async function completeTaskWithFollowUpAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const followUpDone = text(formData, "followUpDone");
  const conversationSummary = text(formData, "conversationSummary");
  const discussionTopic = text(formData, "discussionTopic");
  const productDiscussed = text(formData, "productDiscussed");
  const outcome = text(formData, "outcome");
  const notes = text(formData, "notes");
  const nextFollowUpDate = validDate(dateValue(formData, "nextFollowUpDate"));
  const rating = formData.has("rating") ? clampEngagementRating(formData.get("rating")) : undefined;

  if (!id) {
    return { ok: false, message: "Task reference is missing." };
  }

  if (!followUpDone || !["YES", "NO"].includes(followUpDone)) {
    return { ok: false, message: "Please confirm whether follow-up is done." };
  }

  if (!conversationSummary) {
    return { ok: false, message: "Conversation summary is required." };
  }

  if (!(await hasTaskAccess(prisma, user, id))) {
    return { ok: false, message: "You are not allowed to complete this task." };
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      completedAt: true,
      companyId: true,
      companyName: true,
      leadId: true,
      leadName: true,
      assignedToId: true,
      assignedById: true,
      product: { select: { name: true } },
    },
  });

  if (!task) {
    return { ok: false, message: "Task not found." };
  }

  if (task.status === "COMPLETED" || task.completedAt) {
    return { ok: false, message: "This task has already been completed." };
  }

  const [resolvedCompany, resolvedLead] = await Promise.all([
    task.companyId
      ? Promise.resolve({ id: task.companyId })
      : task.companyName
        ? prisma.customerCompany.findFirst({
            where: { name: { equals: task.companyName, mode: "insensitive" } },
            select: { id: true },
          })
        : Promise.resolve(null),
    task.leadId
      ? Promise.resolve({ id: task.leadId })
      : task.leadName
        ? prisma.lead.findFirst({
            where: {
              OR: [
                { title: { equals: task.leadName, mode: "insensitive" } },
                { customerName: { equals: task.leadName, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          })
        : Promise.resolve(null),
  ]);

  const completedAt = new Date();
  const shouldCreateFollowUp = followUpDone === "NO" || Boolean(nextFollowUpDate);
  const scheduledFollowUpDate = nextFollowUpDate ?? completedAt;

  const result = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        completedAt,
        completedById: user.id,
        isPrevious: false,
      },
    });

    const communication = await tx.communicationLog.create({
      data: {
        ...(resolvedCompany ? { company: { connect: { id: resolvedCompany.id } } } : {}),
        ...(resolvedLead ? { lead: { connect: { id: resolvedLead.id } } } : {}),
        task: { connect: { id: task.id } },
        user: { connect: { id: user.id } },
        method: "Task Completion",
        note: conversationSummary,
        discussionTopic,
        productDiscussed: productDiscussed ?? task.product?.name ?? undefined,
        communicationAt: completedAt,
        outcome,
        ...(typeof rating === "number" ? { rating } : {}),
        nextFollowUpDate,
        followUpNote: notes,
      },
    });

    const followUp = shouldCreateFollowUp
      ? await tx.followUp.create({
          data: {
            ...(resolvedCompany ? { company: { connect: { id: resolvedCompany.id } } } : {}),
            ...(resolvedLead ? { lead: { connect: { id: resolvedLead.id } } } : {}),
            ...(task.assignedToId ? { assignedTo: { connect: { id: task.assignedToId } } } : {}),
            task: { connect: { id: task.id } },
            method: discussionTopic ?? "Task Follow-up",
            note: conversationSummary,
            nextDiscussionPlan: notes ?? discussionTopic,
            priority: "MEDIUM",
            followUpDate: scheduledFollowUpDate,
            status: followUpStatusForDate(scheduledFollowUpDate),
            ...(typeof rating === "number" ? { rating } : {}),
          },
        })
      : null;

    await tx.activityTimeline.create({
      data: {
        title: "Task Completed",
        description: "Task completed with follow-up details",
        entity: "task",
        entityId: updatedTask.id,
        userId: user.id,
        companyId: resolvedCompany?.id ?? updatedTask.companyId ?? undefined,
        leadId: resolvedLead?.id ?? updatedTask.leadId ?? undefined,
        taskId: updatedTask.id,
        communicationLogId: communication.id,
        ...(followUp ? { followUpId: followUp.id } : {}),
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "Task Completed",
        entity: "task",
        entityId: updatedTask.id,
      },
    });

    if (updatedTask.assignedById) {
      await tx.notification.create({
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

    return { updatedTask, communication, followUp };
  });

  if (task.leadId && typeof rating === "number" && rating > 0) {
    await prisma.lead.update({
      where: { id: task.leadId },
      data: { score: { increment: rating } },
    });
  }

  revalidatePath("/");
  if (resolvedCompany?.id ?? task.companyId) revalidatePath(`/customers/${resolvedCompany?.id ?? task.companyId}`);
  if (resolvedLead?.id ?? task.leadId) revalidatePath(`/leads/${resolvedLead?.id ?? task.leadId}`);

  return {
    ok: true,
    taskId: result.updatedTask.id,
    followUpId: result.followUp?.id,
    communicationId: result.communication.id,
  };
}

export async function updateTaskStatusAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return;

  const task = await prisma.task.update({
    where: { id },
    data: {
      status: status as never,
      completedAt: status === "COMPLETED" ? new Date() : null,
      completedById: status === "COMPLETED" ? user.id : null,
      isPrevious: status === "COMPLETED" ? false : undefined,
    },
  });
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

  const leadId = text(formData, "leadId");
  const companyId = text(formData, "companyId");
  let requestedAssignedToId = text(formData, "assignedToId");
  if (!requestedAssignedToId && linkedTaskId) {
    const linkedTask = await prisma.task.findUnique({
      where: { id: linkedTaskId },
      select: { assignedToId: true },
    });
    if (linkedTask?.assignedToId) requestedAssignedToId = linkedTask.assignedToId;
  }
  const assignedToId = await resolveOptionalMarketerAssignee(prisma, { id: user.id, role: user.role as Role }, requestedAssignedToId);

  const rating = formData.has("rating") ? clampEngagementRating(formData.get("rating")) : undefined;
  const followUpDate = validDate(dateValue(formData, "followUpDate"));
  if (!followUpDate) {
    return { ok: false, message: "A valid follow-up date is required." };
  }

  const method = text(formData, "method") ?? "Phone Call";
  const note = text(formData, "note") ?? "";
  const nextDiscussionPlan = text(formData, "nextDiscussionPlan") ?? "";

  const [assignedUser, lead, company, linkedTask] = await Promise.all([
    assignedToId ? prisma.user.findFirst({ where: { id: assignedToId, status: "ACTIVE" }, select: { id: true } }) : Promise.resolve(null),
    leadId ? prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } }) : Promise.resolve(null),
    companyId ? prisma.customerCompany.findUnique({ where: { id: companyId }, select: { id: true } }) : Promise.resolve(null),
    linkedTaskId ? prisma.task.findUnique({ where: { id: linkedTaskId }, select: { id: true } }) : Promise.resolve(null),
  ]);

  if (assignedToId && !assignedUser) {
    return { ok: false, message: "Assigned user was not found." };
  }

  if (leadId && !lead) {
    return { ok: false, message: "Selected lead was not found." };
  }

  if (companyId && !company) {
    return { ok: false, message: "Selected company was not found." };
  }

  if (linkedTaskId && !linkedTask) {
    return { ok: false, message: "Linked task was not found." };
  }

  const followUpData: Prisma.FollowUpCreateInput = {
    method,
    note,
    nextDiscussionPlan,
    followUpDate,
    status: followUpDate < new Date() ? "OVERDUE" : "UPCOMING",
    ...(typeof rating === "number" ? { rating } : {}),
    ...(assignedUser ? { assignedTo: { connect: { id: assignedUser.id } } } : {}),
    ...(lead ? { lead: { connect: { id: lead.id } } } : {}),
    ...(company ? { company: { connect: { id: company.id } } } : {}),
    ...(linkedTask ? { task: { connect: { id: linkedTask.id } } } : {}),
  };

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

  if (linkedTaskId && followUp.leadId && typeof rating === "number" && rating > 0) {
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
  const taskId = text(formData, "taskId");
  const log = await prisma.communicationLog.create({
    data: {
      ...(text(formData, "companyId") ? { company: { connect: { id: text(formData, "companyId") as string } } } : {}),
      ...(text(formData, "leadId") ? { lead: { connect: { id: text(formData, "leadId") as string } } } : {}),
      ...(taskId ? { task: { connect: { id: taskId } } } : {}),
      user: { connect: { id: user.id } },
      method: text(formData, "method") ?? "Phone Call",
      note: text(formData, "note") ?? "Customer contacted.",
      discussionTopic: text(formData, "discussionTopic"),
      productDiscussed: text(formData, "productDiscussed"),
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
  if (!["ADMIN", "SUPERVISOR"].includes(user.role)) {
    return { ok: false, message: "Only Admin or Supervisor can create users." };
  }

  const prisma = getPrisma();
  const requestedRole = text(formData, "role") ?? "MARKETER";
  const email = normalizeEmail(formData.get("email"));
  const typedMobile = normalizeMobile(formData.get("mobile"));
  const mobile = typedMobile || internalMobileForEmail(email);

  if (!email) {
    return { ok: false, message: "Valid email is required." };
  }

  if (user.role === "SUPERVISOR" && requestedRole !== "MARKETER") {
    return { ok: false, message: "Supervisor can create Marketer users only." };
  }

  if (user.role === "ADMIN" && !["SUPERVISOR", "MARKETER"].includes(requestedRole)) {
    return { ok: false, message: "Admin can create Supervisor or Marketer users." };
  }

  const supervisorId = user.role === "SUPERVISOR"
    ? user.id
    : requestedRole === "MARKETER"
      ? text(formData, "supervisorId")
      : undefined;

  if (supervisorId) {
    const supervisor = await prisma.user.findFirst({
      where: {
        id: supervisorId,
        role: "SUPERVISOR",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!supervisor) {
      return { ok: false, message: "Selected supervisor was not found." };
    }
  }

  try {
    const created = await prisma.user.create({
      data: {
        name: text(formData, "name") ?? "CRM User",
        mobile,
        email,
        role: requestedRole as never,
        designation: text(formData, "designation"),
        supervisorId,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "mobile or email";
      return { ok: false, message: `A user with this ${target} already exists.` };
    }

    throw error;
  }
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
