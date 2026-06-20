import "server-only";

import * as XLSX from "xlsx";
import {
  FollowUpStatus,
  LeadStatus,
  Priority,
  QuotationStatus,
  TaskStatus,
} from "@prisma/client";
import type * as PrismaTypes from "@prisma/client";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { getPrisma } from "@/lib/prisma";
import {
  getReportDefinition,
  type ReportDatePreset,
  type ReportFormat,
  type ReportTypeKey,
} from "@/lib/report-definitions";
import type { Role } from "@/lib/utils";

type JsonObject = Record<string, unknown>;

type ReportActor = {
  id: string;
  role: Role;
  name: string;
};

export type ReportFilters = {
  datePreset?: ReportDatePreset;
  from?: string;
  to?: string;
  userId?: string;
  customerId?: string;
  communicationType?: string;
  leadStatus?: string;
  followUpStatus?: string;
  taskStatus?: string;
  productId?: string;
};

type ReportDocument = {
  title: string;
  slug: string;
  companyTitle: string;
  generatedAt: Date;
  generatedBy: string;
  filters: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
};

type ReportExportResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  rowCount: number;
  reportTitle: string;
};

const WEEK_STARTS_ON = 1 as const;
const SUPPORTED_REPORT_LOG_TYPES = new Set([
  "CUSTOMER_COMMUNICATION",
  "FOLLOW_UP",
  "EMPLOYEE_PERFORMANCE",
  "SALES",
  "REWARD",
  "LEAD_CONVERSION",
]);

function stringify(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>) && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return String((value as { toNumber: () => number }).toNumber());
  }
  return String(value);
}

function labelize(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function communicationTypeLabel(value?: string) {
  if (!value) return "-";
  if (value === "WHATSAPP") return "WhatsApp";
  if (value === "CALL") return "Call";
  if (value === "EMAIL") return "Email";
  if (value === "MEETING") return "Meeting";
  return labelize(value);
}

function escapeCsvValue(value: unknown) {
  const normalized = stringify(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function normalizeDateInput(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDateRange(filters: ReportFilters) {
  const now = new Date();
  const preset = filters.datePreset ?? "month";

  if (preset === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  if (preset === "week") {
    return {
      from: startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }),
      to: endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }),
    };
  }

  if (preset === "month") {
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
  }

  const from = normalizeDateInput(filters.from);
  const to = normalizeDateInput(filters.to);

  return {
    from: from ? startOfDay(from) : null,
    to: to ? endOfDay(to) : null,
  };
}

function withinRange(dateField: string, range: { from: Date | null; to: Date | null }) {
  if (!range.from && !range.to) return undefined;

  const condition: Record<string, Date> = {};
  if (range.from) condition.gte = range.from;
  if (range.to) condition.lte = range.to;
  return { [dateField]: condition };
}

async function getScopedUserIds(prisma: ReturnType<typeof getPrisma>, actor: ReportActor) {
  if (actor.role === "ADMIN") return undefined;
  if (actor.role === "MARKETER") return [actor.id];

  const teamMembers = await prisma.user.findMany({
    where: { supervisorId: actor.id, status: "ACTIVE" },
    select: { id: true },
  });

  return [actor.id, ...teamMembers.map((member) => member.id)];
}

async function getCompanyTitle(prisma: ReturnType<typeof getPrisma>) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "company.profile" },
    select: { value: true },
  });

  const rawValue = setting?.value as JsonObject | null | undefined;
  return typeof rawValue?.company === "string" && rawValue.company.trim() ? rawValue.company.trim() : "Mugnee CRM";
}

async function resolveFilterLabels(
  prisma: ReturnType<typeof getPrisma>,
  filters: ReportFilters,
) {
  const labels: Array<{ label: string; value: string }> = [];
  const range = buildDateRange(filters);

  labels.push({
    label: "Date Range",
    value:
      filters.datePreset === "custom"
        ? `${range.from ? format(range.from, "dd MMM yyyy") : "-"} to ${range.to ? format(range.to, "dd MMM yyyy") : "-"}`
        : labelize(filters.datePreset ?? "month"),
  });

  if (filters.userId) {
    const user = await prisma.user.findUnique({ where: { id: filters.userId }, select: { name: true } });
    labels.push({ label: "Employee", value: user?.name ?? filters.userId });
  }

  if (filters.customerId) {
    const customer = await prisma.customerCompany.findUnique({ where: { id: filters.customerId }, select: { name: true } });
    labels.push({ label: "Customer", value: customer?.name ?? filters.customerId });
  }

  if (filters.productId) {
    const product = await prisma.productService.findUnique({ where: { id: filters.productId }, select: { name: true } });
    labels.push({ label: "Product", value: product?.name ?? filters.productId });
  }

  if (filters.communicationType) labels.push({ label: "Communication Type", value: communicationTypeLabel(filters.communicationType) });
  if (filters.leadStatus) labels.push({ label: "Lead Status", value: labelize(filters.leadStatus) });
  if (filters.followUpStatus) labels.push({ label: "Follow-up Status", value: labelize(filters.followUpStatus) });
  if (filters.taskStatus) labels.push({ label: "Task Status", value: labelize(filters.taskStatus) });

  return labels;
}

function priorityLabel(priority: Priority | null | undefined) {
  if (!priority) return "-";
  if (priority === "URGENT") return "Important";
  return labelize(priority);
}

function dateLabel(value: Date | null | undefined, pattern = "dd MMM yyyy hh:mm a") {
  return value ? format(value, pattern) : "-";
}

function jsonDetail(value: PrismaTypes.Prisma.JsonValue | null | undefined) {
  if (!value) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function reportDocumentBase(
  reportType: ReportTypeKey,
  actor: ReportActor,
  companyTitle: string,
  filters: Array<{ label: string; value: string }>,
  columns: string[],
  rows: string[][],
): ReportDocument {
  const definition = getReportDefinition(reportType);
  if (!definition) {
    throw new Error("Unsupported report type.");
  }

  return {
    title: definition.title,
    slug: definition.slug,
    companyTitle,
    generatedAt: new Date(),
    generatedBy: actor.name,
    filters,
    columns,
    rows,
  };
}

async function buildCustomerCommunicationReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const productName = filters.productId
    ? (await prisma.productService.findUnique({ where: { id: filters.productId }, select: { name: true } }))?.name ?? null
    : null;
  const communicationTypeFilter =
    filters.communicationType === "CALL"
      ? {
          OR: [
            { method: { contains: "phone", mode: "insensitive" as const } },
            { method: { contains: "call", mode: "insensitive" as const } },
          ],
        }
      : filters.communicationType === "WHATSAPP"
        ? { method: { contains: "whatsapp", mode: "insensitive" as const } }
        : filters.communicationType === "EMAIL"
          ? { method: { contains: "email", mode: "insensitive" as const } }
          : filters.communicationType === "MEETING"
            ? { method: { contains: "meeting", mode: "insensitive" as const } }
            : {};

  const where: PrismaTypes.Prisma.CommunicationLogWhereInput = {
    AND: [
      withinRange("communicationAt", range) ?? {},
      scopedUserIds ? { userId: { in: scopedUserIds } } : {},
      filters.userId ? { userId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      communicationTypeFilter,
      filters.productId
        ? {
            OR: [
              { task: { is: { productId: filters.productId } } },
              { lead: { is: { productInterestId: filters.productId } } },
              ...(productName ? [{ productDiscussed: { contains: productName, mode: "insensitive" as const } }] : []),
            ],
          }
        : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.communicationLog.findMany({
    where,
    include: {
      company: { select: { name: true } },
      lead: { select: { title: true, customerName: true } },
      user: { select: { name: true } },
    },
    orderBy: { communicationAt: "desc" },
  });

  return reportDocumentBase(
    "CUSTOMER_COMMUNICATION",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Date", "Customer / Company", "Lead", "Method", "Discussion Topic", "Note", "Outcome", "Next Follow-up", "User"],
    rows.map((row) => [
      dateLabel(row.communicationAt),
      row.company?.name ?? row.lead?.customerName ?? "-",
      row.lead?.title ?? "-",
      row.method,
      row.discussionTopic ?? "-",
      row.note,
      row.outcome ?? "-",
      dateLabel(row.nextFollowUpDate),
      row.user?.name ?? "-",
    ]),
  );
}

async function buildFollowUpReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.FollowUpWhereInput = {
    AND: [
      withinRange("followUpDate", range) ?? {},
      scopedUserIds ? { assignedToId: { in: scopedUserIds } } : {},
      filters.userId ? { assignedToId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.followUpStatus ? { status: filters.followUpStatus as FollowUpStatus } : {},
      filters.productId
        ? {
            OR: [
              { task: { is: { productId: filters.productId } } },
              { lead: { is: { productInterestId: filters.productId } } },
            ],
          }
        : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.followUp.findMany({
    where,
    include: {
      company: { select: { name: true } },
      lead: { select: { title: true, customerName: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { followUpDate: "asc" },
  });

  return reportDocumentBase(
    "FOLLOW_UP",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Follow-up Date", "Customer / Company", "Lead", "Assigned To", "Method", "Priority", "Status", "Note", "Next Action"],
    rows.map((row) => [
      dateLabel(row.followUpDate),
      row.company?.name ?? row.lead?.customerName ?? "-",
      row.lead?.title ?? "-",
      row.assignedTo?.name ?? "-",
      row.method,
      priorityLabel(row.priority),
      labelize(row.status),
      row.note ?? "-",
      row.nextDiscussionPlan ?? "-",
    ]),
  );
}

async function buildTaskReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const taskScope: PrismaTypes.Prisma.TaskWhereInput =
    actor.role === "ADMIN"
      ? {}
      : actor.role === "MARKETER"
        ? { assignedToId: actor.id }
        : {
            OR: [
              { assignedToId: { in: scopedUserIds ?? [actor.id] } },
              { assignedById: actor.id },
            ],
          };

  const where: PrismaTypes.Prisma.TaskWhereInput = {
    AND: [
      taskScope,
      withinRange("taskDate", range) ?? {},
      filters.userId ? { assignedToId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.taskStatus ? { status: filters.taskStatus as TaskStatus } : {},
      filters.productId ? { productId: filters.productId } : {},
    ],
  };

  const rows = await prisma.task.findMany({
    where,
    include: {
      company: { select: { name: true } },
      assignedTo: { select: { name: true } },
      assignedBy: { select: { name: true } },
      product: { select: { name: true } },
    },
    orderBy: [{ taskDate: "asc" }, { taskTime: "asc" }],
  });

  return reportDocumentBase(
    "TASK",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Due Date", "Company", "Task Title", "Assigned To", "Assigned By", "Priority", "Status", "Product", "Details"],
    rows.map((row) => [
      dateLabel(row.taskTime ?? row.taskDate),
      row.company?.name ?? row.companyName ?? "-",
      row.title,
      row.assignedTo.name,
      row.assignedBy.name,
      priorityLabel(row.priority),
      labelize(row.status),
      row.product?.name ?? "-",
      row.description ?? row.notes ?? "-",
    ]),
  );
}

async function buildEmployeePerformanceReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const userWhere: PrismaTypes.Prisma.UserWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { id: { in: scopedUserIds ?? [actor.id] } },
      filters.userId ? { id: filters.userId } : {},
      { status: "ACTIVE" },
    ],
  };

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, role: true, designation: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (user) => {
      const [leadCount, callCount, whatsappCount, meetingCount, followUpCount, pendingTaskCount, overdueFollowUpCount, salesCount] = await Promise.all([
        prisma.lead.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("createdAt", range) ?? {}),
            ...(filters.customerId ? { companyId: filters.customerId } : {}),
            ...(filters.productId ? { productInterestId: filters.productId } : {}),
            ...(filters.leadStatus ? { status: filters.leadStatus as LeadStatus } : {}),
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
            method: { in: ["Phone", "Phone Call", "Call"] },
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
            method: { contains: "whatsapp", mode: "insensitive" },
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
            method: { contains: "meeting", mode: "insensitive" },
          },
        }),
        prisma.followUp.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("followUpDate", range) ?? {}),
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: user.id,
            status: { not: "COMPLETED" },
            ...(withinRange("taskDate", range) ?? {}),
          },
        }),
        prisma.followUp.count({
          where: {
            assignedToId: user.id,
            status: { not: "COMPLETED" },
            followUpDate: { lt: startOfDay(new Date()) },
          },
        }),
        prisma.quotation.count({
          where: {
            createdById: user.id,
            status: "CONVERTED_TO_SALE",
            ...(withinRange("createdAt", range) ?? {}),
          },
        }),
      ]);

      const conversion = leadCount ? `${Math.round((salesCount / leadCount) * 100)}%` : "0%";
      return [
        user.name,
        labelize(user.role),
        String(leadCount),
        String(callCount),
        String(whatsappCount),
        String(meetingCount),
        String(followUpCount),
        String(pendingTaskCount),
        String(overdueFollowUpCount),
        String(salesCount),
        conversion,
      ];
    }),
  );

  return reportDocumentBase(
    "EMPLOYEE_PERFORMANCE",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Employee", "Role", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion"],
    rows,
  );
}

async function buildLeadConversionReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.LeadWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { assignedToId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { assignedToId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.leadStatus ? { status: filters.leadStatus as LeadStatus } : {},
      filters.productId ? { productInterestId: filters.productId } : {},
    ],
  };

  const rows = await prisma.lead.findMany({
    where,
    include: {
      company: { select: { name: true } },
      assignedTo: { select: { name: true } },
      interestedProduct: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "LEAD_CONVERSION",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Created At", "Lead", "Customer", "Company", "Product Interest", "Status", "Lead Score", "Probability", "Assigned To", "Follow-up Date"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.title,
      row.customerName,
      row.company?.name ?? "-",
      row.interestedProduct?.name ?? "-",
      labelize(row.status),
      String(row.score),
      `${row.purchaseProbability}%`,
      row.assignedTo?.name ?? "-",
      dateLabel(row.followUpDate),
    ]),
  );
}

async function buildSalesReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.QuotationWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { createdById: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { createdById: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.productId ? { items: { some: { productId: filters.productId } } } : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.quotation.findMany({
    where,
    include: {
      company: { select: { name: true } },
      lead: { select: { title: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "SALES",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Quote Date", "Quote No", "Customer", "Lead", "Created By", "Status", "Subtotal", "Discount", "Total", "Valid Until"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.quoteNumber,
      row.company?.name ?? "-",
      row.lead?.title ?? "-",
      row.createdBy?.name ?? "-",
      labelize(row.status),
      stringify(row.subtotal),
      stringify(row.discount),
      stringify(row.totalAmount),
      dateLabel(row.validUntil, "dd MMM yyyy"),
    ]),
  );
}

async function buildQuotationReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.QuotationWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { createdById: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { createdById: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.productId ? { items: { some: { productId: filters.productId } } } : {},
    ],
  };

  const rows = await prisma.quotation.findMany({
    where,
    include: {
      company: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "QUOTATION",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Quote Date", "Quote No", "Customer", "Created By", "Status", "Products", "Items", "Total"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.quoteNumber,
      row.company?.name ?? "-",
      row.createdBy?.name ?? "-",
      labelize(row.status),
      row.items.map((item) => item.product?.name ?? item.description).filter(Boolean).join(", ") || "-",
      String(row.items.length),
      stringify(row.totalAmount),
    ]),
  );
}

async function buildProductInterestReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.ProductInterestWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { userId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { userId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.productId ? { productId: filters.productId } : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.productInterest.findMany({
    where,
    include: {
      product: { select: { name: true } },
      company: { select: { name: true } },
      lead: { select: { title: true, status: true, customerName: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "PRODUCT_INTEREST",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Created At", "Product", "Customer / Company", "Lead", "Assigned User", "Score", "Lead Status"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.product.name,
      row.company?.name ?? row.lead?.customerName ?? "-",
      row.lead?.title ?? "-",
      row.user?.name ?? "-",
      String(row.score),
      row.lead?.status ? labelize(row.lead.status) : "-",
    ]),
  );
}

async function buildCustomerGrowthReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const visibilityWhere: PrismaTypes.Prisma.CustomerCompanyWhereInput =
    actor.role === "ADMIN"
      ? {}
      : {
          OR: [
            { assignedToId: { in: scopedUserIds ?? [actor.id] } },
            { leads: { some: { assignedToId: { in: scopedUserIds ?? [actor.id] } } } },
            { followUps: { some: { assignedToId: { in: scopedUserIds ?? [actor.id] } } } },
            { communications: { some: { userId: { in: scopedUserIds ?? [actor.id] } } } },
          ],
        };

  const where: PrismaTypes.Prisma.CustomerCompanyWhereInput = {
    AND: [
      visibilityWhere,
      withinRange("createdAt", range) ?? {},
      filters.customerId ? { id: filters.customerId } : {},
      filters.userId ? { assignedToId: filters.userId } : {},
    ],
  };

  const rows = await prisma.customerCompany.findMany({
    where,
    include: {
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "CUSTOMER_GROWTH",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Created At", "Company Name", "Industry", "City / Zilla", "Address", "Assigned To", "Total Leads", "Last Communication"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.name,
      row.industry || "-",
      row.city || "-",
      row.address || "-",
      row.assignedTo?.name ?? "-",
      String(row.totalLeads),
      dateLabel(row.lastCommunication),
    ]),
  );
}

async function buildRewardReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.RewardHistoryWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { userId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { userId: filters.userId } : {},
    ],
  };

  const rows = await prisma.rewardHistory.findMany({
    where,
    include: {
      user: { select: { name: true } },
      rule: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "REWARD",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Date", "Employee", "Points", "Rule", "Source", "Reason", "Entity", "Entity Id"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.user.name,
      String(row.points),
      row.rule?.name ?? "-",
      row.source,
      row.reason,
      row.entity ?? "-",
      row.entityId ?? "-",
    ]),
  );
}

async function buildDailyWorkSummaryReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const users = await prisma.user.findMany({
    where: {
      AND: [
        actor.role === "ADMIN" ? {} : { id: { in: scopedUserIds ?? [actor.id] } },
        filters.userId ? { id: filters.userId } : {},
        { status: "ACTIVE" },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (user) => {
      const [tasksCompleted, dueFollowUps, communications, leadsAdded, rewardsEarned] = await Promise.all([
        prisma.task.count({
          where: {
            assignedToId: user.id,
            status: "COMPLETED",
            ...(withinRange("completedAt", range) ?? {}),
          },
        }),
        prisma.followUp.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("followUpDate", range) ?? {}),
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
          },
        }),
        prisma.lead.count({
          where: {
            createdById: user.id,
            ...(withinRange("createdAt", range) ?? {}),
          },
        }),
        prisma.rewardHistory.aggregate({
          where: {
            userId: user.id,
            ...(withinRange("createdAt", range) ?? {}),
          },
          _sum: { points: true },
        }),
      ]);

      return [
        user.name,
        filters.datePreset === "custom"
          ? `${range.from ? format(range.from, "dd MMM yyyy") : "-"} to ${range.to ? format(range.to, "dd MMM yyyy") : "-"}`
          : labelize(filters.datePreset ?? "month"),
        String(tasksCompleted),
        String(dueFollowUps),
        String(communications),
        String(leadsAdded),
        String(rewardsEarned._sum.points ?? 0),
      ];
    }),
  );

  return reportDocumentBase(
    "DAILY_WORK_SUMMARY",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Employee", "Period", "Tasks Completed", "Follow-ups", "Communications", "Leads Added", "Reward Points"],
    rows,
  );
}

async function buildActivityLogReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.ActivityLogWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { userId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { userId: filters.userId } : {},
    ],
  };

  const rows = await prisma.activityLog.findMany({
    where,
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "ACTIVITY_LOG",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Date", "User", "Action", "Entity", "Entity Id", "Metadata"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.user?.name ?? "-",
      row.action,
      row.entity,
      row.entityId ?? "-",
      jsonDetail(row.metadata),
    ]),
  );
}

export async function buildReportDocument(actor: ReportActor, reportType: ReportTypeKey, filters: ReportFilters) {
  const prisma = getPrisma();
  const scopedUserIds = await getScopedUserIds(prisma, actor);
  const companyTitle = await getCompanyTitle(prisma);

  switch (reportType) {
    case "CUSTOMER_COMMUNICATION":
      return buildCustomerCommunicationReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "FOLLOW_UP":
      return buildFollowUpReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "TASK":
      return buildTaskReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "EMPLOYEE_PERFORMANCE":
      return buildEmployeePerformanceReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "LEAD_CONVERSION":
      return buildLeadConversionReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "SALES":
      return buildSalesReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "QUOTATION":
      return buildQuotationReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "PRODUCT_INTEREST":
      return buildProductInterestReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "CUSTOMER_GROWTH":
      return buildCustomerGrowthReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "REWARD":
      return buildRewardReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "DAILY_WORK_SUMMARY":
      return buildDailyWorkSummaryReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "ACTIVITY_LOG":
      return buildActivityLogReport(prisma, actor, filters, companyTitle, scopedUserIds);
    default:
      throw new Error("Unsupported report type.");
  }
}

function metadataRows(document: ReportDocument) {
  return [
    [document.companyTitle],
    [document.title],
    [`Generated: ${format(document.generatedAt, "dd MMM yyyy hh:mm a")}`],
    [`Generated By: ${document.generatedBy}`],
    ...document.filters.map((item) => [`${item.label}: ${item.value}`]),
    [""],
  ];
}

function buildCsvBuffer(document: ReportDocument) {
  const lines = [
    ...metadataRows(document).map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")),
    document.columns.map((header) => escapeCsvValue(header)).join(","),
    ...document.rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")),
  ];

  return Buffer.from(`\uFEFF${lines.join("\n")}`, "utf8");
}

function buildWorkbookBuffer(document: ReportDocument) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ...metadataRows(document),
    document.columns,
    ...document.rows,
  ]);

  XLSX.utils.book_append_sheet(workbook, sheet, "Report");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function buildPrintHtml(document: ReportDocument) {
  const filterMarkup = document.filters
    .map((item) => `<li><strong>${item.label}:</strong> ${item.value}</li>`)
    .join("");
  const headerCells = document.columns.map((column) => `<th>${column}</th>`).join("");
  const bodyRows = document.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell || "-"}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${document.title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #ffffff; color: #0f172a; margin: 0; padding: 24px; }
      .page { max-width: 1120px; margin: 0 auto; }
      h1 { font-size: 28px; margin: 0 0 4px; }
      h2 { font-size: 18px; margin: 0 0 18px; color: #2563eb; }
      p { margin: 4px 0; }
      ul { margin: 14px 0 22px; padding-left: 18px; }
      li { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #eff6ff; }
      .empty { margin-top: 24px; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; font-weight: 600; }
      @media print {
        body { padding: 0; }
        .page { max-width: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <h1>${document.companyTitle}</h1>
      <h2>${document.title}</h2>
      <p><strong>Generated:</strong> ${format(document.generatedAt, "dd MMM yyyy hh:mm a")}</p>
      <p><strong>Generated By:</strong> ${document.generatedBy}</p>
      <ul>${filterMarkup}</ul>
      ${
        document.rows.length
          ? `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
          : `<div class="empty">No data found for selected filters.</div>`
      }
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
}

function wrapPdfLine(value: string, maxLength = 100) {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function buildPdfBuffer(document: ReportDocument) {
  const lines: string[] = [];
  lines.push(document.companyTitle);
  lines.push(document.title);
  lines.push(`Generated: ${format(document.generatedAt, "dd MMM yyyy hh:mm a")}`);
  lines.push(`Generated By: ${document.generatedBy}`);
  for (const filter of document.filters) {
    lines.push(`${filter.label}: ${filter.value}`);
  }
  lines.push("");
  lines.push(document.columns.join(" | "));
  lines.push("-".repeat(Math.min(document.columns.join(" | ").length, 110)));
  if (!document.rows.length) {
    lines.push("No data found for selected filters.");
  } else {
    for (const row of document.rows) {
      for (const wrapped of wrapPdfLine(row.join(" | "))) {
        lines.push(wrapped);
      }
    }
  }

  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 40;
  const marginTop = 800;
  const lineHeight = 14;
  const maxLinesPerPage = 52;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }

  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  let nextObjectNumber = 4;
  for (const pageLines of pages) {
    const pageObject = nextObjectNumber++;
    const contentObject = nextObjectNumber++;
    pageObjectNumbers.push(pageObject);
    contentObjectNumbers.push(contentObject);

    const textCommands = pageLines
      .map((line, lineIndex) => {
        const y = marginTop - lineIndex * lineHeight;
        return `1 0 0 1 ${marginLeft} ${y} Tm (${escapePdfText(line)}) Tj`;
      })
      .join("\n");

    const stream = `BT\n/F1 10 Tf\n${textCommands}\nET`;
    objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers.map((item) => `${item} 0 R`).join(" ")}] >>`;

  const maxObjectNumber = objects.length - 1;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, "utf8");
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${maxObjectNumber + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export async function generateReportExport(actor: ReportActor, reportType: ReportTypeKey, formatType: ReportFormat, filters: ReportFilters): Promise<ReportExportResult> {
  const document = await buildReportDocument(actor, reportType, filters);
  const fileDate = format(document.generatedAt, "yyyy-MM-dd");
  const fileName = `${document.slug}-${fileDate}.${formatType === "print" ? "html" : formatType}`;

  if (!document.rows.length) {
    throw new Error("No data found for selected filters.");
  }

  if (formatType === "csv") {
    return {
      buffer: buildCsvBuffer(document),
      contentType: "text/csv; charset=utf-8",
      fileName,
      rowCount: document.rows.length,
      reportTitle: document.title,
    };
  }

  if (formatType === "xlsx") {
    return {
      buffer: buildWorkbookBuffer(document),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName,
      rowCount: document.rows.length,
      reportTitle: document.title,
    };
  }

  if (formatType === "print") {
    return {
      buffer: Buffer.from(buildPrintHtml(document), "utf8"),
      contentType: "text/html; charset=utf-8",
      fileName,
      rowCount: document.rows.length,
      reportTitle: document.title,
    };
  }

  return {
    buffer: buildPdfBuffer(document),
    contentType: "application/pdf",
    fileName,
    rowCount: document.rows.length,
    reportTitle: document.title,
  };
}

export function canWriteLegacyReportLog(reportType: ReportTypeKey): reportType is Extract<ReportTypeKey, "CUSTOMER_COMMUNICATION" | "FOLLOW_UP" | "EMPLOYEE_PERFORMANCE" | "SALES" | "REWARD" | "LEAD_CONVERSION"> {
  return SUPPORTED_REPORT_LOG_TYPES.has(reportType);
}
