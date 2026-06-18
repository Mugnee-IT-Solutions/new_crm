"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type * as Prisma from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { createProductEntry, deleteProductEntry, updateProductEntry } from "@/lib/product-center";
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

function cleanText(value: FormDataEntryValue | null) {
  const nextText = textValue(value);
  return nextText ?? "";
}

function textValue(value: FormDataEntryValue | null) {
  if (value === null) return "";
  const nextValue = String(value).trim();
  return nextValue || "";
}

function readTemplateText(formData: FormData, key: string) {
  return cleanText(formData.get(key));
}

function readTemplateNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : 0;
}

function buildCustomerTemplateRaw(formData: FormData) {
  const sl = readTemplateText(formData, "sl");
  const industry = readTemplateText(formData, "industry");
  const companyName = readTemplateText(formData, "companyName");
  const cityOrZilla = readTemplateText(formData, "cityOrZilla");
  const address = readTemplateText(formData, "address");
  const primaryPhone = readTemplateText(formData, "primaryPhone");
  const phone2 = readTemplateText(formData, "phone2");
  const phone3 = readTemplateText(formData, "phone3");
  const primaryEmail = readTemplateText(formData, "primaryEmail");
  const email2 = readTemplateText(formData, "email2");
  const website = readTemplateText(formData, "website");
  const note = readTemplateText(formData, "note");
  const cp1Name = readTemplateText(formData, "contactPerson1Name");
  const cp1Designation = readTemplateText(formData, "designation1");
  const cp1Department = readTemplateText(formData, "department1");
  const cp1Phone1 = readTemplateText(formData, "cp1Phone1");
  const cp1Phone2 = readTemplateText(formData, "cp1Phone2");
  const cp1Email1 = readTemplateText(formData, "cp1Email1");
  const cp1Email2 = readTemplateText(formData, "cp1Email2");
  const cp2Name = readTemplateText(formData, "contactPerson2Name");
  const cp2Designation = readTemplateText(formData, "designation2");
  const cp2Department = readTemplateText(formData, "department2");
  const cp2Phone1 = readTemplateText(formData, "cp2Phone1");
  const cp2Phone2 = readTemplateText(formData, "cp2Phone2");
  const cp2Email1 = readTemplateText(formData, "cp2Email1");
  const cp2Email2 = readTemplateText(formData, "cp2Email2");
  const leadSource = readTemplateText(formData, "leadSource");

  return {
    "SL": sl,
    "Industry": industry,
    "Company Name": companyName,
    "City/Zilla": cityOrZilla,
    "Address": address,
    "Primary Phone": primaryPhone,
    "Phone 2": phone2,
    "Phone 3": phone3,
    "Primary Email": primaryEmail,
    "Email 2": email2,
    "Website": website,
    "Note": note,
    "Contact Person 1 Name": cp1Name,
    "Contact Person 1 Designation": cp1Designation,
    "Contact Person 1 Department": cp1Department,
    "Contact Person 1 Phone 1": cp1Phone1,
    "Contact Person 1 Phone 2": cp1Phone2,
    "Contact Person 1 Email 1": cp1Email1,
    "Contact Person 1 Email 2": cp1Email2,
    "Contact Person 2 Name": cp2Name,
    "Contact Person 2 Designation": cp2Designation,
    "Contact Person 2 Department": cp2Department,
    "Contact Person 2 Phone 1": cp2Phone1,
    "Contact Person 2 Phone 2": cp2Phone2,
    "Contact Person 2 Email 1": cp2Email1,
    "Contact Person 2 Email 2": cp2Email2,
    "Lead Source": leadSource,
  };
}

function buildCustomerTemplateContactPayload(formData: FormData) {
  const raw = buildCustomerTemplateRaw(formData);
  const primaryPhone = raw["Primary Phone"];
  const contactPerson = raw["Contact Person 1 Name"] || "Primary Contact";
  const primaryEmail = raw["Primary Email"] || raw["Contact Person 1 Email 1"] || raw["Contact Person 1 Email 2"] || "";
  const cp1Phone = raw["Contact Person 1 Phone 1"] || "";

  const secondaryContact = raw["Contact Person 2 Name"]
    ? {
      name: raw["Contact Person 2 Name"],
      designation: raw["Contact Person 2 Designation"] || undefined,
      department: raw["Contact Person 2 Department"] || undefined,
      email: raw["Contact Person 2 Email 1"] || raw["Contact Person 2 Email 2"] || undefined,
      mobile: raw["Contact Person 2 Phone 1"] || raw["Contact Person 2 Phone 2"] || undefined,
      isPrimary: false,
    }
    : undefined;

  return {
    rawData: raw,
    primaryPhone,
    contactPerson,
    primaryEmail: primaryEmail || undefined,
    cp1Phone,
    secondaryContact,
  };
}

function normalizeCustomerContactName(value?: string) {
  return value && value.trim().length ? value.trim() : null;
}

function buildCustomerCreateContacts(raw: ReturnType<typeof buildCustomerTemplateRaw>) {
  const contacts = [];
  const primaryContact = {
    name: normalizeCustomerContactName(raw["Contact Person 1 Name"]) || "Primary Contact",
    designation: normalizeCustomerContactName(raw["Contact Person 1 Designation"]) || undefined,
    email: normalizeCustomerContactName(raw["Contact Person 1 Email 1"]) || normalizeCustomerContactName(raw["Contact Person 1 Email 2"]) || normalizeCustomerContactName(raw["Primary Email"]) || undefined,
    mobile: normalizeCustomerContactName(raw["Contact Person 1 Phone 1"]) || normalizeCustomerContactName(raw["Contact Person 1 Phone 2"]) || normalizeCustomerContactName(raw["Primary Phone"]) || undefined,
    isPrimary: true,
} satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput;

  if (primaryContact.mobile || primaryContact.email || primaryContact.designation || primaryContact.name !== "Primary Contact") {
    contacts.push(primaryContact);
  }

  const secondaryContactName = normalizeCustomerContactName(raw["Contact Person 2 Name"]);
  if (secondaryContactName) {
    contacts.push({
      name: secondaryContactName,
      designation: normalizeCustomerContactName(raw["Contact Person 2 Designation"]) || undefined,
      email: normalizeCustomerContactName(raw["Contact Person 2 Email 1"]) || normalizeCustomerContactName(raw["Contact Person 2 Email 2"]) || undefined,
      mobile: normalizeCustomerContactName(raw["Contact Person 2 Phone 1"]) || normalizeCustomerContactName(raw["Contact Person 2 Phone 2"]) || undefined,
      isPrimary: false,
    } satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput);
  }

  return contacts;
}

function buildCustomerCreatePhoneNumbers(raw: ReturnType<typeof buildCustomerTemplateRaw>) {
  const ordered = [
    ["Primary", raw["Primary Phone"]],
    ["Phone 2", raw["Phone 2"]],
    ["Phone 3", raw["Phone 3"]],
    ["Phone 1", raw["Contact Person 1 Phone 1"]],
    ["Phone 2", raw["Contact Person 1 Phone 2"]],
    ["Phone 1", raw["Contact Person 2 Phone 1"]],
    ["Phone 2", raw["Contact Person 2 Phone 2"]],
  ];

  const seen = new Set<string>();
  const creates: Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const [label, rawValue] = ordered[index] ?? [];
    const number = readTemplateTextFromString(rawValue);
    if (!number) continue;
    if (seen.has(number)) continue;

    seen.add(number);
    creates.push({
      label: index === 0 ? "Primary" : `${label} ${creates.length}`,
      number,
      whatsapp: false,
    });
  }

  if (!creates.length) {
    // Keep fallback to avoid invalid empty phone inserts.
  }

  return creates;
}

function readTemplateTextFromString(value: string) {
  const sanitized = value.replace(/\s+/g, "").trim();
  return sanitized || "";
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

const REWARD_TRIGGER_OPTIONS = ["LEAD_CREATED", "FOLLOW_UP_COMPLETED", "MEETING_SCHEDULED", "WON_SALE", "TASK_COMPLETED", "MANUAL_ADJUSTMENT"] as const;

function normalizeRewardTrigger(value?: string) {
  if (!value) return undefined;

  const nextValue = value.trim();
  return REWARD_TRIGGER_OPTIONS.includes(nextValue as (typeof REWARD_TRIGGER_OPTIONS)[number]) ? nextValue : undefined;
}

function formatRewardRuleDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function revalidateRewardViews() {
  [
    "/admin/rewards",
    "/supervisor/rewards",
    "/marketer/rewards",
    "/admin/dashboard",
    "/supervisor/dashboard",
    "/marketer/dashboard",
    "/admin/team",
    "/supervisor/team",
  ].forEach((path) => revalidatePath(path));
}

function revalidateProductViews(productId?: string) {
  [
    "/admin/products",
    "/supervisor/products",
    "/marketer/products",
    "/admin/dashboard",
    "/supervisor/dashboard",
    "/marketer/dashboard",
    "/admin/leads",
    "/supervisor/leads",
    "/marketer/leads",
  ].forEach((path) => revalidatePath(path));

  if (productId) {
    revalidatePath(`/products/${productId}`);
  }
}

async function resolveTaskAssignee(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, requestedAssignedToId?: string) {
  if (!canManage(user.role)) return user.id;

  if (user.role === "SUPERVISOR" && (!requestedAssignedToId || requestedAssignedToId === user.id)) {
    return user.id;
  }

  if (!requestedAssignedToId) {
    throw new Error("Assigned user is required.");
  }

  const assignee = await prisma.user.findFirst({
    where: {
      id: requestedAssignedToId,
      status: "ACTIVE",
      ...(user.role === "SUPERVISOR"
        ? {
            role: "MARKETER",
            supervisorId: user.id,
          }
        : {
            role: { in: ["SUPERVISOR", "MARKETER"] },
          }),
    },
    select: { id: true, role: true },
  });

  if (!assignee) {
    throw new Error(
      user.role === "SUPERVISOR"
        ? "Selected user must be you or a marketer from your team."
        : "Selected assignee must be an active supervisor or marketer.",
    );
  }

  return assignee.id;
}

async function resolveOptionalMarketerAssignee(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, requestedAssignedToId?: string) {
  if (user.role === "MARKETER") return user.id;
  if (!requestedAssignedToId) return undefined;
  if (user.role === "SUPERVISOR" && requestedAssignedToId === user.id) return user.id;

  const assignee = await prisma.user.findFirst({
    where: {
      id: requestedAssignedToId,
      status: "ACTIVE",
      ...(user.role === "SUPERVISOR"
        ? {
            role: "MARKETER",
            supervisorId: user.id,
          }
        : {
            role: { in: ["SUPERVISOR", "MARKETER"] },
          }),
    },
    select: { id: true },
  });

  if (!assignee) {
    throw new Error(
      user.role === "SUPERVISOR"
        ? "Selected user must be you or a marketer from your team."
        : "Selected assignee must be an active supervisor or marketer.",
    );
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

async function hasFollowUpAccess(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, followUpId: string) {
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    select: { assignedToId: true, task: { select: { assignedToId: true, assignedById: true } } },
  });
  if (!followUp) return false;

  if (user.role === "ADMIN") return true;

  const scopeIds = await getTaskScopeUserIds(prisma, user);
  if (!scopeIds) return false;

  return (
    scopeIds.includes(followUp.assignedToId ?? "") ||
    scopeIds.includes(followUp.task?.assignedToId ?? "") ||
    scopeIds.includes(followUp.task?.assignedById ?? "")
  );
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
  const rawData = buildCustomerTemplateRaw(formData);
  const assignedToId = await resolveOptionalMarketerAssignee(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"));
  const companyName = rawData["Company Name"]?.trim() || "New Company";
  const existingSl = rawData["SL"]?.trim?.() || "";
  const nextSl = existingSl || String((await prisma.customerCompany.count()) + 1);
  rawData["SL"] = nextSl;

  if (!rawData["Company Name"]?.trim()) {
    return { ok: false, message: "Company Name is required." };
  }

  const contacts = buildCustomerCreateContacts(rawData);
  const phoneNumbers = buildCustomerCreatePhoneNumbers(rawData);

  const contactPerson = rawData["Contact Person 1 Name"] || contacts[0]?.name || null;
  const phone = rawData["Primary Phone"] || "";
  const company = await prisma.customerCompany.create({
    data: {
      name: companyName,
      industry: rawData["Industry"] || "",
      contactPerson,
      phone,
      totalLeads: 0,
      address: rawData["Address"] || undefined,
      website: rawData["Website"] || undefined,
      notes: rawData["Note"] || undefined,
      rawData,
      assignedToId,
      contacts: contacts.length ? { create: contacts.map((contact) => ({ ...contact, whatsapp: undefined })) } : undefined,
      phoneNumbers: phoneNumbers.length ? { create: phoneNumbers } : undefined,
    } as any,
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
  const name = text(formData, "name");
  const category = text(formData, "category");
  const price = Number(formData.get("price"));

  if (!name) return { ok: false, message: "Product name is required." };
  if (!category) return { ok: false, message: "Category is required." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Valid price is required." };

  const created = await createProductEntry(
    { id: user.id, role: user.role as Role, name: user.name ?? undefined },
    {
      name,
      category,
      brand: text(formData, "brand"),
      price,
      imageUrl: text(formData, "imageUrl"),
      description: text(formData, "description"),
      specification: text(formData, "specification"),
    },
  );

  revalidateProductViews(created.product.id);
  return { ok: true, id: created.product.id, row: created.row };
}

export async function updateProductAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const category = text(formData, "category");
  const price = Number(formData.get("price"));

  if (!id) return { ok: false, message: "Product id is required." };
  if (!name) return { ok: false, message: "Product name is required." };
  if (!category) return { ok: false, message: "Category is required." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Valid price is required." };

  const updated = await updateProductEntry(
    { id: user.id, role: user.role as Role, name: user.name ?? undefined },
    id,
    {
      name,
      category,
      brand: text(formData, "brand"),
      price,
      imageUrl: text(formData, "imageUrl"),
      description: text(formData, "description"),
      specification: text(formData, "specification"),
      status: (text(formData, "status") as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE",
    },
  );

  revalidateProductViews(updated.product.id);
  return { ok: true, id: updated.product.id, row: updated.row };
}

export async function deleteProductAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Product id is required." };

  const deleted = await deleteProductEntry(
    { id: user.id, role: user.role as Role, name: user.name ?? undefined },
    id,
  );

  revalidateProductViews(deleted.id);
  return { ok: true, id: deleted.id };
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
  const method = text(formData, "method") ?? "Phone Call";
  const conversationSummary = text(formData, "conversationSummary");
  const discussionTopic = text(formData, "discussionTopic");
  const productDiscussed = text(formData, "productDiscussed");
  const outcome = text(formData, "outcome");
  const notes = text(formData, "notes");
  const nextFollowUpDate = validDate(dateValue(formData, "nextFollowUpDate"));
  const rating = formData.has("rating") ? clampEngagementRating(formData.get("rating")) : undefined;
  const followUpDone = text(formData, "followUpDone") ?? (nextFollowUpDate ? "NO" : "YES");

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
        method,
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
    nextFollowUpDate: result.followUp?.followUpDate.toISOString(),
    communicationId: result.communication.id,
  };
}

export async function completeFollowUpWithCommunicationAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const method = text(formData, "method") ?? "Phone Call";
  const conversationSummary = text(formData, "conversationSummary");
  const discussionTopic = text(formData, "discussionTopic");
  const productDiscussed = text(formData, "productDiscussed");
  const outcome = text(formData, "outcome");
  const notes = text(formData, "notes");
  const nextFollowUpDate = validDate(dateValue(formData, "nextFollowUpDate"));
  const rating = formData.has("rating") ? clampEngagementRating(formData.get("rating")) : undefined;

  if (!id) {
    return { ok: false, message: "Follow-up reference is missing." };
  }

  if (!conversationSummary) {
    return { ok: false, message: "Conversation summary is required." };
  }

  if (!(await hasFollowUpAccess(prisma, user, id))) {
    return { ok: false, message: "You are not allowed to complete this follow-up." };
  }

  const followUp = await prisma.followUp.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      completedAt: true,
      companyId: true,
      leadId: true,
      assignedToId: true,
      taskId: true,
      method: true,
      priority: true,
    },
  });

  if (!followUp) {
    return { ok: false, message: "Follow-up not found." };
  }

  if (followUp.status === "COMPLETED" || followUp.completedAt) {
    return { ok: false, message: "This follow-up has already been completed." };
  }

  const completedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedFollowUp = await tx.followUp.update({
      where: { id: followUp.id },
      data: {
        status: "COMPLETED",
        completedAt,
      },
    });

    const communication = await tx.communicationLog.create({
      data: {
        ...(followUp.companyId ? { company: { connect: { id: followUp.companyId } } } : {}),
        ...(followUp.leadId ? { lead: { connect: { id: followUp.leadId } } } : {}),
        ...(followUp.taskId ? { task: { connect: { id: followUp.taskId } } } : {}),
        user: { connect: { id: user.id } },
        method,
        note: conversationSummary,
        discussionTopic,
        productDiscussed,
        communicationAt: completedAt,
        outcome,
        ...(typeof rating === "number" ? { rating } : {}),
        nextFollowUpDate,
        followUpNote: notes,
      },
    });

    const nextFollowUp = nextFollowUpDate
      ? await tx.followUp.create({
          data: {
            ...(followUp.companyId ? { company: { connect: { id: followUp.companyId } } } : {}),
            ...(followUp.leadId ? { lead: { connect: { id: followUp.leadId } } } : {}),
            ...(followUp.assignedToId ? { assignedTo: { connect: { id: followUp.assignedToId } } } : {}),
            ...(followUp.taskId ? { task: { connect: { id: followUp.taskId } } } : {}),
            method,
            note: notes ?? conversationSummary,
            nextDiscussionPlan: discussionTopic ?? notes,
            priority: followUp.priority,
            followUpDate: nextFollowUpDate,
            status: followUpStatusForDate(nextFollowUpDate),
            ...(typeof rating === "number" ? { rating } : {}),
          },
        })
      : null;

    await tx.activityTimeline.create({
      data: {
        title: "Follow-up Completed",
        description: "Follow-up completed with communication details",
        entity: "FollowUp",
        entityId: updatedFollowUp.id,
        userId: user.id,
        companyId: updatedFollowUp.companyId ?? undefined,
        leadId: updatedFollowUp.leadId ?? undefined,
        taskId: updatedFollowUp.taskId ?? undefined,
        followUpId: updatedFollowUp.id,
        communicationLogId: communication.id,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "Follow-up Completed",
        entity: "FollowUp",
        entityId: updatedFollowUp.id,
      },
    });

    return { updatedFollowUp, communication, nextFollowUp };
  });

  if (followUp.leadId && typeof rating === "number" && rating > 0) {
    await prisma.lead.update({
      where: { id: followUp.leadId },
      data: { score: { increment: rating } },
    });
  }

  await applyReward("FOLLOW_UP_COMPLETED", followUp.assignedToId ?? user.id, "FollowUp", followUp.id);

  revalidatePath("/");
  if (followUp.companyId) revalidatePath(`/customers/${followUp.companyId}`);
  if (followUp.leadId) revalidatePath(`/leads/${followUp.leadId}`);

  return {
    ok: true,
    followUpId: result.updatedFollowUp.id,
    nextFollowUpId: result.nextFollowUp?.id,
    nextFollowUpDate: result.nextFollowUp?.followUpDate.toISOString(),
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

  const followUpData: Prisma.Prisma.FollowUpCreateInput = {
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
  return { ok: true, id: followUp.id, followUpDate: followUp.followUpDate.toISOString() };
}

export async function updateFollowUpStatusById(user: { id: string; role: Role }, id: string, status: string) {
  const prisma = getPrisma();

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

  if (status === "COMPLETED") {
    await applyReward("FOLLOW_UP_COMPLETED", followUp.assignedToId ?? user.id, "FollowUp", followUp.id);
  }

  revalidatePath("/");
  return followUp;
}

export async function updateFollowUpStatusAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return;
  await updateFollowUpStatusById({ id: user.id, role: user.role as Role }, id, status);
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
    try {
      const { PrismaClientKnownRequestError } = await import("@prisma/client/runtime/client");
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "mobile or email";
        return { ok: false, message: `A user with this ${target} already exists.` };
      }
    } catch {
      // If dynamic import fails, fall through and rethrow the original error below.
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
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can give rewards." };

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
  revalidateRewardViews();
  return { ok: true, id: reward.id };
}

export async function createRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };
  const prisma = getPrisma();
  const name = text(formData, "name");
  const trigger = normalizeRewardTrigger(text(formData, "trigger"));
  const points = intValue(formData, "points", 0);

  if (!name) return { ok: false, message: "Rule name is required." };
  if (!trigger) return { ok: false, message: "Trigger/Event is required." };
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) return { ok: false, message: "Points must be a positive integer." };

  const rule = await prisma.rewardRule.create({
    data: {
      name,
      trigger,
      points,
      active: formData.get("active") !== "false",
    },
  });
  revalidateRewardViews();
  return {
    ok: true,
    id: rule.id,
    rule: {
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      points: rule.points,
      active: rule.active,
      createdAt: formatRewardRuleDate(rule.createdAt),
    },
  };
}

export async function updateRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };

  const prisma = getPrisma();
  const ruleId = text(formData, "id");
  const name = text(formData, "name");
  const trigger = normalizeRewardTrigger(text(formData, "trigger"));
  const points = intValue(formData, "points", 0);
  const active = formData.get("active") !== "false";

  if (!ruleId) return { ok: false, message: "Rule id is required." };
  if (!name) return { ok: false, message: "Rule name is required." };
  if (!trigger) return { ok: false, message: "Trigger/Event is required." };
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) return { ok: false, message: "Points must be a positive integer." };

  const updated = await prisma.rewardRule.update({
    where: { id: ruleId },
    data: { name, trigger, points, active },
  });

  revalidateRewardViews();
  return {
    ok: true,
    id: updated.id,
    rule: {
      id: updated.id,
      name: updated.name,
      trigger: updated.trigger,
      points: updated.points,
      active: updated.active,
      createdAt: formatRewardRuleDate(updated.createdAt),
    },
  };
}

export async function deleteRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };

  const prisma = getPrisma();
  const ruleId = text(formData, "id");
  if (!ruleId) return { ok: false, message: "Rule id is required." };

  await prisma.rewardRule.delete({ where: { id: ruleId } });
  revalidateRewardViews();
  return { ok: true, id: ruleId };
}

export async function toggleRewardRuleStatusAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") {
    return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };
  }
  const prisma = getPrisma();
  const ruleId = text(formData, "id");
  if (!ruleId) {
    return { ok: false, message: "Rule id is required." };
  }

  const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    return { ok: false, message: "Reward rule not found." };
  }

  const updated = await prisma.rewardRule.update({
    where: { id: ruleId },
    data: { active: !rule.active },
  });

  revalidateRewardViews();
  return {
    ok: true,
    id: updated.id,
    rule: {
      id: updated.id,
      name: updated.name,
      trigger: updated.trigger,
      points: updated.points,
      active: updated.active,
      createdAt: formatRewardRuleDate(updated.createdAt),
    },
  };
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
