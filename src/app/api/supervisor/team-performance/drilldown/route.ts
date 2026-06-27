import { NextResponse } from "next/server";

import { formatCrmDate, getCrmDayWindow, getCrmPeriodWindow, type CrmPeriod } from "@/lib/crm-time";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";

type TeamPerformancePeriod = CrmPeriod;
type MetricType =
  | "overview"
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

    const period: TeamPerformancePeriod = (rawPeriod === "today" || rawPeriod === "week" || rawPeriod === "month" || rawPeriod === "year" || rawPeriod === "custom")
      ? rawPeriod
      : "month";
    const metric = (metricType === "overview" || metricType === "leads" || metricType === "calls" || metricType === "whatsapp" || metricType === "meetings" || metricType === "followUps" || metricType === "pendingTasks"
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

    const window = getCrmPeriodWindow(new Date(), {
      period,
      from: period === "custom" ? rawFrom ?? undefined : undefined,
      to: period === "custom" ? rawTo ?? undefined : undefined,
    });
    const { from: today } = getCrmDayWindow(new Date());
    const overdueTo = window.to.getTime() < today.getTime() ? window.to : today;

    const formatDisplayDate = (value: Date) => formatCrmDate(value, "dd/MM/yyyy hh:mm a");

    type DrilldownDetailRow = {
      id: string;
      type: "Lead" | "Task" | "Follow-up" | "Communication" | "Conversion" | "Sales" | "Quotation";
      customerOrCompany: string;
      companyId?: string | null;
      companyHref?: string | null;
      leadId?: string | null;
      leadName: string;
      contactPerson: string;
      phone: string;
      method: string;
      title: string;
      dateTime: string;
      sortDate: number;
      sortDateValue: string;
      status: string;
      note: string;
    };

    let rows: DrilldownDetailRow[] = [];
    let count = 0;
    const companyHrefFromId = (companyId?: string | null) => (companyId ? `/customers/${companyId}` : null);

    if (metric === "leads") {
      const leads = await prisma.lead.findMany({
        where: {
          assignedToId: marketerId,
          createdAt: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          companyId: true,
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
        companyId: lead.companyId,
        companyHref: companyHrefFromId(lead.companyId),
        leadId: lead.id,
        leadName: normalizeLeadTitle(lead.title, lead.customerName),
        contactPerson: normalizeContactPerson(lead.company?.contactPerson),
        phone: pickPhone(lead.phone || lead.company?.phone),
        method: "Lead",
        title: normalizeLeadTitle(lead.title, lead.customerName),
        dateTime: formatDisplayDate(lead.createdAt),
        sortDate: lead.createdAt.getTime(),
        sortDateValue: lead.createdAt.toISOString(),
        status: lead.status,
        note: lead.notes ?? "-",
      }));
    }

    if (metric === "overview") {
      const [leads, tasks, followUps, communications, quotations, sales] = await Promise.all([
        prisma.lead.findMany({
          where: {
            assignedToId: marketerId,
            createdAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            title: true,
            customerName: true,
            phone: true,
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
        }),
        prisma.task.findMany({
          where: {
            assignedToId: marketerId,
            status: { not: "COMPLETED" },
            dueDate: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            title: true,
            description: true,
            status: true,
            dueDate: true,
            updatedAt: true,
            leadName: true,
            companyName: true,
            company: { select: { name: true, contactPerson: true, phone: true } },
            lead: { select: { id: true, title: true, customerName: true, phone: true, companyId: true } },
          },
          orderBy: { dueDate: "desc" },
        }),
        prisma.followUp.findMany({
          where: {
            assignedToId: marketerId,
            followUpDate: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            method: true,
            note: true,
            nextDiscussionPlan: true,
            status: true,
            followUpDate: true,
            lead: {
              select: {
                id: true,
                title: true,
                companyId: true,
                customerName: true,
                phone: true,
                company: { select: { name: true, contactPerson: true, phone: true } },
              },
            },
            company: { select: { name: true, contactPerson: true, phone: true } },
            task: { select: { title: true } },
          },
          orderBy: { followUpDate: "desc" },
        }),
        prisma.communicationLog.findMany({
          where: {
            userId: marketerId,
            communicationAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            method: true,
            note: true,
            discussionTopic: true,
            communicationAt: true,
            lead: {
              select: {
                id: true,
                title: true,
                companyId: true,
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
        }),
        prisma.quotation.findMany({
          where: {
            createdById: marketerId,
            createdAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            quoteNumber: true,
            companyId: true,
            leadId: true,
            status: true,
            notes: true,
            createdAt: true,
            totalAmount: true,
            company: { select: { name: true, contactPerson: true, phone: true } },
            lead: {
              select: {
                id: true,
                title: true,
                customerName: true,
                phone: true,
                companyId: true,
                company: { select: { name: true, contactPerson: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.lead.findMany({
          where: {
            assignedToId: marketerId,
            status: "WON_SALE",
            updatedAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
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
        }),
      ]);

      const merged: DrilldownDetailRow[] = [];

      for (const lead of leads) {
        merged.push({
          id: `lead-${lead.id}`,
          type: "Lead",
          customerOrCompany: lead.company?.name || lead.customerName,
          companyId: lead.companyId,
          companyHref: companyHrefFromId(lead.companyId),
          leadId: lead.id,
          leadName: normalizeLeadTitle(lead.title, lead.customerName),
          contactPerson: normalizeContactPerson(lead.company?.contactPerson),
          phone: pickPhone(lead.phone || lead.company?.phone),
          method: "Lead",
          title: normalizeLeadTitle(lead.title, lead.customerName),
          dateTime: formatDisplayDate(lead.createdAt),
          sortDate: lead.createdAt.getTime(),
          sortDateValue: lead.createdAt.toISOString(),
          status: lead.status,
          note: lead.notes ?? "-",
        });
      }

      for (const task of tasks) {
        const companyId = task.companyId ?? task.lead?.companyId ?? null;
        const taskDate = task.dueDate ?? task.updatedAt;
        merged.push({
          id: `task-${task.id}`,
          type: "Task",
          customerOrCompany: task.company?.name || task.companyName || task.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: task.lead?.id ?? null,
          leadName: task.leadName || task.lead?.title || "-",
          contactPerson: normalizeContactPerson(task.company?.contactPerson),
          phone: pickPhone(task.company?.phone || task.lead?.phone),
          method: "Task",
          title: task.title,
          dateTime: formatDisplayDate(taskDate),
          sortDate: taskDate.getTime(),
          sortDateValue: taskDate.toISOString(),
          status: task.status,
          note: task.description || "-",
        });
      }

      for (const followUp of followUps) {
        const companyId = followUp.companyId ?? followUp.lead?.companyId ?? null;
        merged.push({
          id: `followup-${followUp.id}`,
          type: "Follow-up",
          customerOrCompany: followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName || "Customer",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: followUp.lead?.id ?? null,
          leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
          contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
          phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
          method: followUp.method || "Follow-up",
          title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
          dateTime: formatDisplayDate(followUp.followUpDate),
          sortDate: followUp.followUpDate.getTime(),
          sortDateValue: followUp.followUpDate.toISOString(),
          status: followUp.status,
          note: followUp.note || "-",
        });
      }

      for (const communication of communications) {
        const companyId = communication.companyId ?? communication.lead?.companyId ?? null;
        merged.push({
          id: `communication-${communication.id}`,
          type: "Communication",
          customerOrCompany: communication.company?.name || communication.lead?.company?.name || communication.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: communication.lead?.id ?? null,
          leadName: normalizeLeadTitle(communication.lead?.title, communication.lead?.customerName),
          contactPerson: normalizeContactPerson(communication.company?.contactPerson || communication.lead?.company?.contactPerson),
          phone: pickPhone(communication.lead?.phone || communication.company?.phone),
          method: communication.method || "Communication",
          title: communication.task?.title || communication.discussionTopic || communication.productDiscussed || communication.followUpNote || "Communication",
          dateTime: formatDisplayDate(communication.communicationAt),
          sortDate: communication.communicationAt.getTime(),
          sortDateValue: communication.communicationAt.toISOString(),
          status: "COMPLETED",
          note: communication.note || "-",
        });
      }

      for (const quotation of quotations) {
        const companyId = quotation.companyId ?? quotation.lead?.companyId ?? null;
        merged.push({
          id: `quotation-${quotation.id}`,
          type: "Quotation",
          customerOrCompany: quotation.company?.name || quotation.lead?.company?.name || quotation.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: quotation.leadId ?? quotation.lead?.id ?? null,
          leadName: normalizeLeadTitle(quotation.lead?.title, quotation.lead?.customerName),
          contactPerson: normalizeContactPerson(quotation.company?.contactPerson || quotation.lead?.company?.contactPerson),
          phone: pickPhone(quotation.lead?.phone || quotation.company?.phone),
          method: "Quotation",
          title: quotation.quoteNumber || "Quotation",
          dateTime: formatDisplayDate(quotation.createdAt),
          sortDate: quotation.createdAt.getTime(),
          sortDateValue: quotation.createdAt.toISOString(),
          status: quotation.status,
          note: quotation.notes || `Amount: ${quotation.totalAmount.toString()}`,
        });
      }

      for (const lead of sales) {
        merged.push({
          id: `sale-${lead.id}`,
          type: "Sales",
          customerOrCompany: lead.company?.name || lead.customerName,
          companyId: lead.companyId,
          companyHref: companyHrefFromId(lead.companyId),
          leadId: lead.id,
          leadName: normalizeLeadTitle(lead.title, lead.customerName),
          contactPerson: normalizeContactPerson(lead.company?.contactPerson),
          phone: pickPhone(lead.phone || lead.company?.phone),
          method: "Won Lead",
          title: normalizeLeadTitle(lead.title, lead.customerName),
          dateTime: formatDisplayDate(lead.updatedAt),
          sortDate: lead.updatedAt.getTime(),
          sortDateValue: lead.updatedAt.toISOString(),
          status: lead.status,
          note: lead.notes || "-",
        });
      }

      rows = merged.sort((left, right) => right.sortDate - left.sortDate);
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
          companyId: true,
          method: true,
          note: true,
          nextDiscussionPlan: true,
          status: true,
          followUpDate: true,
          createdAt: true,
          lead: {
            select: {
              id: true,
              title: true,
              companyId: true,
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

      rows = followUps.map((followUp) => {
        const companyId = followUp.companyId ?? followUp.lead?.companyId ?? null;

        return {
          id: followUp.id,
          type: "Follow-up",
          customerOrCompany: followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName || "Customer",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: followUp.lead?.id ?? null,
          leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
          contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
          phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
          method: followUp.method || "Follow-up",
          title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
          dateTime: formatDisplayDate(followUp.followUpDate),
          sortDate: followUp.followUpDate.getTime(),
          sortDateValue: followUp.followUpDate.toISOString(),
          status: followUp.status,
          note: followUp.note || "-",
        };
      });
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
          companyId: true,
          title: true,
          description: true,
          status: true,
          dueDate: true,
          updatedAt: true,
          leadName: true,
          companyName: true,
          company: { select: { name: true, contactPerson: true, phone: true } },
          lead: { select: { id: true, title: true, customerName: true, phone: true, companyId: true } },
        },
        orderBy: { dueDate: "desc" },
      });

      rows = tasks.map((task): DrilldownDetailRow => {
        const companyId = task.companyId ?? task.lead?.companyId ?? null;
        const taskDate = task.dueDate ?? task.updatedAt;

        return {
          id: task.id,
          type: "Task",
          customerOrCompany: task.company?.name || task.companyName || task.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: task.lead?.id ?? null,
          leadName: task.leadName || task.lead?.title || "-",
          contactPerson: normalizeContactPerson(task.company?.contactPerson),
          phone: pickPhone(task.company?.phone || task.lead?.phone),
          method: "Task",
          title: task.title,
          dateTime: formatDisplayDate(taskDate),
          sortDate: taskDate.getTime(),
          sortDateValue: taskDate.toISOString(),
          status: task.status,
          note: task.description || "-",
        };
      }).sort((left, right) => right.sortDate - left.sortDate);
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
          companyId: true,
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
        companyId: lead.companyId,
        companyHref: companyHrefFromId(lead.companyId),
        leadId: lead.id,
        leadName: normalizeLeadTitle(lead.title, lead.customerName),
        contactPerson: normalizeContactPerson(lead.company?.contactPerson),
        phone: pickPhone(lead.phone || lead.company?.phone),
        method: "Won Lead",
        title: normalizeLeadTitle(lead.title, lead.customerName),
        dateTime: formatDisplayDate(lead.updatedAt),
        sortDate: lead.updatedAt.getTime(),
        sortDateValue: lead.updatedAt.toISOString(),
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
          companyId: true,
          method: true,
          note: true,
          discussionTopic: true,
          communicationAt: true,
          lead: {
            select: {
              id: true,
              title: true,
              companyId: true,
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

      const merged: DrilldownDetailRow[] = [];

      for (const communication of communications) {
        const companyName = communication.company?.name || communication.lead?.company?.name || communication.lead?.customerName;
        const companyId = communication.companyId ?? communication.lead?.companyId ?? null;
        merged.push({
          id: communication.id,
          type: "Communication",
          customerOrCompany: companyName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: communication.lead?.id ?? null,
          leadName: normalizeLeadTitle(communication.lead?.title, communication.lead?.customerName),
          contactPerson: normalizeContactPerson(communication.company?.contactPerson || communication.lead?.company?.contactPerson),
          phone: pickPhone(communication.lead?.phone || communication.company?.phone),
          method: communication.method || "Communication",
          title: communication.task?.title || communication.discussionTopic || communication.productDiscussed || communication.followUpNote || "Communication",
          dateTime: formatDisplayDate(communication.communicationAt),
          sortDate: communication.communicationAt.getTime(),
          sortDateValue: communication.communicationAt.toISOString(),
          status: "COMPLETED",
          note: communication.note || "-",
        });
      }

      rows = merged.sort((left, right) => right.sortDate - left.sortDate);
    }

    count = rows.length;

    const labelByMetric: Record<MetricType, string> = {
      overview: "Activity Overview",
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
      from: formatCrmDate(window.from, "yyyy-MM-dd"),
      to: formatCrmDate(new Date(window.to.getTime() - 1), "yyyy-MM-dd"),
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
