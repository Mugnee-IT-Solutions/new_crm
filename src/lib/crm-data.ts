import type { Prisma } from "@prisma/client";
import { addDays, endOfMonth, endOfWeek, format, isBefore, isSameDay, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { getPrisma } from "@/lib/prisma";
import { type Role, type ShellUser } from "@/lib/utils";

export type CrmStat = {
  title: string;
  value: string;
  helper: string;
  tone: string;
};

export type LeadRow = {
  id: string;
  companyId?: string | null;
  title: string;
  company: string;
  phone: string;
  email: string;
  productInterest: string;
  status: string;
  score: number;
  priority: string;
  assignedTo: string;
  followUpDate: string;
  purchaseProbability: number;
  communicationCount: number;
  followUpCount: number;
  salesProgress: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  whatsapp: string;
  industry: string;
  address: string;
  website: string;
  assignedTo: string;
  status: string;
  totalLeads: number;
  lastCommunication: string;
  notes: string;
};

export type TaskRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  companyName?: string | null;
  leadName?: string | null;
  assignedToId?: string | null;
  href?: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  relatedTo: string;
  product: string;
  taskDate: string;
  dueDate: string;
  time: string;
  priority: string;
  status: string;
  isPrevious: boolean;
  completedAt: string;
  completedBy: string;
  reminder: string;
  notes: string;
};

export type TodayPlanRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  href?: string;
  title: string;
  relatedTo: string;
  time: string;
  priority: string;
  status: string;
  note: string;
  section: "today" | "previous" | "completed";
};

export type FollowUpRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  href?: string;
  customer: string;
  lead: string;
  method: string;
  note: string;
  lastCommunicationType: string;
  nextDiscussionPlan: string;
  status: string;
  bucket: "Overdue" | "Due Today" | "Upcoming" | "Completed";
  followUpDate: string;
  assignedTo: string;
  priority: string;
  createdBy: string;
  createdAt: string;
};

export type TodayWorkItem = {
  id: string;
  sourceId: string;
  source: "Follow-up" | "Task" | "Plan";
  companyId?: string | null;
  leadId?: string | null;
  assignedToId?: string | null;
  href?: string;
  title: string;
  relatedTo: string;
  date: string;
  time: string;
  priority: string;
  status: string;
  note: string;
  assignedTo: string;
  overdue: boolean;
};

export type FollowUpDateFilter = "all" | "today" | "tomorrow" | "week" | "month" | "custom" | "overdue" | "completed";

export type FollowUpQuery = {
  search?: string;
  dateFilter?: FollowUpDateFilter;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type FollowUpPageData = {
  rows: FollowUpRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: Required<Pick<FollowUpQuery, "dateFilter">> & Pick<FollowUpQuery, "search" | "from" | "to">;
  summary: {
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
    actionable: number;
  };
};

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  imageUrl: string;
  description: string;
  specification: string;
  status: string;
  interestedCustomers: number;
  communicationCount: number;
  followUpCount: number;
  quotationCount: number;
  salesCount: number;
  conversionRate: number;
};

export type ProductEngagementRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  companyName: string;
  leadName: string;
  communicationType: string;
  lastContactDate: string;
  status: string;
  assignedMarketer: string;
  communicationCount: number;
  followUpCount: number;
  quotationCount: number;
};

export type ProductEngagementData = {
  summary: {
    totalCompaniesContacted: number;
    totalLeadsInterested: number;
    totalCommunicationCount: number;
    followUpCount: number;
    quotationSentCount: number;
    salesCount: number;
    conversionRate: number;
  };
  rows: ProductEngagementRow[];
  filters: {
    from?: string;
    to?: string;
    status?: string;
    communicationType?: string;
    assignedUserId?: string;
  };
  filterOptions: {
    communicationTypes: string[];
    assignedUsers: { id: string; name: string }[];
  };
};

export type ProductIntelligenceItem = {
  id: string;
  name: string;
  category: string;
  communicationCount: number;
  followUpCount: number;
  leadCount: number;
  quotationCount: number;
  salesCount: number;
  conversionRate: number;
  engagementScore: number;
};

export type QuotationRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  quoteNumber: string;
  customer: string;
  product: string;
  amount: number;
  status: string;
  createdBy: string;
  date: string;
};

export type ActivityRow = {
  id: string;
  href?: string;
  title: string;
  detail: string;
  time: string;
};

export type CommunicationHistoryRow = {
  id: string;
  href?: string;
  method: string;
  summary: string;
  discussionTopic: string;
  productDiscussed: string;
  outcome: string;
  rating: string;
  nextFollowUpDate: string;
  notes: string;
  createdBy: string;
  time: string;
};

export type CustomerHistory = {
  tasks: TaskRow[];
  followUps: FollowUpRow[];
  activities: ActivityRow[];
  communications: CommunicationHistoryRow[];
};

export type NotificationRow = {
  id: string;
  href?: string;
  title: string;
  message: string;
  type: string;
  time: string;
  read: boolean;
};

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  status: string;
  leads: number;
  followUps: number;
  sales: number;
  rewardPoints: number;
  conversionRate: string;
};

export type RewardRuleRow = {
  id: string;
  name: string;
  trigger: string;
  points: number;
  active: boolean;
};

export type ImportExportRow = {
  id: string;
  type: string;
  module: string;
  format: string;
  fileName: string;
  status: string;
  processedRows: number;
  failedRows: number;
  createdAt: string;
};

export type PermissionMatrixRow = {
  module: string;
  permissions: Record<string, boolean>;
};

export type CrmWorkspace = {
  user: ShellUser;
  unreadCount: number;
  stats: CrmStat[];
  leads: LeadRow[];
  companies: CompanyRow[];
  tasks: TaskRow[];
  todayPlans: TodayPlanRow[];
  todayWorkItems: TodayWorkItem[];
  followUps: FollowUpRow[];
  products: ProductRow[];
  quotations: QuotationRow[];
  activities: ActivityRow[];
  notifications: NotificationRow[];
  employees: EmployeeRow[];
  rewardRules: RewardRuleRow[];
  importExportLogs: ImportExportRow[];
  reportLogs: ImportExportRow[];
  permissions: PermissionMatrixRow[];
  pipeline: { label: string; value: number; color: string }[];
  productOpportunities: ProductRow[];
  productIntelligence: {
    topEngaged: ProductIntelligenceItem[];
    highestConversion: ProductIntelligenceItem[];
    mostDiscussed: ProductIntelligenceItem[];
  };
  systemSummary: { label: string; value: string }[];
  followUpSummary: {
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
    actionable: number;
  };
  sidebarCounts: {
    followUps: number;
    leads: number;
    customers: number;
    tasks: number;
    todaysPlan: number;
    products: number;
    rewards: number;
  };
};

const leadStatusLabels: Record<string, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
  QUOTATION_SENT: "Quotation Sent",
  NEGOTIATION: "Negotiation",
  WON_SALE: "Won Sale",
  LOST_SALE: "Lost Sale",
  ON_HOLD: "On Hold",
};

const pipelineColors: Record<string, string> = {
  "New Lead": "bg-blue-500",
  Contacted: "bg-cyan-500",
  Interested: "bg-emerald-500",
  "Follow-up Required": "bg-amber-500",
  "Quotation Sent": "bg-indigo-500",
  Negotiation: "bg-violet-500",
  "Won Sale": "bg-green-500",
  "Lost Sale": "bg-red-500",
  "On Hold": "bg-slate-400",
};

function labelize(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(date: Date | null | undefined, pattern = "dd/MM/yyyy") {
  return date ? format(date, pattern) : "-";
}

function money(value: number) {
  return `৳ ${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

function followUpBucket(status: string, date: Date) {
  if (status === "COMPLETED") return "Completed";
  if (status === "OVERDUE") return "Overdue";
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  if (isBefore(target, today)) return "Overdue";
  if (isSameDay(target, today)) return "Due Today";
  return "Upcoming";
}

function progressFromLead(status: string) {
  const order = ["NEW_LEAD", "CONTACTED", "INTERESTED", "FOLLOW_UP_REQUIRED", "QUOTATION_SENT", "NEGOTIATION", "WON_SALE"];
  const index = order.indexOf(status);
  return `${Math.max(12, Math.round(((index + 1) / order.length) * 100))}%`;
}

const taskInclude = {
  assignedTo: true,
  assignedBy: true,
  completedBy: true,
  company: true,
  lead: true,
  product: true,
} satisfies Prisma.TaskInclude;

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

const followUpInclude = {
  company: {
    include: {
      contacts: true,
      phoneNumbers: true,
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
  },
  lead: {
    include: {
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
  },
  assignedTo: true,
  timelineItems: {
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: 1,
  },
} satisfies Prisma.FollowUpInclude;

type FollowUpRecord = Prisma.FollowUpGetPayload<{ include: typeof followUpInclude }>;

const communicationHistoryInclude = {
  user: true,
  company: true,
  lead: true,
  task: true,
} satisfies Prisma.CommunicationLogInclude;

type CommunicationHistoryRecord = Prisma.CommunicationLogGetPayload<{ include: typeof communicationHistoryInclude }>;

const productInclude = {
  interests: {
    include: {
      user: true,
      company: {
        include: {
          assignedTo: true,
          communications: { include: { user: true }, orderBy: { communicationAt: "desc" } },
        },
      },
      lead: {
        include: {
          assignedTo: true,
          company: true,
          communications: { include: { user: true }, orderBy: { communicationAt: "desc" } },
          followUps: true,
          quotations: true,
        },
      },
    },
  },
  leads: {
    include: {
      assignedTo: true,
      company: {
        include: {
          communications: { include: { user: true }, orderBy: { communicationAt: "desc" } },
        },
      },
      communications: { include: { user: true }, orderBy: { communicationAt: "desc" } },
      followUps: true,
      quotations: { include: { items: true, createdBy: true } },
    },
  },
  quoteItems: {
    include: {
      quotation: {
        include: {
          company: true,
          createdBy: true,
          lead: { include: { assignedTo: true, createdBy: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductServiceInclude;

type ProductRecord = Prisma.ProductServiceGetPayload<{ include: typeof productInclude }>;
type ProductLeadRecord = ProductRecord["leads"][number];
type ProductCommunicationRecord = ProductLeadRecord["communications"][number];
type ProductQuoteRecord = ProductRecord["quoteItems"][number]["quotation"];

function linkedEntityHref({ entity, entityId, leadId, companyId, quotationId }: { entity?: string | null; entityId?: string | null; leadId?: string | null; companyId?: string | null; quotationId?: string | null }) {
  if (leadId) return `/leads/${leadId}`;
  if (companyId) return `/customers/${companyId}`;
  if (quotationId) return `/quotations/${quotationId}`;
  if (!entity || !entityId) return undefined;

  const normalized = entity.replace(/[_\s-]/g, "").toUpperCase();
  if (normalized.includes("LEAD")) return `/leads/${entityId}`;
  if (normalized.includes("CUSTOMER") || normalized.includes("COMPANY")) return `/customers/${entityId}`;
  if (normalized.includes("QUOTATION") || normalized.includes("QUOTE")) return `/quotations/${entityId}`;
  if (normalized.includes("PRODUCT")) return `/products/${entityId}`;
  return undefined;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function lastCommunicationType(followUp: FollowUpRecord) {
  const leadCommunication = followUp.lead?.communications[0];
  const companyCommunication = followUp.company?.communications[0];

  if (leadCommunication && companyCommunication) {
    return leadCommunication.communicationAt > companyCommunication.communicationAt ? leadCommunication.method : companyCommunication.method;
  }

  return leadCommunication?.method ?? companyCommunication?.method ?? "-";
}

function mapTaskRow(task: TaskRecord): TaskRow {
  const taskDate = (task as { taskDate?: Date | null }).taskDate ?? task.dueDate ?? task.createdAt;
  const previous = task.status !== "COMPLETED" && ((((task as { isPrevious?: boolean | null }).isPrevious) ?? false) || isBefore(startOfDay(taskDate), startOfDay(new Date())));

  return {
    id: task.id,
    companyId: task.companyId,
    leadId: task.leadId,
    companyName: (task as { companyName?: string | null }).companyName,
    leadName: (task as { leadName?: string | null }).leadName,
    href: linkedEntityHref({ leadId: task.leadId, companyId: task.companyId }),
    title: task.title,
    description: task.description ?? "-",
    assignedToId: task.assignedToId,
    assignedTo: task.assignedTo?.name ?? "-",
    assignedBy: task.assignedBy?.name ?? "-",
    relatedTo: task.company?.name ?? task.lead?.title ?? (task as { companyName?: string | null }).companyName ?? (task as { leadName?: string | null }).leadName ?? "-",
    product: task.product?.name ?? "-",
    taskDate: dateLabel(taskDate),
    dueDate: dateLabel(task.dueDate ?? taskDate),
    time: dateLabel(task.taskTime ?? taskDate, "hh:mm a"),
    priority: labelize(task.priority),
    status: task.status,
    isPrevious: previous,
    completedAt: dateLabel(task.completedAt, "dd/MM/yyyy hh:mm a"),
    completedBy: task.completedBy?.name ?? "-",
    reminder: task.reminder ?? "-",
    notes: task.notes ?? "-",
  };
}

function mapFollowUpRow(followUp: FollowUpRecord): FollowUpRow {
  const bucket = followUpBucket(followUp.status, followUp.followUpDate);
  const followUpPriority = (followUp as { priority?: string }).priority;

  return {
    id: followUp.id,
    companyId: followUp.companyId,
    leadId: followUp.leadId,
    href: linkedEntityHref({ leadId: followUp.leadId, companyId: followUp.companyId }),
    customer: followUp.company?.name ?? followUp.lead?.customerName ?? "-",
    lead: followUp.lead?.title ?? "-",
    method: followUp.method,
    note: followUp.note ?? "-",
    lastCommunicationType: lastCommunicationType(followUp),
    nextDiscussionPlan: followUp.nextDiscussionPlan ?? "-",
    status: bucket,
    bucket,
    followUpDate: dateLabel(followUp.followUpDate),
    assignedTo: followUp.assignedTo?.name ?? "-",
    priority: labelize(followUpPriority ?? "MEDIUM"),
    createdBy: followUp.timelineItems[0]?.user?.name ?? "-",
    createdAt: dateLabel(followUp.createdAt),
  };
}

function mapCommunicationHistoryRow(log: CommunicationHistoryRecord): CommunicationHistoryRow {
  return {
    id: log.id,
    href: linkedEntityHref({ leadId: log.leadId, companyId: log.companyId }),
    method: log.method,
    summary: log.note,
    discussionTopic: (log as { discussionTopic?: string | null }).discussionTopic ?? "-",
    productDiscussed: (log as { productDiscussed?: string | null }).productDiscussed ?? "-",
    outcome: log.outcome ?? "-",
    rating: typeof log.rating === "number" ? String(log.rating) : "-",
    nextFollowUpDate: dateLabel(log.nextFollowUpDate, "dd/MM/yyyy hh:mm a"),
    notes: log.followUpNote ?? "-",
    createdBy: log.user?.name ?? "-",
    time: dateLabel(log.communicationAt, "dd/MM/yyyy hh:mm a"),
  };
}

function combineWhere<T extends object>(...conditions: (T | undefined)[]): T {
  const active = conditions.filter(Boolean) as T[];
  return (active.length ? { AND: active } : {}) as T;
}

function followUpScopeWhere(scopedUserIds: string[] | undefined): Prisma.FollowUpWhereInput {
  return scopedUserIds ? { assignedToId: { in: scopedUserIds } } : {};
}

function followUpSearchWhere(search?: string): Prisma.FollowUpWhereInput | undefined {
  const query = search?.trim();
  if (!query) return undefined;
  const text = { contains: query, mode: "insensitive" } as const;

  return {
    OR: [
      { company: { is: { name: text } } },
      { company: { is: { contacts: { some: { OR: [{ name: text }, { email: text }, { mobile: { contains: query } }, { whatsapp: { contains: query } }] } } } } },
      { company: { is: { phoneNumbers: { some: { number: { contains: query } } } } } },
      { lead: { is: { OR: [{ title: text }, { customerName: text }, { phone: { contains: query } }, { email: text }] } } },
    ],
  };
}

function dateRangeWhere(from?: Date, to?: Date): Prisma.FollowUpWhereInput | undefined {
  if (!from && !to) return undefined;
  return {
    followUpDate: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    },
  };
}

function parseDateStart(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string) {
  const date = parseDateStart(value);
  return date ? addDays(date, 1) : undefined;
}

function productQueryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function normalizeProductEngagementQuery(query: Record<string, unknown> = {}) {
  const status = productQueryValue(query.status)?.trim() || undefined;
  const communicationType = productQueryValue(query.communicationType)?.trim() || undefined;
  const assignedUserId = productQueryValue(query.assignedUserId)?.trim() || undefined;
  return {
    from: productQueryValue(query.from) || undefined,
    to: productQueryValue(query.to) || undefined,
    status: status && status !== "all" ? status : undefined,
    communicationType: communicationType && communicationType !== "all" ? communicationType : undefined,
    assignedUserId: assignedUserId && assignedUserId !== "all" ? assignedUserId : undefined,
  };
}

function userInScope(scopedUserIds: Set<string> | undefined, userId: string | null | undefined) {
  return !scopedUserIds || Boolean(userId && scopedUserIds.has(userId));
}

function leadInScope(lead: ProductLeadRecord, scopedUserIds: Set<string> | undefined) {
  return userInScope(scopedUserIds, lead.assignedToId) || userInScope(scopedUserIds, lead.createdById);
}

function followUpInScope(followUp: ProductLeadRecord["followUps"][number], scopedUserIds: Set<string> | undefined) {
  return userInScope(scopedUserIds, followUp.assignedToId);
}

function quotationInScope(quotation: ProductQuoteRecord, scopedUserIds: Set<string> | undefined) {
  return (
    userInScope(scopedUserIds, quotation.createdById) ||
    userInScope(scopedUserIds, quotation.lead?.assignedToId) ||
    userInScope(scopedUserIds, quotation.lead?.createdById)
  );
}

function leadStatusGroup(status: string) {
  if (status === "WON_SALE") return "Won";
  if (status === "LOST_SALE") return "Lost";
  if (status === "NEGOTIATION") return "Negotiation";
  if (["INTERESTED", "FOLLOW_UP_REQUIRED", "QUOTATION_SENT"].includes(status)) return "Interested";
  return labelize(status);
}

function collectLeadCommunications(lead: ProductLeadRecord) {
  const items = new Map<string, ProductCommunicationRecord>();

  for (const communication of lead.communications) {
    items.set(communication.id, communication);
  }

  for (const communication of lead.company?.communications ?? []) {
    if (!communication.leadId || communication.leadId === lead.id) {
      items.set(communication.id, communication);
    }
  }

  return Array.from(items.values()).sort((a, b) => b.communicationAt.getTime() - a.communicationAt.getTime());
}

function communicationMatchesFilters(communication: ProductCommunicationRecord, filters: ReturnType<typeof normalizeProductEngagementQuery>) {
  const from = parseDateStart(filters.from);
  const to = parseDateEnd(filters.to);
  if (filters.communicationType && communication.method !== filters.communicationType) return false;
  if (from && communication.communicationAt < from) return false;
  if (to && communication.communicationAt >= to) return false;
  return true;
}

function buildProductEngagement(product: ProductRecord, scopedUserIds?: string[], rawQuery?: Record<string, unknown>): ProductEngagementData {
  const filters = normalizeProductEngagementQuery(rawQuery);
  const scope = scopedUserIds ? new Set(scopedUserIds) : undefined;
  const scopedLeads = product.leads.filter((lead) => leadInScope(lead, scope));
  const scopedLeadIds = new Set(scopedLeads.map((lead) => lead.id));
  const scopedQuoteItems = product.quoteItems.filter((item) => quotationInScope(item.quotation, scope));
  const communicationIds = new Set<string>();
  const companyIds = new Set<string>();
  const assignedUsers = new Map<string, string>();
  const communicationTypes = new Set<string>();
  const convertedLeadIds = new Set<string>();

  for (const lead of scopedLeads) {
    if (lead.companyId) companyIds.add(lead.companyId);
    if (lead.assignedToId && lead.assignedTo) assignedUsers.set(lead.assignedToId, lead.assignedTo.name);
    if (lead.status === "WON_SALE") convertedLeadIds.add(lead.id);
    for (const communication of collectLeadCommunications(lead)) {
      communicationIds.add(communication.id);
      communicationTypes.add(communication.method);
    }
  }

  for (const interest of product.interests) {
    const linkedLeadAllowed = interest.leadId ? scopedLeadIds.has(interest.leadId) : false;
    const standaloneAllowed = !interest.leadId && (userInScope(scope, interest.userId) || userInScope(scope, interest.company?.assignedToId));
    if (!linkedLeadAllowed && !standaloneAllowed) continue;
    if (interest.companyId) companyIds.add(interest.companyId);
    if (interest.userId && interest.user) assignedUsers.set(interest.userId, interest.user.name);
    if (interest.company?.assignedToId && interest.company.assignedTo) assignedUsers.set(interest.company.assignedToId, interest.company.assignedTo.name);
    for (const communication of interest.company?.communications ?? []) {
      if (!interest.leadId && !communication.leadId) {
        communicationIds.add(communication.id);
        communicationTypes.add(communication.method);
      }
    }
  }

  for (const item of scopedQuoteItems) {
    if (item.quotation.status === "CONVERTED_TO_SALE" && item.quotation.leadId && scopedLeadIds.has(item.quotation.leadId)) {
      convertedLeadIds.add(item.quotation.leadId);
    }
  }

  const followUpCount = scopedLeads.reduce((sum, lead) => sum + lead.followUps.filter((followUp) => followUpInScope(followUp, scope)).length, 0);
  const quotationSentCount = new Set(
    scopedQuoteItems
      .filter((item) => item.quotation.status !== "DRAFT")
      .map((item) => item.quotation.id),
  ).size;
  const rowsWithSort = scopedLeads
    .filter((lead) => !filters.status || leadStatusGroup(lead.status) === filters.status)
    .filter((lead) => !filters.assignedUserId || lead.assignedToId === filters.assignedUserId)
    .map((lead) => {
      const communications = collectLeadCommunications(lead);
      const filteredCommunications = communications.filter((communication) => communicationMatchesFilters(communication, filters));
      const communicationFilterActive = Boolean(filters.from || filters.to || filters.communicationType);
      if (communicationFilterActive && filteredCommunications.length === 0) return undefined;

      const lastContact = filteredCommunications[0] ?? communications[0];
      const leadQuotations = new Set(scopedQuoteItems.filter((item) => item.quotation.leadId === lead.id).map((item) => item.quotation.id));

      return {
        id: `lead-${lead.id}`,
        companyId: lead.companyId,
        leadId: lead.id,
        companyName: lead.company?.name ?? lead.customerName,
        leadName: lead.title,
        communicationType: lastContact?.method ?? "-",
        lastContactDate: dateLabel(lastContact?.communicationAt),
        status: leadStatusGroup(lead.status),
        assignedMarketer: lead.assignedTo?.name ?? "-",
        communicationCount: communications.length,
        followUpCount: lead.followUps.filter((followUp) => followUpInScope(followUp, scope)).length,
        quotationCount: leadQuotations.size,
        lastContactAt: lastContact?.communicationAt ?? new Date(0),
      };
    })
    .filter(Boolean) as (ProductEngagementRow & { lastContactAt: Date })[];

  const standaloneInterestRows = product.interests
    .filter((interest) => !interest.leadId && interest.company)
    .filter(() => !filters.status || filters.status === "Interested")
    .filter((interest) => !filters.assignedUserId || interest.userId === filters.assignedUserId || interest.company?.assignedToId === filters.assignedUserId)
    .filter((interest) => userInScope(scope, interest.userId) || userInScope(scope, interest.company?.assignedToId))
    .map((interest) => {
      const communications = (interest.company?.communications ?? []).filter((communication) => !communication.leadId);
      const filteredCommunications = communications.filter((communication) => communicationMatchesFilters(communication, filters));
      const communicationFilterActive = Boolean(filters.from || filters.to || filters.communicationType);
      if (communicationFilterActive && filteredCommunications.length === 0) return undefined;
      const lastContact = filteredCommunications[0] ?? communications[0];

      return {
        id: `interest-${interest.id}`,
        companyId: interest.companyId,
        leadId: null,
        companyName: interest.company?.name ?? "-",
        leadName: "-",
        communicationType: lastContact?.method ?? "-",
        lastContactDate: dateLabel(lastContact?.communicationAt),
        status: "Interested",
        assignedMarketer: interest.user?.name ?? interest.company?.assignedTo?.name ?? "-",
        communicationCount: communications.length,
        followUpCount: 0,
        quotationCount: 0,
        lastContactAt: lastContact?.communicationAt ?? new Date(0),
      };
    })
    .filter(Boolean) as (ProductEngagementRow & { lastContactAt: Date })[];

  const rows = [...rowsWithSort, ...standaloneInterestRows]
    .sort((a, b) => b.lastContactAt.getTime() - a.lastContactAt.getTime())
    .map((item) => ({
      id: item.id,
      companyId: item.companyId,
      leadId: item.leadId,
      companyName: item.companyName,
      leadName: item.leadName,
      communicationType: item.communicationType,
      lastContactDate: item.lastContactDate,
      status: item.status,
      assignedMarketer: item.assignedMarketer,
      communicationCount: item.communicationCount,
      followUpCount: item.followUpCount,
      quotationCount: item.quotationCount,
    }));

  return {
    summary: {
      totalCompaniesContacted: companyIds.size,
      totalLeadsInterested: scopedLeads.length,
      totalCommunicationCount: communicationIds.size,
      followUpCount,
      quotationSentCount,
      salesCount: convertedLeadIds.size,
      conversionRate: scopedLeads.length ? Math.round((convertedLeadIds.size / scopedLeads.length) * 100) : 0,
    },
    rows,
    filters,
    filterOptions: {
      communicationTypes: Array.from(communicationTypes).sort(),
      assignedUsers: Array.from(assignedUsers.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

function followUpSummaryWhere(baseWhere: Prisma.FollowUpWhereInput, today = startOfDay(new Date())) {
  const tomorrow = addDays(today, 1);
  return {
    overdue: combineWhere(baseWhere, { status: { not: "COMPLETED" }, OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }] }),
    today: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] }, followUpDate: { gte: today, lt: tomorrow } }),
    upcoming: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] }, followUpDate: { gte: tomorrow } }),
    completed: combineWhere(baseWhere, { status: "COMPLETED" }),
  };
}

async function countFollowUpSummary(prisma: ReturnType<typeof getPrisma>, baseWhere: Prisma.FollowUpWhereInput) {
  const where = followUpSummaryWhere(baseWhere);
  const [overdue, today, upcoming, completed] = await Promise.all([
    prisma.followUp.count({ where: where.overdue }),
    prisma.followUp.count({ where: where.today }),
    prisma.followUp.count({ where: where.upcoming }),
    prisma.followUp.count({ where: where.completed }),
  ]);

  return { overdue, today, upcoming, completed, actionable: overdue + today + upcoming };
}

function isPermissionFoundationUnavailable(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");
  const code = String((error as { code?: string })?.code ?? "");
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("does not exist") ||
    message.includes("no such table") ||
    message.includes("relation") && message.includes("missing")
  );
}

async function safePermissionCount(prisma: ReturnType<typeof getPrisma>) {
  try {
    return await prisma.permission.count();
  } catch (error) {
    if (isPermissionFoundationUnavailable(error)) {
      console.warn("Permission foundation unavailable during startup; defaulting permission count to 0.");
      return 0;
    }
    throw error;
  }
}

async function safeSeedPermissions(prisma: ReturnType<typeof getPrisma>) {
  const modules = [
    "DASHBOARD",
    "LEADS",
    "CUSTOMERS",
    "TASKS",
    "FOLLOW_UPS",
    "COMMUNICATIONS",
    "PRODUCTS",
    "QUOTATIONS",
    "REWARDS",
    "REPORTS",
    "TEAM",
    "USERS",
    "SETTINGS",
    "IMPORT_EXPORT",
    "NOTIFICATIONS",
  ] as const;
  const actions = ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "REASSIGN", "IMPORT", "EXPORT", "DOWNLOAD_REPORT"] as const;

  await prisma.permission.createMany({
    data: modules.flatMap((module) => actions.map((action) => ({ module, action, label: `${labelize(module)} ${labelize(action)}` }))),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: permissions.flatMap((permission) => [
      { role: "ADMIN", permissionId: permission.id, enabled: true },
      { role: "SUPERVISOR", permissionId: permission.id, enabled: !["USERS", "SETTINGS"].includes(permission.module) || permission.action === "VIEW" },
      {
        role: "MARKETER",
        permissionId: permission.id,
        enabled:
          ["DASHBOARD", "LEADS", "CUSTOMERS", "TASKS", "FOLLOW_UPS", "COMMUNICATIONS", "PRODUCTS", "QUOTATIONS", "REWARDS", "REPORTS", "NOTIFICATIONS"].includes(permission.module) &&
          !["DELETE", "REASSIGN", "IMPORT", "EXPORT", "DOWNLOAD_REPORT"].includes(permission.action),
      },
    ]),
    skipDuplicates: true,
  });
}

async function ensureCrmFoundation() {
  const prisma = getPrisma();
  const permissionCount = await safePermissionCount(prisma);

  if (permissionCount === 0) {
    try {
      await safeSeedPermissions(prisma);
    } catch (error) {
      if (!isPermissionFoundationUnavailable(error)) {
        throw error;
      }
      console.warn("Permission foundation seeding skipped because permission tables are not yet synced.");
    }
  }

  const rewardRuleCount = await prisma.rewardRule.count();
  if (rewardRuleCount === 0) {
    await prisma.rewardRule.createMany({
      data: [
        { name: "Lead Added", trigger: "LEAD_CREATED", points: 10 },
        { name: "Follow-up Completed", trigger: "FOLLOW_UP_COMPLETED", points: 20 },
        { name: "Meeting Scheduled", trigger: "MEETING_SCHEDULED", points: 15 },
        { name: "Sale Won", trigger: "WON_SALE", points: 100 },
      ],
      skipDuplicates: true,
    });
  }
}

async function getScopedUserIds(role: Role, user: ShellUser) {
  if (role === "ADMIN") return undefined;
  if (!user.id) return [];
  if (role === "MARKETER") return [user.id];

  const prisma = getPrisma();
  const team = await prisma.user.findMany({
    where: { supervisorId: user.id, status: "ACTIVE" },
    select: { id: true },
  });

  return [user.id, ...team.map((member) => member.id)];
}

export async function getCrmWorkspace(role: Role, user: ShellUser): Promise<CrmWorkspace> {
  const prisma = getPrisma();
  await ensureCrmFoundation();
  const scopedUserIds = await getScopedUserIds(role, user);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const leadWhere = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { createdById: { in: scopedUserIds } },
        ],
      }
    : {};

  const companyWhere = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { leads: { some: { OR: [{ assignedToId: { in: scopedUserIds } }, { createdById: { in: scopedUserIds } }] } } },
          { followUps: { some: { assignedToId: { in: scopedUserIds } } } },
          ...(role === "SUPERVISOR" ? [{ communications: { some: { userId: { in: scopedUserIds } } } }] : []),
        ],
      }
    : {};

  const taskWhere: Prisma.TaskWhereInput = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { assignedById: { in: scopedUserIds } },
        ],
      }
    : {};

  const planWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const followUpWhere = followUpScopeWhere(scopedUserIds);
  const quotationWhere = scopedUserIds
    ? {
        OR: [
          { createdById: { in: scopedUserIds } },
          { lead: { assignedToId: { in: scopedUserIds } } },
        ],
      }
    : {};
  const activityWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const planWidgetWhere = (planWhere
    ? { ...planWhere, status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } }
    : { status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } }) as Prisma.TodayPlanWhereInput;
  const activeTaskBadgeWhere = combineWhere(taskWhere, { status: { not: "COMPLETED" } });
  const todayTaskBadgeWhere = combineWhere(activeTaskBadgeWhere, { taskDate: { lt: tomorrow } });
  const followUpBadgeWhere = combineWhere(followUpWhere, {
    status: { not: "COMPLETED" },
    OR: [
      { status: { in: ["DUE", "TODAY", "OVERDUE"] } },
      { followUpDate: { lt: tomorrow } },
    ],
  });
  const rewardWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};

  const [
    leads,
    companies,
    tasks,
    todayPlans,
    followUps,
    products,
    quotations,
    activities,
    timeline,
    notifications,
    employees,
    rewardRules,
    importLogs,
    reportLogs,
    leadCount,
    customerCount,
    todaysPlanCount,
    activeTaskBadgeCount,
    todayTaskBadgeCount,
    followUpBadgeCount,
    activeProductCount,
    rewardAggregate,
    permissions,
    rolePermissions,
    rewardSums,
    followUpSummaryCounts,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere,
      include: {
        company: { include: { contacts: true } },
        interestedProduct: true,
        assignedTo: true,
        communications: true,
        followUps: true,
        quotations: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.customerCompany.findMany({
      where: companyWhere,
      include: {
        assignedTo: true,
        contacts: true,
        phoneNumbers: true,
        leads: true,
        communications: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.task.findMany({
      where: taskWhere,
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.todayPlan.findMany({
      where: planWhere,
      include: { user: true, company: true, lead: true, product: true },
      orderBy: { plannedAt: "asc" },
      take: 200,
    }),
    prisma.followUp.findMany({
      where: followUpWhere,
      include: followUpInclude,
      orderBy: { followUpDate: "asc" },
      take: 200,
    }),
    prisma.productService.findMany({
      include: productInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.quotation.findMany({
      where: quotationWhere,
      include: { company: true, lead: true, createdBy: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.activityLog.findMany({
      where: activityWhere,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.activityTimeline.findMany({
      where: activityWhere,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.findMany({
      where: scopedUserIds ? { recipientId: { in: scopedUserIds } } : {},
      include: { followUp: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: role === "ADMIN" ? {} : scopedUserIds ? { id: { in: scopedUserIds } } : {},
      include: { assignedLeads: true, followUps: true, rewards: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.rewardRule.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.importExportLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.reportLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.lead.count({ where: leadWhere }),
    prisma.customerCompany.count({ where: companyWhere }),
    prisma.todayPlan.count({ where: planWidgetWhere }),
    prisma.task.count({ where: activeTaskBadgeWhere }),
    prisma.task.count({ where: todayTaskBadgeWhere }),
    prisma.followUp.count({ where: followUpBadgeWhere }),
    prisma.productService.count({ where: { status: "ACTIVE" } }),
    prisma.reward.aggregate({ where: rewardWhere, _sum: { points: true } }),
    (async () => {
      try {
        return await prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
      } catch (error) {
        if (isPermissionFoundationUnavailable(error)) {
          console.warn("Permission data unavailable during dashboard load; defaulting to no permissions.");
          return [];
        }
        throw error;
      }
    })(),
    (async () => {
      try {
        return await prisma.rolePermission.findMany({ where: { role }, include: { permission: true } });
      } catch (error) {
        if (isPermissionFoundationUnavailable(error)) {
          console.warn("Role permission data unavailable during dashboard load; defaulting to empty permission grants.");
          return [];
        }
        throw error;
      }
    })(),
    prisma.reward.groupBy({ by: ["userId"], _sum: { points: true } }),
    countFollowUpSummary(prisma, followUpWhere),
  ]);

  const rewardByUser = new Map(rewardSums.map((item) => [item.userId, item._sum.points ?? 0]));

  const leadRows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    companyId: lead.companyId,
    title: lead.title,
    company: lead.company?.name ?? lead.customerName,
    phone: lead.phone,
    email: lead.email ?? "-",
    productInterest: lead.interestedProduct?.name ?? "-",
    status: leadStatusLabels[lead.status] ?? labelize(lead.status),
    score: lead.score,
    priority: labelize(lead.priority),
    assignedTo: lead.assignedTo?.name ?? "-",
    followUpDate: dateLabel(lead.followUpDate),
    purchaseProbability: lead.purchaseProbability,
    communicationCount: lead.communications.length,
    followUpCount: lead.followUps.length,
    salesProgress: progressFromLead(lead.status),
  }));

  const companyRows: CompanyRow[] = companies.map((company) => {
    const primary = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
    const whatsapp = company.phoneNumbers.find((phone) => phone.whatsapp);
    const regular = company.phoneNumbers[0];

    return {
      id: company.id,
      name: company.name,
      contactPerson: company.contactPerson ?? primary?.name ?? "-",
      email: primary?.email ?? "-",
      phone: company.phone || primary?.mobile || regular?.number || "-",
      whatsapp: primary?.whatsapp ?? whatsapp?.number ?? "-",
      industry: company.industry,
      address: company.address ?? "-",
      website: company.website ?? "-",
      assignedTo: company.assignedTo?.name ?? "-",
      status: labelize(company.status),
      totalLeads: Math.max(company.totalLeads, company.leads.length),
      lastCommunication: dateLabel(company.lastCommunication ?? company.communications[0]?.createdAt),
      notes: company.notes ?? "-",
    };
  });

  const taskRows: TaskRow[] = tasks.map(mapTaskRow);

  const planRows: TodayPlanRow[] = todayPlans.map((plan) => {
    const completed = plan.status === "COMPLETED";
    const previous = isBefore(startOfDay(plan.plannedAt), today) && !completed;

    return {
      id: plan.id,
      companyId: plan.companyId,
      leadId: plan.leadId,
      href: linkedEntityHref({ leadId: plan.leadId, companyId: plan.companyId }),
      title: plan.title,
      relatedTo: plan.company?.name ?? plan.lead?.title ?? plan.product?.name ?? "-",
      time: dateLabel(plan.plannedAt, "hh:mm a"),
      priority: labelize(plan.priority),
      status: plan.status,
      note: plan.note ?? "-",
      section: completed ? "completed" : previous || plan.carryForward ? "previous" : "today",
    };
  });

  const followUpRows: FollowUpRow[] = followUps.map(mapFollowUpRow);
  const todayWorkWithSort = [
    ...followUps
      .filter((followUp) => followUp.status !== "COMPLETED" && (followUp.status === "OVERDUE" || isBefore(followUp.followUpDate, tomorrow)))
      .map((followUp) => {
        const targetDay = startOfDay(followUp.followUpDate);
        const overdue = followUp.status === "OVERDUE" || isBefore(targetDay, today);

        return {
          id: `follow-up-${followUp.id}`,
          sourceId: followUp.id,
          source: "Follow-up" as const,
    companyId: followUp.companyId,
        leadId: followUp.leadId,
          assignedToId: followUp.assignedToId,
          href: linkedEntityHref({ leadId: followUp.leadId, companyId: followUp.companyId }),
          title: followUp.note ?? `${followUp.method} follow-up`,
          relatedTo: followUp.company?.name ?? followUp.lead?.title ?? followUp.lead?.customerName ?? "-",
          date: dateLabel(followUp.followUpDate),
          time: dateLabel(followUp.followUpDate, "hh:mm a"),
          priority: labelize((followUp as { priority?: string }).priority ?? "MEDIUM"),
          status: overdue ? "Overdue" : "Due Today",
          note: followUp.nextDiscussionPlan ?? followUp.note ?? "-",
          assignedTo: followUp.assignedTo?.name ?? "-",
          overdue,
          sortRank: overdue ? 0 : 1,
          sortDate: followUp.followUpDate,
        };
      }),
    ...tasks
      .filter((task) => {
        const taskDate = (task as { taskDate?: Date | null }).taskDate ?? task.dueDate ?? task.updatedAt;
        return task.status !== "COMPLETED" && (task.status === "OVERDUE" || isBefore(taskDate, tomorrow));
      })
      .map((task) => {
        const dueDate = (task as { taskDate?: Date | null }).taskDate ?? task.dueDate ?? task.updatedAt;
        const overdue = task.status === "OVERDUE" || (((task as { isPrevious?: boolean | null }).isPrevious) ?? false) || isBefore(startOfDay(dueDate), today);

        return {
          id: `task-${task.id}`,
          sourceId: task.id,
          source: "Task" as const,
          companyId: task.companyId,
          leadId: task.leadId,
          assignedToId: task.assignedToId,
          href: linkedEntityHref({ leadId: task.leadId, companyId: task.companyId }),
          title: task.title,
          relatedTo: task.company?.name ?? task.lead?.title ?? (task as { companyName?: string | null }).companyName ?? (task as { leadName?: string | null }).leadName ?? "-",
          date: dateLabel(dueDate),
          time: dateLabel(task.taskTime ?? dueDate, "hh:mm a"),
          priority: labelize(task.priority),
          status: overdue ? "Overdue" : labelize(task.status),
          note: task.description ?? task.notes ?? "-",
          assignedTo: task.assignedTo?.name ?? "-",
          overdue,
          sortRank: overdue ? 0 : 2,
          sortDate: dueDate,
        };
      }),
    ...todayPlans
      .filter((plan) => plan.status !== "COMPLETED" && isBefore(plan.plannedAt, tomorrow))
      .map((plan) => {
        const overdue = plan.status === "OVERDUE" || isBefore(startOfDay(plan.plannedAt), today) || plan.carryForward;

        return {
          id: `plan-${plan.id}`,
          sourceId: plan.id,
          source: "Plan" as const,
          companyId: plan.companyId,
          leadId: plan.leadId,
          assignedToId: plan.userId,
          href: linkedEntityHref({ leadId: plan.leadId, companyId: plan.companyId }),
          title: plan.title,
          relatedTo: plan.company?.name ?? plan.lead?.title ?? plan.product?.name ?? "-",
          date: dateLabel(plan.plannedAt),
          time: dateLabel(plan.plannedAt, "hh:mm a"),
          priority: labelize(plan.priority),
          status: overdue ? "Overdue" : labelize(plan.status),
          note: plan.note ?? "-",
          assignedTo: plan.user?.name ?? "-",
          overdue,
          sortRank: overdue ? 0 : 3,
          sortDate: plan.plannedAt,
        };
      }),
  ];
  const todayWorkItems: TodayWorkItem[] = todayWorkWithSort
    .sort((a, b) => a.sortRank - b.sortRank || a.sortDate.getTime() - b.sortDate.getTime())
    .map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      source: item.source,
      companyId: item.companyId,
      leadId: item.leadId,
      assignedToId: item.assignedToId,
      href: item.href,
      title: item.title,
      relatedTo: item.relatedTo,
      date: item.date,
      time: item.time,
      priority: item.priority,
      status: item.status,
      note: item.note,
      assignedTo: item.assignedTo,
      overdue: item.overdue,
    }));

  const quotationRows: QuotationRow[] = quotations.map((quotation) => ({
    id: quotation.id,
    companyId: quotation.companyId,
    leadId: quotation.leadId,
    quoteNumber: quotation.quoteNumber,
    customer: quotation.company?.name ?? quotation.lead?.customerName ?? "-",
    product: quotation.items[0]?.description ?? "-",
    amount: Number(quotation.totalAmount),
    status: labelize(quotation.status),
    createdBy: quotation.createdBy?.name ?? "-",
    date: dateLabel(quotation.createdAt),
  }));

  const productMetrics = products.map((product) => ({ product, engagement: buildProductEngagement(product, scopedUserIds) }));
  const productRows: ProductRow[] = productMetrics.map(({ product, engagement }) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand ?? "-",
    price: Number(product.price),
    imageUrl: product.imageUrl ?? "",
    description: product.description ?? "-",
    specification: product.specification ?? "-",
    status: labelize(product.status),
    interestedCustomers: engagement.summary.totalCompaniesContacted,
    communicationCount: engagement.summary.totalCommunicationCount,
    followUpCount: engagement.summary.followUpCount,
    quotationCount: engagement.summary.quotationSentCount,
    salesCount: engagement.summary.salesCount,
    conversionRate: engagement.summary.conversionRate,
  }));
  const productIntelligenceItems: ProductIntelligenceItem[] = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    communicationCount: product.communicationCount,
    followUpCount: product.followUpCount,
    leadCount: product.interestedCustomers,
    quotationCount: product.quotationCount,
    salesCount: product.salesCount,
    conversionRate: product.conversionRate,
    engagementScore: product.communicationCount + product.followUpCount + product.quotationCount + product.interestedCustomers,
  }));
  const productIntelligence = {
    topEngaged: [...productIntelligenceItems].sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 5),
    highestConversion: [...productIntelligenceItems].filter((item) => item.leadCount > 0).sort((a, b) => b.conversionRate - a.conversionRate || b.salesCount - a.salesCount).slice(0, 5),
    mostDiscussed: [...productIntelligenceItems].sort((a, b) => b.communicationCount - a.communicationCount).slice(0, 5),
  };

  const mergedActivities: ActivityRow[] = [
    ...timeline.map((item) => ({
      id: item.id,
      href: linkedEntityHref({ entity: item.entity, entityId: item.entityId, leadId: item.leadId, companyId: item.companyId }),
      title: item.title,
      detail: item.description ?? `${item.entity} activity${item.user?.name ? ` by ${item.user.name}` : ""}`,
      time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    })),
    ...activities.map((item) => ({
      id: item.id,
      href: linkedEntityHref({ entity: item.entity, entityId: item.entityId }),
      title: item.action,
      detail: `${item.entity}${item.user?.name ? ` by ${item.user.name}` : ""}`,
      time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    })),
  ].slice(0, 12);

  const notificationRows: NotificationRow[] = notifications.map((item) => ({
    id: item.id,
    href: linkedEntityHref({ entity: item.entity, entityId: item.entityId, leadId: item.followUp?.leadId, companyId: item.followUp?.companyId }),
    title: item.title,
    message: item.message,
    type: labelize(item.type),
    time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    read: Boolean(item.readAt),
  }));

  const employeeRows: EmployeeRow[] = employees.map((employee) => {
    const won = employee.assignedLeads.filter((lead) => lead.status === "WON_SALE").length;
    const total = employee.assignedLeads.length;

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email ?? "-",
      mobile: employee.mobile,
      role: labelize(employee.role),
      status: labelize(employee.status),
      leads: total,
      followUps: employee.followUps.length,
      sales: won,
      rewardPoints: rewardByUser.get(employee.id) ?? employee.rewards.reduce((sum, reward) => sum + reward.points, 0),
      conversionRate: total ? `${Math.round((won / total) * 100)}%` : "0%",
    };
  });

  const pipeline = Object.values(leadStatusLabels).map((label) => ({
    label,
    value: leadRows.filter((lead) => lead.status === label).length,
    color: pipelineColors[label] ?? "bg-slate-400",
  }));

  const followUpSummary = followUpSummaryCounts;

  const pendingTasks = taskRows.filter((task) => task.status !== "COMPLETED").length;
  const wonSales = leadRows.filter((lead) => lead.status === "Won Sale").length;
  const conversion = leadRows.length ? Math.round((wonSales / leadRows.length) * 100) : 0;
  const totalRevenue = quotationRows.reduce((sum, quotation) => sum + quotation.amount, 0);
  const rewardPoints = role === "MARKETER" && user.id ? rewardByUser.get(user.id) ?? 0 : employeeRows.reduce((sum, row) => sum + row.rewardPoints, 0);
  const includesMeeting = (...values: (string | null | undefined)[]) => values.some((value) => value?.toLowerCase().includes("meeting"));
  const meetingsToday =
    followUps.filter((followUp) => followUp.status !== "COMPLETED" && isSameDay(followUp.followUpDate, today) && includesMeeting(followUp.method, followUp.note, followUp.nextDiscussionPlan)).length +
    tasks.filter((task) => task.status !== "COMPLETED" && task.dueDate && isSameDay(task.dueDate, today) && includesMeeting(task.title, task.description, task.notes)).length +
    todayPlans.filter((plan) => plan.status !== "COMPLETED" && isSameDay(plan.plannedAt, today) && includesMeeting(plan.title, plan.note)).length;

  const stats =
    role === "MARKETER"
      ? [
          { title: "Today's Tasks", value: String(todayWorkItems.length), helper: "Unified work queue", tone: "bg-blue-100 text-blue-700" },
          { title: "Pending Tasks", value: String(pendingTasks), helper: "Need completion", tone: "bg-red-100 text-red-700" },
          { title: "Follow-ups Due", value: String(followUpSummary.overdue + followUpSummary.today), helper: "Overdue and today", tone: "bg-indigo-100 text-indigo-700" },
          { title: "New Leads", value: String(leadRows.filter((lead) => lead.status === "New Lead").length), helper: "Assigned leads", tone: "bg-emerald-100 text-emerald-700" },
          { title: "Meetings Today", value: String(meetingsToday), helper: "Scheduled meetings", tone: "bg-orange-100 text-orange-700" },
          { title: "Reward Points", value: String(rewardPoints), helper: "This month", tone: "bg-amber-100 text-amber-700" },
        ]
      : role === "SUPERVISOR"
        ? [
            { title: "Total Marketers", value: String(employeeRows.filter((row) => row.role === "Marketer").length), helper: "Under supervision", tone: "bg-blue-100 text-blue-700" },
            { title: "Total Leads", value: String(leadRows.length), helper: "Team pipeline", tone: "bg-indigo-100 text-indigo-700" },
            { title: "Follow-up Due", value: String(followUpSummary.today), helper: "Due today", tone: "bg-amber-100 text-amber-700" },
            { title: "Overdue Follow-ups", value: String(followUpSummary.overdue), helper: "Needs attention", tone: "bg-red-100 text-red-700" },
            { title: "Sales This Month", value: money(totalRevenue), helper: "Quotation value", tone: "bg-emerald-100 text-emerald-700" },
            { title: "Conversion Rate", value: `${conversion}%`, helper: "Won vs leads", tone: "bg-violet-100 text-violet-700" },
          ]
        : [
            { title: "Total Users", value: String(employeeRows.length), helper: "System users", tone: "bg-blue-100 text-blue-700" },
            { title: "Total Customers", value: String(companyRows.length), helper: "Active companies", tone: "bg-emerald-100 text-emerald-700" },
            { title: "Total Leads", value: String(leadRows.length), helper: "All pipeline", tone: "bg-indigo-100 text-indigo-700" },
            { title: "Revenue", value: money(totalRevenue), helper: "Quotation value", tone: "bg-amber-100 text-amber-700" },
            { title: "Lead Conversion", value: `${conversion}%`, helper: "Won vs leads", tone: "bg-violet-100 text-violet-700" },
            { title: "Reward Points", value: String(rewardPoints), helper: "Distributed", tone: "bg-red-100 text-red-700" },
          ];

  const rolePermissionIds = new Set(rolePermissions.filter((item) => item.enabled).map((item) => item.permissionId));
  const permissionRows = Array.from(new Set(permissions.map((item) => item.module))).map((module) => ({
    module: labelize(module),
    permissions: permissions
      .filter((permission) => permission.module === module)
      .reduce<Record<string, boolean>>((acc, permission) => {
        acc[labelize(permission.action)] = rolePermissionIds.has(permission.id);
        return acc;
      }, {}),
  }));

  return {
    user,
    unreadCount: notificationRows.filter((item) => !item.read).length,
    stats,
    leads: leadRows,
    companies: companyRows,
    tasks: taskRows,
    todayPlans: planRows,
    todayWorkItems,
    followUps: followUpRows,
    products: productRows,
    quotations: quotationRows,
    activities: mergedActivities,
    notifications: notificationRows,
    employees: employeeRows,
    rewardRules: rewardRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      points: rule.points,
      active: rule.active,
    })),
    importExportLogs: importLogs.map((item) => ({
      id: item.id,
      type: labelize(item.type),
      module: labelize(item.module),
      format: labelize(item.format),
      fileName: item.fileName ?? "-",
      status: labelize(item.status),
      processedRows: item.processedRows,
      failedRows: item.failedRows,
      createdAt: dateLabel(item.createdAt),
    })),
    reportLogs: reportLogs.map((item) => ({
      id: item.id,
      type: "Export",
      module: labelize(item.reportType),
      format: labelize(item.format),
      fileName: item.fileUrl ?? "-",
      status: labelize(item.status),
      processedRows: 0,
      failedRows: 0,
      createdAt: dateLabel(item.createdAt),
    })),
    permissions: permissionRows,
    pipeline,
    productOpportunities: [...productRows].sort((a, b) => b.interestedCustomers - a.interestedCustomers).slice(0, 8),
    productIntelligence,
    systemSummary: [
      { label: "Active Users", value: String(employeeRows.filter((row) => row.status === "Active").length) },
      { label: "Open Tasks", value: String(pendingTasks) },
      { label: "Unread Notifications", value: String(notificationRows.filter((item) => !item.read).length) },
      { label: "Report Logs", value: String(reportLogs.length) },
    ],
    followUpSummary,
    sidebarCounts: {
      followUps: followUpBadgeCount,
      leads: leadCount,
      customers: customerCount,
      tasks: activeTaskBadgeCount,
      todaysPlan: todaysPlanCount + todayTaskBadgeCount + followUpBadgeCount,
      products: activeProductCount,
      rewards: rewardAggregate._sum.points ?? 0,
    },
  };
}

const followUpDateFilters: FollowUpDateFilter[] = ["all", "today", "tomorrow", "week", "month", "custom", "overdue", "completed"];

function queryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function normalizeFollowUpQuery(query: FollowUpQuery | Record<string, unknown> = {}) {
  const rawDateFilter = queryValue(query.dateFilter);
  const dateFilter = rawDateFilter && followUpDateFilters.includes(rawDateFilter as FollowUpDateFilter) ? rawDateFilter as FollowUpDateFilter : "all";
  const page = Math.max(1, Number(queryValue(query.page)) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(queryValue(query.pageSize)) || 10));
  const search = queryValue(query.search)?.trim() || undefined;

  return {
    search,
    dateFilter,
    from: queryValue(query.from) || undefined,
    to: queryValue(query.to) || undefined,
    page,
    pageSize,
  };
}

function followUpSections(baseWhere: Prisma.FollowUpWhereInput, query: ReturnType<typeof normalizeFollowUpQuery>) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const commonOrder: Prisma.FollowUpOrderByWithRelationInput[] = [{ followUpDate: "asc" }, { createdAt: "desc" }];
  const completedOrder: Prisma.FollowUpOrderByWithRelationInput[] = [{ completedAt: "desc" }, { followUpDate: "desc" }];
  const pending = { status: { not: "COMPLETED" } } satisfies Prisma.FollowUpWhereInput;

  if (query.dateFilter === "today") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(today, tomorrow)), orderBy: commonOrder }];
  }

  if (query.dateFilter === "tomorrow") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(tomorrow, addDays(tomorrow, 1))), orderBy: commonOrder }];
  }

  if (query.dateFilter === "week") {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = addDays(endOfWeek(today, { weekStartsOn: 1 }), 1);
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(weekStart, weekEnd)), orderBy: commonOrder }];
  }

  if (query.dateFilter === "month") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(startOfMonth(today), addDays(endOfMonth(today), 1))), orderBy: commonOrder }];
  }

  if (query.dateFilter === "custom") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(parseDateStart(query.from), parseDateEnd(query.to))), orderBy: commonOrder }];
  }

  if (query.dateFilter === "overdue") {
    return [{ where: combineWhere(baseWhere, pending, { OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }] }), orderBy: commonOrder }];
  }

  if (query.dateFilter === "completed") {
    return [{ where: combineWhere(baseWhere, { status: "COMPLETED" }), orderBy: completedOrder }];
  }

  return [
    { where: combineWhere(baseWhere, pending, { OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }] }), orderBy: commonOrder },
    { where: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] } }, dateRangeWhere(today, tomorrow)), orderBy: commonOrder },
    { where: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] } }, { followUpDate: { gte: tomorrow } }), orderBy: commonOrder },
    { where: combineWhere(baseWhere, { status: "COMPLETED" }), orderBy: completedOrder },
  ];
}

export async function getFollowUpPageData(role: Role, user: ShellUser, query?: FollowUpQuery | Record<string, unknown>): Promise<FollowUpPageData> {
  const prisma = getPrisma();
  await ensureCrmFoundation();
  const normalized = normalizeFollowUpQuery(query);
  const scopedUserIds = await getScopedUserIds(role, user);
  const scopedWhere = followUpScopeWhere(scopedUserIds);
  const listWhere = combineWhere(scopedWhere, followUpSearchWhere(normalized.search));
  const sections = followUpSections(listWhere, normalized);
  const sectionCounts = await Promise.all(sections.map((section) => prisma.followUp.count({ where: section.where })));
  const total = sectionCounts.reduce((sum, count) => sum + count, 0);
  const rows: FollowUpRow[] = [];
  let offset = (normalized.page - 1) * normalized.pageSize;
  let remaining = normalized.pageSize;

  for (let index = 0; index < sections.length && remaining > 0; index += 1) {
    const count = sectionCounts[index] ?? 0;
    if (offset >= count) {
      offset -= count;
      continue;
    }

    const records = await prisma.followUp.findMany({
      where: sections[index].where,
      include: followUpInclude,
      orderBy: sections[index].orderBy,
      skip: offset,
      take: remaining,
    });

    rows.push(...records.map(mapFollowUpRow));
    remaining -= records.length;
    offset = 0;
  }

  return {
    rows,
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    totalPages: Math.max(1, Math.ceil(total / normalized.pageSize)),
    filters: {
      search: normalized.search,
      dateFilter: normalized.dateFilter,
      from: normalized.from,
      to: normalized.to,
    },
    summary: await countFollowUpSummary(prisma, scopedWhere),
  };
}

export async function getLeadDetail(id: string, role: Role, user: ShellUser) {
  const workspace = await getCrmWorkspace(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  const lead = workspace.leads.find((item) => item.id === lookup || slugify(item.title) === lookupSlug);
  return {
    workspace,
    lead,
    company: lead?.companyId ? workspace.companies.find((item) => item.id === lead.companyId) : undefined,
  };
}

export async function getCustomerDetail(id: string, role: Role, user: ShellUser) {
  const prisma = getPrisma();
  const workspace = await getCrmWorkspace(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  const customer = workspace.companies.find((item) => item.id === lookup || slugify(item.name) === lookupSlug);

  if (!customer) {
    return {
      workspace,
      customer: undefined,
      history: {
        tasks: [],
        followUps: [],
        activities: [],
        communications: [],
      } satisfies CustomerHistory,
    };
  }

  const scopedUserIds = await getScopedUserIds(role, user);
  const taskScope = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { assignedById: { in: scopedUserIds } },
        ],
      }
    : {};
  const leadScope = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { createdById: { in: scopedUserIds } },
        ],
      }
    : {};
  const followUpScope = followUpScopeWhere(scopedUserIds);
  const communicationScope = scopedUserIds
    ? {
        OR: [
          { userId: { in: scopedUserIds } },
          { task: { is: taskScope } },
          { lead: { is: leadScope } },
        ],
      }
    : {};
  const timelineScope = scopedUserIds
    ? {
        OR: [
          { userId: { in: scopedUserIds } },
          { task: { is: taskScope } },
          { followUp: { is: followUpScope } },
          { lead: { is: leadScope } },
          { communicationLog: { is: communicationScope } },
        ],
      }
    : {};

  const [tasks, followUps, communications, timeline] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [
          {
            OR: [
              { companyId: customer.id },
              { companyName: { equals: customer.name, mode: "insensitive" } },
            ],
          },
          ...(taskScope.OR ? [{ OR: taskScope.OR }] : []),
        ],
      },
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.followUp.findMany({
      where: combineWhere({ companyId: customer.id }, followUpScope),
      include: followUpInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.communicationLog.findMany({
      where: {
        companyId: customer.id,
        ...(communicationScope.OR ? communicationScope : {}),
      },
      include: communicationHistoryInclude,
      orderBy: { communicationAt: "desc" },
    }),
    prisma.activityTimeline.findMany({
      where: {
        companyId: customer.id,
        ...(timelineScope.OR ? timelineScope : {}),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    workspace,
    customer,
    history: {
      tasks: tasks.map(mapTaskRow),
      followUps: followUps.map(mapFollowUpRow),
      communications: communications.map(mapCommunicationHistoryRow),
      activities: timeline.map((item) => ({
        id: item.id,
        href: linkedEntityHref({ entity: item.entity, entityId: item.entityId, leadId: item.leadId, companyId: item.companyId }),
        title: item.title,
        detail: item.description ?? `${item.entity} activity${item.user?.name ? ` by ${item.user.name}` : ""}`,
        time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
      })),
    } satisfies CustomerHistory,
  };
}

export async function getProductDetail(id: string, role: Role, user: ShellUser, query?: Record<string, unknown>) {
  const prisma = getPrisma();
  const workspace = await getCrmWorkspace(role, user);
  const scopedUserIds = await getScopedUserIds(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  const productRecord = await prisma.productService.findFirst({
    where: {
      OR: [
        { id: lookup },
        { name: { equals: lookup, mode: "insensitive" } },
      ],
    },
    include: productInclude,
  }) ?? (lookup === lookupSlug
    ? await prisma.productService.findFirst({
        where: {
          name: {
            in: workspace.products.filter((item) => slugify(item.name) === lookupSlug).map((item) => item.name),
          },
        },
        include: productInclude,
      })
    : null);
  const productEngagement = productRecord ? buildProductEngagement(productRecord, scopedUserIds, query) : undefined;
  const mappedProduct = productRecord && productEngagement
    ? {
        id: productRecord.id,
        name: productRecord.name,
        category: productRecord.category,
        brand: productRecord.brand ?? "-",
        price: Number(productRecord.price),
        imageUrl: productRecord.imageUrl ?? "",
        description: productRecord.description ?? "-",
        specification: productRecord.specification ?? "-",
        status: labelize(productRecord.status),
        interestedCustomers: productEngagement.summary.totalCompaniesContacted,
        communicationCount: productEngagement.summary.totalCommunicationCount,
        followUpCount: productEngagement.summary.followUpCount,
        quotationCount: productEngagement.summary.quotationSentCount,
        salesCount: productEngagement.summary.salesCount,
        conversionRate: productEngagement.summary.conversionRate,
      }
    : undefined;

  return {
    workspace,
    product: workspace.products.find((item) => item.id === lookup || slugify(item.name) === lookupSlug) ?? mappedProduct,
    productEngagement,
  };
}

export async function getQuotationDetail(id: string, role: Role, user: ShellUser) {
  const workspace = await getCrmWorkspace(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  return {
    workspace,
    quotation: workspace.quotations.find((item) => item.id === lookup || item.quoteNumber === lookup || slugify(item.quoteNumber) === lookupSlug),
  };
}

