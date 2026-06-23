import { NextResponse } from "next/server";
import { addDays, endOfMonth, endOfWeek, format, isBefore, startOfDay, startOfMonth, startOfWeek } from "date-fns";

import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";

type TeamPerformancePeriod = "today" | "week" | "month" | "year" | "custom";
type MetricType =
  | "leads"
  | "calls"
  | "whatsapp"
  | "meetings"
  | "followUps"
  | "pendingTasks"
  | "overdueFollowUps"
  | "sales"
  | "conversion"
  | "score";

type TeamPerformanceWindow = {
  period: TeamPerformancePeriod;
  from: Date;
  to: Date;
};

function getTeamPerformanceWindow(now: Date, period?: TeamPerformancePeriod, fromRaw?: string, toRaw?: string): TeamPerformanceWindow {
  const todayStart = startOfDay(now);
  const periodSafe = period ?? "month";
  const parseDate = (value?: string) => {
    if (!value) return undefined;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : startOfDay(parsed);
  };

  let from = todayStart;
  let to = addDays(todayStart, 1);

  if (periodSafe === "today") {
    from = startOfDay(now);
    to = addDays(from, 1);
  } else if (periodSafe === "week") {
    from = startOfWeek(now, { weekStartsOn: 1 });
    to = addDays(endOfWeek(now, { weekStartsOn: 1 }), 1);
  } else if (periodSafe === "month") {
    from = startOfMonth(now);
    to = addDays(endOfMonth(from), 1);
  } else if (periodSafe === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear() + 1, 0, 1);
  } else if (periodSafe === "custom") {
    const parsedFrom = parseDate(fromRaw);
    const parsedTo = parseDate(toRaw);
    const candidateFrom = parsedFrom ?? todayStart;
    const candidateTo = parsedTo ?? candidateFrom;
    if (isBefore(candidateTo, candidateFrom)) {
      from = candidateTo;
      to = addDays(candidateFrom, 1);
    } else {
      from = candidateFrom;
      to = addDays(candidateTo, 1);
    }
  }

  return { period: periodSafe, from, to };
}

function pickPhone(value?: string | null) {
  if (!value) return "-";
  const [first] = value.split(/[;,|]/);
  return first?.trim() || "-";
}

type MethodBucketClause = { method: { contains: string; mode: "insensitive" } };

function withMethodBuckets(kind: "calls" | "whatsapp" | "meetings") {
  if (kind === "calls") {
    return {
      leadClause: [
        { method: { contains: "phone", mode: "insensitive" as const } },
        { method: { contains: "call", mode: "insensitive" as const } },
      ] as MethodBucketClause[],
    };
  }

  if (kind === "whatsapp") {
    return { leadClause: [{ method: { contains: "whatsapp", mode: "insensitive" as const } }] as MethodBucketClause[] };
  }

  return { leadClause: [{ method: { contains: "meeting", mode: "insensitive" as const } }] as MethodBucketClause[] };
}

function normalizeContactPerson(name: string | null | undefined) {
  return name?.trim() || "-";
}

function normalizeLeadTitle(value: string | null | undefined, fallbackCustomer: string | null | undefined) {
  return value?.trim() || fallbackCustomer?.trim() || "Lead";
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const marketerId = searchParams.get("marketerId")?.trim();
    const metricType = searchParams.get("metricType")?.trim();
    const rawPeriod = searchParams.get("period")?.trim();
    const rawFrom = searchParams.get("from")?.trim() || searchParams.get("fromDate")?.trim();
    const rawTo = searchParams.get("to")?.trim() || searchParams.get("toDate")?.trim();

    if (!marketerId) {
      return NextResponse.json({ success: false, message: "marketerId is required." }, { status: 400 });
    }

    const period = (rawPeriod === "today" || rawPeriod === "week" || rawPeriod === "month" || rawPeriod === "year" || rawPeriod === "custom")
      ? rawPeriod
      : "month";
    const metric = (metricType === "leads" || metricType === "calls" || metricType === "whatsapp" || metricType === "meetings" || metricType === "followUps" || metricType === "pendingTasks"
      || metricType === "overdueFollowUps" || metricType === "sales" || metricType === "conversion" || metricType === "score")
      ? metricType
      : undefined;

    if (!metric) {
      return NextResponse.json({ success: false, message: "Invalid metricType." }, { status: 400 });
    }

    const prisma = getPrisma();
    const scopeIds = await getMarketerScopeUserIds(prisma, { id: auth.user.id, role: auth.user.role });
    if (scopeIds && !scopeIds.includes(marketerId)) {
      return NextResponse.json({ success: false, message: "No access to this marketer." }, { status: 403 });
    }

    const window = getTeamPerformanceWindow(new Date(), period, period === "custom" ? rawFrom : undefined, period === "custom" ? rawTo : undefined);
    const today = startOfDay(new Date());
    const overdueTo = isBefore(window.to, today) ? window.to : today;

    const formatDisplayDate = (value: Date) => format(value, "dd/MM/yyyy hh:mm a");

    type DrilldownDetailRow = {
      id: string;
      type: "Lead" | "Task" | "Follow-up" | "Communication" | "Conversion" | "Sales";
      customerOrCompany: string;
      leadName: string;
      contactPerson: string;
      phone: string;
      method: string;
      title: string;
      dateTime: string;
      sortDate: number;
      status: string;
      note: string;
    };

    let rows: DrilldownDetailRow[] = [];
    let count = 0;

    if (metric === "leads") {
      const leads = await prisma.lead.findMany({
        where: {
          assignedToId: marketerId,
          createdAt: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          title: true,
          customerName: true,
          phone: true,
          email: true,
          status: true,
          notes: true,
          createdAt: true,
          company: {
            select: {
              name: true,
              contactPerson: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      rows = leads.map((lead) => ({
        id: lead.id,
        type: "Lead",
        customerOrCompany: lead.company?.name || lead.customerName,
        leadName: normalizeLeadTitle(lead.title, lead.customerName),
        contactPerson: normalizeContactPerson(lead.company?.contactPerson),
        phone: pickPhone(lead.phone || lead.company?.phone),
        method: "Lead",
        title: normalizeLeadTitle(lead.title, lead.customerName),
        dateTime: formatDisplayDate(lead.createdAt),
        sortDate: lead.createdAt.getTime(),
        status: lead.status,
        note: lead.notes ?? "-",
      }));
    }

    if (metric === "followUps" || metric === "overdueFollowUps") {
      const whereBase = {
        assignedToId: marketerId,
        followUpDate: { gte: window.from, lt: metric === "overdueFollowUps" ? overdueTo : window.to },
      };

      const followUps = await prisma.followUp.findMany({
        where: metric === "overdueFollowUps"
          ? { ...whereBase, status: { not: "COMPLETED" } }
          : whereBase,
        select: {
          id: true,
          method: true,
          note: true,
          nextDiscussionPlan: true,
          status: true,
          followUpDate: true,
          createdAt: true,
          lead: {
            select: {
              title: true,
              customerName: true,
              phone: true,
              company: { select: { name: true, contactPerson: true, phone: true } },
            },
          },
          company: { select: { name: true, contactPerson: true, phone: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { followUpDate: "desc" },
      });

      rows = followUps.map((followUp) => ({
        id: followUp.id,
        type: "Follow-up",
        customerOrCompany: followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName || "Customer",
        leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
        contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
        phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
        method: followUp.method || "Follow-up",
        title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
        dateTime: formatDisplayDate(followUp.followUpDate),
        sortDate: followUp.followUpDate.getTime(),
        status: followUp.status,
        note: followUp.note || "-",
      }));
    }

    if (metric === "pendingTasks") {
      const tasks = await prisma.task.findMany({
        where: {
          assignedToId: marketerId,
          status: { not: "COMPLETED" },
          dueDate: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          updatedAt: true,
          leadName: true,
          companyName: true,
          company: { select: { name: true, contactPerson: true, phone: true } },
          lead: { select: { title: true, customerName: true, phone: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      rows = tasks.map((task) => ({
        id: task.id,
        type: "Task",
        customerOrCompany: task.company?.name || task.companyName || task.lead?.customerName || "Company",
        leadName: task.leadName || task.lead?.title || "-",
        contactPerson: normalizeContactPerson(task.company?.contactPerson),
        phone: pickPhone(task.company?.phone || task.lead?.phone),
        method: "Task",
        title: task.title,
        dateTime: formatDisplayDate(task.updatedAt),
        sortDate: task.updatedAt.getTime(),
        status: task.status,
        note: task.description || "-",
      }));
    }

    if (metric === "sales" || metric === "conversion") {
      const leads = await prisma.lead.findMany({
        where: {
          assignedToId: marketerId,
          status: "WON_SALE",
          updatedAt: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          title: true,
          customerName: true,
          phone: true,
          status: true,
          notes: true,
          updatedAt: true,
          company: {
            select: {
              name: true,
              contactPerson: true,
              phone: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      rows = leads.map((lead) => ({
        id: lead.id,
        type: metric === "sales" ? "Sales" : "Conversion",
        customerOrCompany: lead.company?.name || lead.customerName,
        leadName: normalizeLeadTitle(lead.title, lead.customerName),
        contactPerson: normalizeContactPerson(lead.company?.contactPerson),
        phone: pickPhone(lead.phone || lead.company?.phone),
        method: "Won Lead",
        title: normalizeLeadTitle(lead.title, lead.customerName),
        dateTime: formatDisplayDate(lead.updatedAt),
        sortDate: lead.updatedAt.getTime(),
        status: lead.status,
        note: lead.notes || "-",
      }));
    }

    if (metric === "score") {
      rows = [];
    }

    if (metric === "calls" || metric === "whatsapp" || metric === "meetings") {
      const methodBuckets = withMethodBuckets(metric);

      const communications = await prisma.communicationLog.findMany({
        where: {
          userId: marketerId,
          communicationAt: { gte: window.from, lt: window.to },
          OR: methodBuckets.leadClause,
        },
        select: {
          id: true,
          method: true,
          note: true,
          discussionTopic: true,
          communicationAt: true,
          lead: {
            select: {
              title: true,
              customerName: true,
              phone: true,
              company: { select: { name: true, contactPerson: true, phone: true } },
            },
          },
          company: { select: { name: true, contactPerson: true, phone: true } },
          task: { select: { title: true } },
          followUpNote: true,
          productDiscussed: true,
        },
        orderBy: { communicationAt: "desc" },
      });

      const followUps = await prisma.followUp.findMany({
        where: {
          assignedToId: marketerId,
          followUpDate: { gte: window.from, lt: window.to },
          OR: methodBuckets.leadClause,
        },
        select: {
          id: true,
          method: true,
          note: true,
          nextDiscussionPlan: true,
          followUpDate: true,
          status: true,
          lead: {
            select: {
              title: true,
              customerName: true,
              phone: true,
              company: { select: { name: true, contactPerson: true, phone: true } },
            },
          },
          company: { select: { name: true, contactPerson: true, phone: true } },
          task: { select: { title: true } },
        },
        orderBy: { followUpDate: "desc" },
      });

      const merged: DrilldownDetailRow[] = [];

      for (const communication of communications) {
        const companyName = communication.company?.name || communication.lead?.company?.name || communication.lead?.customerName;
        merged.push({
          id: communication.id,
          type: "Communication",
          customerOrCompany: companyName || "Company",
          leadName: normalizeLeadTitle(communication.lead?.title, communication.lead?.customerName),
          contactPerson: normalizeContactPerson(communication.company?.contactPerson || communication.lead?.company?.contactPerson),
          phone: pickPhone(communication.lead?.phone || communication.company?.phone),
          method: communication.method || "Communication",
          title: communication.task?.title || communication.discussionTopic || communication.productDiscussed || communication.followUpNote || "Communication",
          dateTime: formatDisplayDate(communication.communicationAt),
          sortDate: communication.communicationAt.getTime(),
          status: "COMPLETED",
          note: communication.note || "-",
        });
      }

      for (const followUp of followUps) {
        const companyName = followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName;
        merged.push({
          id: followUp.id,
          type: "Follow-up",
          customerOrCompany: companyName || "Company",
          leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
          contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
          phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
          method: followUp.method || "Follow-up",
          title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
          dateTime: formatDisplayDate(followUp.followUpDate),
          sortDate: followUp.followUpDate.getTime(),
          status: "PENDING",
          note: followUp.note || "-",
        });
      }

      rows = merged.sort((left, right) => right.sortDate - left.sortDate);
    }

    count = rows.length;

    const labelByMetric: Record<MetricType, string> = {
      leads: "Leads",
      calls: "Calls",
      whatsapp: "WhatsApp",
      meetings: "Meetings",
      followUps: "Follow-ups",
      pendingTasks: "Pending Tasks",
      overdueFollowUps: "Overdue Follow-ups",
      sales: "Sales",
      conversion: "Conversion",
      score: "Score",
    };

    return NextResponse.json({
      success: true,
      period: window.period,
      from: format(window.from, "yyyy-MM-dd"),
      to: format(window.to, "yyyy-MM-dd"),
      marketerId,
      metric: metricType,
      metricLabel: labelByMetric[metric],
      count,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load team performance drill-down records.",
      },
      { status: 500 },
    );
  }
}
