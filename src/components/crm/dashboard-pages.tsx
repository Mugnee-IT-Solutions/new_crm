"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  MessageSquarePlus,
  Pencil,
  PhoneForwarded,
  Plus,
  Target,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConversionFunnel, LeadStatusDonut, ProductBarChart, SalesLineChart, TeamActivityDonut } from "@/components/charts/crm-charts";
import { AnimatedPanel } from "@/components/shared/animated-panel";
import { ChartCard } from "@/components/shared/chart-card";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { updateFollowUpStatusAction, updateTaskStatusAction } from "@/lib/crm-actions";
import type { CrmWorkspace } from "@/lib/crm-data";
import { cn, rolePath, type Role } from "@/lib/utils";

const statIcons = [CalendarClock, ClipboardCheck, PhoneForwarded, Target, Trophy, Users, BriefcaseBusiness, WalletCards, Award, Bell];
const chartColors = ["#2563EB", "#06B6D4", "#16A34A", "#F59E0B", "#4F46E5", "#8B5CF6", "#22C55E", "#DC2626", "#94A3B8"];

function StatsGrid({ items }: { items: CrmWorkspace["stats"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      {items.map((item, index) => {
        const Icon = statIcons[index % statIcons.length];
        return (
          <AnimatedPanel key={item.title} delay={index * 0.03}>
            <StatCard title={item.title} value={item.value} helper={item.helper} icon={Icon} tone={item.tone} />
          </AnimatedPanel>
        );
      })}
    </div>
  );
}

function EntityLink({ href, children, className }: { href?: string | null; children: string; className?: string }) {
  if (!href || children === "-") return <span className={className}>{children}</span>;

  return (
    <Link href={href} className={cn("text-blue-700 underline-offset-2 transition hover:underline", className)}>
      {children}
    </Link>
  );
}

function CompactList({ rows }: { rows: { title: string; meta: string; status?: string; href?: string | null }[] }) {
  return (
    <div className="space-y-3">
      {rows.length ? rows.map((row) => (
        <div key={`${row.title}-${row.meta}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">
              <EntityLink href={row.href} className="font-bold">{row.title}</EntityLink>
            </p>
            <p className="truncate text-xs text-slate-500">{row.meta}</p>
          </div>
          {row.status ? <Badge variant={row.status === "Completed" ? "success" : row.status.includes("Overdue") ? "danger" : row.status.includes("Pending") ? "warning" : "default"}>{row.status}</Badge> : null}
        </div>
      )) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No records yet.</p>
      )}
    </div>
  );
}

function chartData(workspace: CrmWorkspace) {
  const leadStatus = workspace.pipeline
    .filter((item) => item.value > 0)
    .map((item, index) => ({ name: item.label, value: item.value, color: chartColors[index % chartColors.length] }));
  const sales = workspace.quotations.slice(0, 8).reverse().map((item) => ({ month: item.date, sales: item.amount }));
  const products = workspace.productOpportunities.slice(0, 6).map((item) => ({ name: item.name, leads: item.interestedCustomers }));
  const max = Math.max(1, ...workspace.pipeline.map((item) => item.value));
  const funnel = workspace.pipeline
    .filter((item) => item.value > 0)
    .slice(0, 6)
    .map((item, index) => ({ name: item.label, value: Math.max(16, Math.round((item.value / max) * 100)), color: chartColors[index % chartColors.length] }));

  return { leadStatus, sales, products, funnel };
}

function PipelineBar({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  const total = Math.max(1, workspace.pipeline.reduce((sum, item) => sum + item.value, 0));

  return (
    <DashboardCard title="Lead Pipeline">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {workspace.pipeline.map((item) => (
          <div key={item.label} className={item.color} style={{ width: `${(item.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        {workspace.pipeline.map((item) => (
          <Link key={item.label} href={rolePath(role, "leads")} className="group rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/60">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold text-blue-700 underline-offset-2 group-hover:underline">{item.label}</p>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}

const quickActions = [
  ["Add Lead", "leads", Target],
  ["Add Customer", "customers", BriefcaseBusiness],
  ["Add Follow-up", "follow-ups", PhoneForwarded],
  ["Log Communication", "communication", MessageSquarePlus],
] as const;

function QuickActions({ role }: { role: Role }) {
  return (
    <DashboardCard title="Quick Actions">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(([label, path, Icon], index) => (
          <AnimatedPanel key={label} delay={index * 0.02}>
            <Link
              href={rolePath(role, path)}
              className={cn(
                "inline-flex h-12 w-full items-center justify-start gap-2 rounded-xl border px-4 text-sm font-semibold transition hover:-translate-y-0.5",
                index === 0 ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </AnimatedPanel>
        ))}
      </div>
    </DashboardCard>
  );
}

function PendingFromPreviousDay({ workspace }: { workspace: CrmWorkspace }) {
  const pending = workspace.todayWorkItems.filter((item) => item.overdue).slice(0, 6);

  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50/80">
      <div className="flex flex-col gap-3 border-b border-amber-200/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">Pending from Yesterday / Auto Carry Forward</h2>
            <p className="text-xs font-semibold text-amber-700">Incomplete plans, tasks, and follow-ups that need attention first.</p>
          </div>
        </div>
        <Badge variant="warning">{pending.length} Pending</Badge>
      </div>
      <div className="grid gap-3 p-5 lg:grid-cols-3">
        {pending.length ? pending.map((item) => (
          <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">
                  <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{item.source} - {item.date} {item.time}</p>
              </div>
              <Badge variant="warning">Pending</Badge>
            </div>
          </div>
        )) : (
          <p className="rounded-xl border border-amber-200 bg-white p-4 text-sm font-semibold text-slate-500 lg:col-span-3">No carried-forward work. Nice clean start.</p>
        )}
      </div>
    </Card>
  );
}

function WorkSourceBadge({ item }: { item: CrmWorkspace["todayWorkItems"][number] }) {
  const variant = item.source === "Follow-up" ? "warning" : item.source === "Task" ? "default" : "neutral";
  return <Badge variant={variant}>{item.source}</Badge>;
}

function WorkCompleteAction({ item, role }: { item: CrmWorkspace["todayWorkItems"][number]; role: Role }) {
  if (item.source === "Follow-up") {
    return (
      <form action={updateFollowUpStatusAction}>
        <input type="hidden" name="id" value={item.sourceId} />
        <input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </Button>
      </form>
    );
  }

  if (item.source === "Task") {
    return (
      <form action={updateTaskStatusAction}>
        <input type="hidden" name="id" value={item.sourceId} />
        <input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </Button>
      </form>
    );
  }

  return (
    <Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Link>
  );
}

function TodaysTasksCard({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  const todaysWork = workspace.todayWorkItems.slice(0, 8);

  return (
    <DashboardCard title="Today's Tasks" action={<Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Plan</Link>}>
      <div className="space-y-3">
        {todaysWork.length ? todaysWork.map((item) => (
          <div key={item.id} className={cn("grid grid-cols-[auto_1fr] gap-3 rounded-xl border px-3 py-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center", item.overdue ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-slate-50")}>
            <span className={cn("mt-1 flex h-4 w-4 items-center justify-center rounded border", item.overdue ? "border-red-300 bg-white text-red-600" : "border-slate-300 bg-white text-blue-600")}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                  <EntityLink href={item.href} className="font-bold">{item.title}</EntityLink>
                </p>
                <WorkSourceBadge item={item} />
                {item.overdue ? <Badge variant="danger">Overdue</Badge> : null}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" />
                {item.date} {item.time}
                {item.relatedTo !== "-" ? (
                  <>
                    <span>-</span>
                    <EntityLink href={item.href} className="text-xs font-semibold">{item.relatedTo}</EntityLink>
                  </>
                ) : null}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={item.priority === "High" || item.priority === "Urgent" ? "danger" : item.priority === "Medium" ? "warning" : "neutral"}>{item.priority}</Badge>
                <Badge variant={item.status === "Overdue" ? "danger" : item.status === "Due Today" ? "warning" : "neutral"}>{item.status}</Badge>
                {role !== "MARKETER" && item.assignedTo !== "-" ? <Badge variant="neutral">{item.assignedTo}</Badge> : null}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <WorkCompleteAction item={item} role={role} />
            </div>
          </div>
        )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No active work for today.</p>}
      </div>
    </DashboardCard>
  );
}

function TodaysPlanCard({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  const todaysPlans = workspace.todayPlans.filter((plan) => plan.section === "today").slice(0, 6);

  return (
    <DashboardCard title="Today's Plan" action={<Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Plan</Link>}>
      <div className="space-y-3">
        {todaysPlans.length ? todaysPlans.map((plan) => (
          <div key={plan.id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white">
              <input type="checkbox" className="h-3.5 w-3.5 accent-blue-600" checked={plan.status === "COMPLETED"} readOnly />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                  <EntityLink href={plan.href} className="font-bold">{plan.title}</EntityLink>
                </p>
                <Badge variant={plan.status === "COMPLETED" ? "success" : plan.status === "OVERDUE" ? "danger" : "warning"}>{plan.status}</Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" />
                {plan.time}
                {plan.relatedTo !== "-" ? (
                  <>
                    <span>-</span>
                    <EntityLink href={plan.href} className="text-xs font-semibold">{plan.relatedTo}</EntityLink>
                  </>
                ) : null}
              </p>
            </div>
            <Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
              <Pencil className="h-3.5 w-3.5" />
              Quick Edit
            </Link>
          </div>
        )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No plans for today yet.</p>}
      </div>
    </DashboardCard>
  );
}

function MyTasksCard({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  return (
    <DashboardCard title={role === "MARKETER" ? "My Tasks" : "Pending Team Tasks"}>
      <div className="space-y-3">
        {workspace.tasks.slice(0, 5).map((task) => (
          <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Assigned by {task.assignedBy} - Due {task.dueDate}</p>
              </div>
              <Badge variant={task.status === "OVERDUE" ? "danger" : task.status === "COMPLETED" ? "success" : "default"}>
                {task.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {task.relatedTo !== "-" ? (
                <Badge variant="neutral" className="bg-blue-50">
                  <EntityLink href={task.href} className="text-xs font-bold">{task.relatedTo}</EntityLink>
                </Badge>
              ) : null}
              <Badge variant={task.priority === "Urgent" || task.priority === "High" ? "danger" : task.priority === "Medium" ? "warning" : "neutral"}>
                {task.priority}
              </Badge>
            </div>
          </div>
        ))}
        {!workspace.tasks.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No tasks yet.</p> : null}
      </div>
    </DashboardCard>
  );
}

function FollowUpSummary({ workspace }: { workspace: CrmWorkspace }) {
  const summary = [
    ["Overdue", workspace.followUpSummary.overdue, "border-red-200 bg-red-50 text-red-700"],
    ["Due Today", workspace.followUpSummary.today, "border-blue-200 bg-blue-50 text-blue-700"],
    ["Upcoming", workspace.followUpSummary.upcoming, "border-emerald-200 bg-emerald-50 text-emerald-700"],
    ["Completed", workspace.followUpSummary.completed, "border-slate-200 bg-slate-50 text-slate-700"],
  ] as const;

  return (
    <DashboardCard title="Follow-up Summary">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, count, className]) => (
          <div key={label} className={cn("rounded-xl border p-3", className)}>
            <p className="text-2xl font-black">{count}</p>
            <p className="mt-1 text-xs font-bold">{label} Follow-ups</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function FollowUpRemindersCard({ workspace }: { workspace: CrmWorkspace }) {
  const groups = [
    ["Overdue", workspace.followUps.filter((item) => item.bucket === "Overdue"), "border-red-200 bg-red-50"],
    ["Due Today", workspace.followUps.filter((item) => item.bucket === "Due Today"), "border-blue-100 bg-blue-50/60"],
    ["Upcoming", workspace.followUps.filter((item) => item.bucket === "Upcoming"), "border-slate-100 bg-slate-50"],
    ["Completed", workspace.followUps.filter((item) => item.bucket === "Completed"), "border-emerald-100 bg-emerald-50"],
  ] as const;

  return (
    <DashboardCard title="Follow-up Center">
      <div className="grid gap-3 lg:grid-cols-4">
        {groups.map(([label, rows, className]) => (
          <div key={label} className={cn("rounded-xl border p-3", className)}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={cn("text-sm font-black", label === "Overdue" ? "text-red-700" : "text-slate-900")}>{label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-600">{rows.length}</span>
            </div>
            <div className="space-y-2">
              {rows.slice(0, 4).map((item) => (
                <div key={`${label}-${item.id}`} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="truncate text-sm font-bold text-slate-900">
                    <EntityLink href={item.href} className="font-bold">{item.customer}</EntityLink>
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{item.method} - {item.followUpDate}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.note}</p>
                </div>
              ))}
              {!rows.length ? <p className="text-xs font-semibold text-slate-400">No items</p> : null}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function ProductIntelligenceWidget({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    { title: "Top 5 Most Engaged Products", rows: workspace.productIntelligence.topEngaged, metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score` },
    { title: "Highest Conversion Products", rows: workspace.productIntelligence.highestConversion, metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion` },
    { title: "Most Discussed Products", rows: workspace.productIntelligence.mostDiscussed, metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} communications` },
  ];

  return (
    <DashboardCard title="Product Intelligence">
      <div className="grid gap-4 xl:grid-cols-3">
        {panels.map((panel) => (
          <div key={panel.title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">{panel.title}</h3>
            <div className="mt-3 space-y-2">
              {panel.rows.length ? panel.rows.map((item, index) => (
                <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="group flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-blue-700 underline-offset-2 group-hover:underline">{index + 1}. {item.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{item.leadCount} companies - {item.followUpCount} follow-ups - {item.quotationCount} quotes</p>
                  </div>
                  <Badge variant={panel.title.includes("Conversion") ? "success" : panel.title.includes("Discussed") ? "warning" : "default"}>{panel.metric(item)}</Badge>
                </Link>
              )) : <p className="rounded-lg bg-white p-3 text-xs font-semibold text-slate-500">No product engagement yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function CompactActivityFeed({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <DashboardCard title="Recent Activities" className="xl:max-w-3xl">
      <div className="space-y-2">
        {workspace.activities.slice(0, 5).map((item, index) => (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              {index < Math.min(4, workspace.activities.length - 1) ? <span className="h-5 w-px bg-slate-200" /> : null}
            </div>
            <div className="min-w-0 pb-1">
              <p className="truncate text-xs font-black text-slate-900">
                <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
              </p>
              <p className="truncate text-xs text-slate-500">{item.detail}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{item.time}</p>
            </div>
          </div>
        ))}
        {!workspace.activities.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No activities recorded yet.</p> : null}
      </div>
    </DashboardCard>
  );
}

function TeamPerformanceTable({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            {["Employee", "Leads", "Follow-ups", "Sales", "Conversion"].map((heading) => (
              <th className="px-3 py-2 font-bold" key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {workspace.employees.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-semibold text-slate-800">{row.name}</td>
              <td className="px-3 py-3">{row.leads}</td>
              <td className="px-3 py-3">{row.followUps}</td>
              <td className="px-3 py-3">{row.sales}</td>
              <td className="px-3 py-3">{row.conversionRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketerDashboard({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <>
      <PageHeader
        eyebrow="Employee Dashboard"
        title={`Good Morning, ${workspace.user.name}`}
        description="Your practical sales execution workspace for today."
        actions={<Badge variant="neutral">{new Date().toLocaleDateString()}</Badge>}
      />
      <StatsGrid items={workspace.stats} />

      <QuickActions role="MARKETER" />
      <TodaysPlanCard workspace={workspace} role="MARKETER" />
      <PendingFromPreviousDay workspace={workspace} />

      <div className="grid gap-5 xl:grid-cols-2">
        <TodaysTasksCard workspace={workspace} role="MARKETER" />
        <MyTasksCard workspace={workspace} role="MARKETER" />
      </div>

      <FollowUpSummary workspace={workspace} />
      <FollowUpRemindersCard workspace={workspace} />
      <PipelineBar workspace={workspace} role="MARKETER" />
      <ProductIntelligenceWidget workspace={workspace} />
      <CompactActivityFeed workspace={workspace} />
    </>
  );
}

export function SupervisorDashboard({ workspace }: { workspace: CrmWorkspace }) {
  const charts = chartData(workspace);

  return (
    <>
      <PageHeader
        eyebrow="Supervisor Dashboard"
        title="Team performance overview"
        description="Monitor team leads, due follow-ups, product interest, and target achievement."
        actions={<Badge variant="neutral">Current Month</Badge>}
      />
      <StatsGrid items={workspace.stats} />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <DashboardCard title="Team Performance">
          <TeamPerformanceTable workspace={workspace} />
        </DashboardCard>
        <ChartCard title="Lead Status Distribution">
          <LeadStatusDonut total={workspace.leads.length} data={charts.leadStatus} />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard title="Sales Trends" className="xl:col-span-2">
          <SalesLineChart data={charts.sales} />
        </ChartCard>
        <DashboardCard title="Top Performer">
          {workspace.employees[0] ? (
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-amber-50 to-blue-50 p-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Trophy className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-950">{workspace.employees[0].name}</h3>
              <p className="text-sm text-slate-500">Leads {workspace.employees[0].leads} | Won {workspace.employees[0].sales} | Reward {workspace.employees[0].rewardPoints}</p>
              <Link href="/supervisor/rewards" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">Give Reward</Link>
            </div>
          ) : <p className="text-sm text-slate-500">No employees yet.</p>}
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Product-wise Interest">
          <ProductBarChart data={charts.products} />
        </ChartCard>
        <DashboardCard title="Pending Follow-ups">
          <CompactList rows={workspace.followUps.filter((item) => item.bucket !== "Completed").slice(0, 6).map((item) => ({ title: item.customer, href: item.href, meta: `${item.method} - ${item.note}`, status: item.bucket }))} />
        </DashboardCard>
      </div>
      <ProductIntelligenceWidget workspace={workspace} />
    </>
  );
}

export function AdminDashboard({ workspace }: { workspace: CrmWorkspace }) {
  const charts = chartData(workspace);

  return (
    <>
      <PageHeader
        eyebrow="Admin Dashboard"
        title="Business control center"
        description="A complete view of customers, leads, revenue, team activity, rewards, and CRM system health."
        actions={<Badge variant="neutral">Live Database</Badge>}
      />
      <StatsGrid items={workspace.stats} />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
        <ChartCard title="Sales Performance" className="min-h-80">
          <SalesLineChart data={charts.sales} />
        </ChartCard>
        <ChartCard title="Lead Conversion Funnel" className="min-h-80">
          <ConversionFunnel data={charts.funnel} />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard title="Team Activity Overview">
          <TeamActivityDonut />
        </ChartCard>
        <DashboardCard title="Employee Productivity" className="xl:col-span-2">
          <TeamPerformanceTable workspace={workspace} />
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <DashboardCard title="Quick Access">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(([label, path, Icon]) => (
              <Link key={label} href={`/admin/${path}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="System Monitoring Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            {workspace.systemSummary.map((item) => (
              <Card key={item.label} className="p-4">
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="mt-2 text-xl font-black text-slate-950">{item.value}</p>
              </Card>
            ))}
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Lead Status Distribution">
          <LeadStatusDonut total={workspace.leads.length} data={charts.leadStatus} />
        </ChartCard>
        <DashboardCard title="Recent Activities">
          <CompactList rows={workspace.activities.map((item) => ({ title: item.title, href: item.href, meta: `${item.detail} - ${item.time}` }))} />
        </DashboardCard>
      </div>
      <ProductIntelligenceWidget workspace={workspace} />
    </>
  );
}
