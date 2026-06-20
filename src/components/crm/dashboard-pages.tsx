"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import {
  ArrowRight,
  AlertTriangle,
  Award,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Mail,
  MessageCircleMore,
  MessageSquarePlus,
  Pencil,
  PhoneCall,
  PhoneForwarded,
  Plus,
  Target,
  Trophy,
  Users,
  WalletCards,
  XCircle,
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
import { cn, initials, rolePath, type Role } from "@/lib/utils";

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
      {rows.length ? rows.map((row, index) => (
        <div key={`${row.href ?? row.title}-${row.meta}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
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
  const teamRows = workspace.employees.filter((row) => row.role === "Marketer");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            {["Employee", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion"].map((heading) => (
              <th className="px-3 py-2 font-bold" key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {teamRows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-semibold text-slate-800">{row.name}</td>
              <td className="px-3 py-3">{row.leads}</td>
              <td className="px-3 py-3">{row.calls}</td>
              <td className="px-3 py-3">{row.whatsapp}</td>
              <td className="px-3 py-3">{row.meetings}</td>
              <td className="px-3 py-3">{row.followUps}</td>
              <td className="px-3 py-3">{row.pendingTasks}</td>
              <td className="px-3 py-3">{row.overdueFollowUps}</td>
              <td className="px-3 py-3">{row.sales}</td>
              <td className="px-3 py-3">{row.conversionRate}</td>
            </tr>
          ))}
          {!teamRows.length ? (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">No team members found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

type SupervisorPerformanceRow = CrmWorkspace["employees"][number] & {
  performanceScore: number;
  performanceScoreRaw: number;
};

const supervisorKpiConfig = {
  "Total Marketers": {
    icon: Users,
    accent: "bg-blue-500",
    iconTone: "bg-blue-100 text-blue-700",
    valueTone: "text-blue-700",
    sparkStroke: "#2563EB",
    helper: "Active marketers under your supervision",
  },
  "Total Leads": {
    icon: Target,
    accent: "bg-indigo-500",
    iconTone: "bg-indigo-100 text-indigo-700",
    valueTone: "text-indigo-700",
    sparkStroke: "#7C3AED",
    helper: "Total team pipeline opportunities",
  },
  "Follow-up Due": {
    icon: CalendarClock,
    accent: "bg-orange-500",
    iconTone: "bg-orange-100 text-orange-700",
    valueTone: "text-orange-700",
    sparkStroke: "#F97316",
    helper: "Due today across your active team",
  },
  "Overdue Follow-ups": {
    icon: AlertTriangle,
    accent: "bg-red-500",
    iconTone: "bg-red-100 text-red-700",
    valueTone: "text-red-700",
    sparkStroke: "#EF4444",
    helper: "Urgent items needing escalation",
  },
  "Sales This Month": {
    icon: WalletCards,
    accent: "bg-emerald-500",
    iconTone: "bg-emerald-100 text-emerald-700",
    valueTone: "text-emerald-700",
    sparkStroke: "#10B981",
    helper: "Closed quotation value this month",
  },
  "Conversion Rate": {
    icon: Award,
    accent: "bg-violet-500",
    iconTone: "bg-violet-100 text-violet-700",
    valueTone: "text-violet-700",
    sparkStroke: "#8B5CF6",
    helper: "Won deals versus total team leads",
  },
} as const;

function SupervisorSurfaceCard({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: "easeOut" }} className="h-full">
      <Card className={cn("h-full rounded-[20px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]", className)}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className={cn("p-5", contentClassName)}>{children}</div>
      </Card>
    </motion.div>
  );
}

function SupervisorEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[260px] flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function SupervisorHeaderAction({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const classes = cn(
    "inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700",
    className,
  );

  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button type="button" className={classes}>{children}</button>;
}

function SupervisorKpiGrid({ items }: { items: CrmWorkspace["stats"] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item, index) => {
        const config = supervisorKpiConfig[item.title as keyof typeof supervisorKpiConfig];
        const Icon = config.icon;

        return (
          <motion.div
            key={item.title}
            data-supervisor-kpi
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04, ease: "easeOut" }}
            whileHover={{ y: -3 }}
            className="h-full"
          >
            <Card className="relative h-full overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
              <div className={cn("absolute inset-x-0 top-0 h-1", config.accent)} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={cn("text-sm font-bold", config.valueTone)}>{item.title}</p>
                  <p className={cn("mt-4 text-[2.35rem] font-black leading-none tracking-[-0.03em]", config.valueTone)}>{item.value}</p>
                  <p className="mt-3 text-sm text-slate-500">{config.helper || item.helper}</p>
                </div>
                <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-sm", config.iconTone)}>
                  <Icon className="h-6 w-6" strokeWidth={2.1} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function performanceScoreVariant(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-blue-500";
  if (score >= 35) return "bg-amber-500";
  return "bg-rose-500";
}

function followUpMethodVisual(method: string) {
  const normalized = method.toLowerCase();
  if (normalized.includes("whatsapp")) return { icon: MessageCircleMore, badge: "success" as const, label: "WhatsApp" };
  if (normalized.includes("email")) return { icon: Mail, badge: "default" as const, label: "Email" };
  if (normalized.includes("meeting")) return { icon: CalendarClock, badge: "violet" as const, label: "Meeting" };
  return { icon: PhoneCall, badge: "warning" as const, label: normalized.includes("call") || normalized.includes("phone") ? "Phone Call" : method };
}

function followUpBucketVariant(bucket: string) {
  if (bucket === "Overdue") return "danger" as const;
  if (bucket === "Due Today") return "warning" as const;
  if (bucket === "Upcoming") return "default" as const;
  return "neutral" as const;
}

function buildSupervisorLeadStatusData(workspace: CrmWorkspace) {
  const pipelineMap = new Map(workspace.pipeline.map((item) => [item.label, item.value]));
  const count = (...labels: string[]) => labels.reduce((sum, label) => sum + (pipelineMap.get(label) ?? 0), 0);

  return [
    { name: `New Leads · ${count("New Lead")}`, value: count("New Lead"), color: "#2563EB" },
    { name: `Qualified · ${count("Contacted", "Interested", "Negotiation")}`, value: count("Contacted", "Interested", "Negotiation"), color: "#4F46E5" },
    { name: `Follow-up · ${count("Follow-up Required")}`, value: count("Follow-up Required"), color: "#F59E0B" },
    { name: `Quotation · ${count("Quotation Sent")}`, value: count("Quotation Sent"), color: "#0EA5E9" },
    { name: `Customer · ${count("Won Sale")}`, value: count("Won Sale"), color: "#16A34A" },
    { name: `Lost · ${count("Lost Sale", "On Hold")}`, value: count("Lost Sale", "On Hold"), color: "#DC2626" },
  ].filter((item) => item.value > 0);
}

function SupervisorTeamPerformancePanel({ rows }: { rows: SupervisorPerformanceRow[] }) {
  return (
    <SupervisorSurfaceCard
      title="Team Performance"
      subtitle="A live view of marketer execution, communication load, and conversion progress."
      action={<Badge variant="neutral">{rows.length} Marketers</Badge>}
    >
      {rows.length ? (
        <>
          <div className="hidden xl:block overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  {["Employee", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion", "Performance Score"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-black text-white shadow-sm">
                          {initials(row.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{row.name}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.leads}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.calls}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.whatsapp}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.meetings}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.followUps}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.pendingTasks}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.overdueFollowUps}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.sales}</td>
                    <td className="px-3 py-4"><Badge variant={row.sales > 0 ? "success" : "neutral"}>{row.conversionRate}</Badge></td>
                    <td className="px-3 py-4">
                      <div className="min-w-[170px]">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          <span>Performance</span>
                          <span>{row.performanceScore}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-black text-white shadow-sm">
                    {initials(row.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                      </div>
                      <Badge variant={row.sales > 0 ? "success" : "neutral"}>{row.conversionRate}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      {[
                        ["Leads", row.leads],
                        ["Calls", row.calls],
                        ["WhatsApp", row.whatsapp],
                        ["Meetings", row.meetings],
                        ["Follow-ups", row.followUps],
                        ["Pending", row.pendingTasks],
                        ["Overdue", row.overdueFollowUps],
                        ["Sales", row.sales],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 text-base font-black text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                        <span>Performance Score</span>
                        <span>{row.performanceScore}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white">
                        <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <SupervisorEmptyState
          icon={Users}
          title="No marketer performance data available"
          description="Assign marketers to leads and team activities to view performance analytics here."
          className="min-h-[360px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorLeadStatusPanel({ totalLeads, data }: { totalLeads: number; data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <SupervisorSurfaceCard
      title="Lead Status Distribution"
      subtitle="A grouped pipeline view across your supervised team."
      action={<Badge variant="neutral">{totalLeads} Total Leads</Badge>}
      className="h-full"
      contentClassName="h-full min-h-[420px] p-5"
    >
      {data.length ? (
        <div className="h-full">
          <LeadStatusDonut total={totalLeads} data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Target}
          title="No lead distribution available"
          description="Add and progress leads through the pipeline to unlock distribution analytics."
          className="min-h-[340px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorSalesTrendPanel({ data }: { data: Array<{ month: string; sales: number }> }) {
  return (
    <SupervisorSurfaceCard
      title="Sales Trends"
      subtitle="Quotation momentum and closed-value movement over time."
      className="h-full"
      contentClassName="min-h-[340px] p-5"
    >
      {data.length ? (
        <div className="h-[280px]">
          <SalesLineChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={WalletCards}
          title="No sales activity available"
          description="Create quotations and close deals to view analytics."
          className="min-h-[280px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorTopPerformerPanel({ performer }: { performer?: SupervisorPerformanceRow }) {
  return (
    <SupervisorSurfaceCard title="Top Performer" subtitle="Best-performing marketer in the current team snapshot." className="h-full">
      {performer ? (
        <div className="flex h-full flex-col rounded-[18px] bg-[radial-gradient(circle_at_top,#fff6db_0%,#fff7ed_40%,#eff6ff_100%)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
              <Trophy className="h-7 w-7" />
            </div>
            <Badge variant="warning">Top Score {performer.performanceScore}%</Badge>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-950 to-slate-700 text-lg font-black text-white shadow-lg">
              {initials(performer.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black text-slate-950">{performer.name}</h3>
              <p className="truncate text-sm font-semibold text-slate-500">{performer.designation !== "-" ? performer.designation : performer.role}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Leads", performer.leads],
              ["Follow-ups", performer.followUps],
              ["Sales", performer.sales],
              ["Conversion", performer.conversionRate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/90 bg-white/90 px-3 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
              <span>Performance Score</span>
              <span>{performer.performanceScore}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/90">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" style={{ width: `${performer.performanceScore}%` }} />
            </div>
          </div>
          <Link href="/supervisor/rewards" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800">
            <Award className="h-4 w-4" />
            Give Reward
          </Link>
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Trophy}
          title="No top performer yet"
          description="Team activity will spotlight your highest-performing marketer automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorPendingFollowUpsPanel({ rows }: { rows: CrmWorkspace["followUps"] }) {
  return (
    <SupervisorSurfaceCard
      title="Pending Follow-ups"
      subtitle="Outstanding customer actions sorted by urgency."
      action={<Badge variant="neutral">{rows.length} Open</Badge>}
      className="h-full"
    >
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((item, index) => {
            const methodVisual = followUpMethodVisual(item.method);
            const MethodIcon = methodVisual.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.18), ease: "easeOut" }}
                className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm", methodVisual.badge === "success" ? "text-emerald-600" : methodVisual.badge === "default" ? "text-blue-600" : methodVisual.badge === "violet" ? "text-violet-600" : "text-amber-600")}>
                    <MethodIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-black text-slate-950">
                        <EntityLink href={item.href} className="font-black">{item.customer}</EntityLink>
                      </p>
                      <Badge variant={methodVisual.badge}>{methodVisual.label}</Badge>
                      <Badge variant={followUpBucketVariant(item.bucket)}>{item.bucket}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.assignedTo}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.followUpDate}</span>
                    </div>
                    {item.note !== "-" ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.note}</p> : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={CalendarClock}
          title="No pending follow-ups"
          description="Your team is clear for now. New reminders will appear here automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductInterestPanel({ data }: { data: Array<{ name: string; leads: number }> }) {
  return (
    <SupervisorSurfaceCard
      title="Product-wise Interest"
      subtitle="Top products attracting the highest customer demand."
      className="h-full"
      contentClassName="min-h-[320px] p-5"
    >
      {data.length ? (
        <div className="h-[250px]">
          <ProductBarChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={BriefcaseBusiness}
          title="No product interest available"
          description="As marketers discuss products with leads and customers, demand insights will appear here."
          className="min-h-[250px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductIntelligencePanel({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    {
      title: "Top 5 Most Engaged Products",
      rows: workspace.productIntelligence.topEngaged,
      badgeVariant: "default" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} interested companies · ${item.followUpCount} follow-ups`,
    },
    {
      title: "Highest Conversion Products",
      rows: workspace.productIntelligence.highestConversion,
      badgeVariant: "success" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.salesCount} sales · ${item.quotationCount} quotations`,
    },
    {
      title: "Most Discussed Products",
      rows: workspace.productIntelligence.mostDiscussed,
      badgeVariant: "warning" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} discussions`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} companies · ${item.followUpCount} follow-ups`,
    },
  ] as const;

  return (
    <div className="grid gap-6 xl:grid-cols-3" data-supervisor-section>
      {panels.map((panel) => (
        <SupervisorSurfaceCard key={panel.title} title={panel.title} className="h-full">
          {panel.rows.length ? (
            <div className="space-y-3">
              {panel.rows.map((item, index) => (
                <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="flex items-start justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-slate-700 shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{panel.description(item)}</p>
                    </div>
                  </div>
                  <Badge variant={panel.badgeVariant}>{panel.metric(item)}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <SupervisorEmptyState
              icon={BriefcaseBusiness}
              title="No product intelligence yet"
              description="Once team conversations, follow-ups, and quotations increase, product intelligence rankings will show here."
              className="min-h-[260px]"
            />
          )}
        </SupervisorSurfaceCard>
      ))}
    </div>
  );
}

function buildSupervisorLeadStatusDataV2(workspace: CrmWorkspace) {
  const pipelineMap = new Map(workspace.pipeline.map((item) => [item.label, item.value]));
  const count = (...labels: string[]) => labels.reduce((sum, label) => sum + (pipelineMap.get(label) ?? 0), 0);

  return [
    { name: "New Leads", value: count("New Lead"), color: "#2563EB" },
    { name: "Qualified", value: count("Contacted", "Interested", "Negotiation"), color: "#22C55E" },
    { name: "Follow-up", value: count("Follow-up Required"), color: "#F59E0B" },
    { name: "Quotation", value: count("Quotation Sent"), color: "#FB923C" },
    { name: "Customer", value: count("Won Sale"), color: "#06B6D4" },
    { name: "Lost", value: count("Lost Sale", "On Hold"), color: "#EF4444" },
  ].filter((item) => item.value > 0);
}

function SupervisorTeamPerformancePanelV2({ rows }: { rows: SupervisorPerformanceRow[] }) {
  return (
    <SupervisorSurfaceCard
      title="Team Performance"
      action={<SupervisorHeaderAction href={rolePath("SUPERVISOR", "team")}>View All</SupervisorHeaderAction>}
    >
      {rows.length ? (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  {["Employee", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion", "Score"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                          {initials(row.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{row.name}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.leads}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.calls}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.whatsapp}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.meetings}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.followUps}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.pendingTasks}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.overdueFollowUps}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.sales}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.conversionRate}</td>
                    <td className="px-3 py-4">
                      <div className="min-w-[152px]">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          <span>Score</span>
                          <span>{row.performanceScore}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                    {initials(row.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{row.conversionRate}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      {[
                        ["Leads", row.leads],
                        ["Calls", row.calls],
                        ["WhatsApp", row.whatsapp],
                        ["Meetings", row.meetings],
                        ["Follow-ups", row.followUps],
                        ["Pending", row.pendingTasks],
                        ["Overdue", row.overdueFollowUps],
                        ["Sales", row.sales],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 text-base font-black text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                        <span>Performance Score</span>
                        <span>{row.performanceScore}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <SupervisorEmptyState
          icon={Users}
          title="No marketer performance data available"
          description="Assign marketers to leads and team activities to view performance analytics here."
          className="min-h-[360px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorLeadStatusPanelV2({ totalLeads, data }: { totalLeads: number; data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <SupervisorSurfaceCard
      title="Lead Status Distribution"
      className="h-full"
      contentClassName="h-full min-h-[420px] p-5"
    >
      {data.length ? (
        <div className="h-full">
          <LeadStatusDonut total={totalLeads} data={data} detailedLegend />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Target}
          title="No lead distribution available"
          description="Add and progress leads through the pipeline to unlock distribution analytics."
          className="min-h-[340px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorSalesTrendPanelV2({ data }: { data: Array<{ month: string; sales: number }> }) {
  return (
    <SupervisorSurfaceCard
      title="Sales Trends"
      action={<SupervisorHeaderAction>This Month</SupervisorHeaderAction>}
      className="h-full"
      contentClassName="min-h-[340px] p-5"
    >
      {data.length ? (
        <div className="h-[280px]">
          <SalesLineChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={WalletCards}
          title="No sales activity available"
          description="Create quotations and close deals to view analytics."
          className="min-h-[280px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorTopPerformerPanelV2({ performer }: { performer?: SupervisorPerformanceRow }) {
  return (
    <SupervisorSurfaceCard title="Top Performer" className="h-full">
      {performer ? (
        <div className="flex h-full flex-col rounded-[20px] bg-[radial-gradient(circle_at_top,#fff9e9_0%,#fff5de_36%,#f8fbff_100%)] p-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500 shadow-sm">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-[1.5rem] font-black text-slate-950">{performer.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{performer.designation !== "-" ? performer.designation : performer.role}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Leads", performer.leads],
              ["Follow-ups", performer.followUps],
              ["Sales", performer.sales],
              ["Conversion", performer.conversionRate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <Badge variant="warning" className="mx-auto mt-5">Top Score {performer.performanceScore}%</Badge>
          <Link href="/supervisor/rewards" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700">
            <Award className="h-4 w-4" />
            Give Reward
          </Link>
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Trophy}
          title="No top performer yet"
          description="Team activity will spotlight your highest-performing marketer automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorPendingFollowUpsPanelV2({ rows }: { rows: CrmWorkspace["followUps"] }) {
  return (
    <SupervisorSurfaceCard
      title="Pending Follow-ups"
      action={<SupervisorHeaderAction href={rolePath("SUPERVISOR", "follow-ups")}>View All</SupervisorHeaderAction>}
      className="h-full"
    >
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((item, index) => {
            const methodVisual = followUpMethodVisual(item.method);
            const MethodIcon = methodVisual.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.18), ease: "easeOut" }}
                className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm", methodVisual.badge === "success" ? "text-emerald-600" : methodVisual.badge === "default" ? "text-blue-600" : methodVisual.badge === "violet" ? "text-violet-600" : "text-amber-600")}>
                    <MethodIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-black text-slate-950">
                        <EntityLink href={item.href} className="font-black">{item.customer}</EntityLink>
                      </p>
                      <Badge variant={followUpBucketVariant(item.bucket)}>{item.bucket}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{methodVisual.label} - {item.note !== "-" ? item.note : item.assignedTo}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.bucket === "Overdue" ? `Overdue follow-up - ${item.followUpDate}` : `Follow-up date - ${item.followUpDate}`}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={CalendarClock}
          title="No pending follow-ups"
          description="Your team is clear for now. New reminders will appear here automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductInterestPanelV2({ data }: { data: Array<{ name: string; leads: number }> }) {
  const maxLeads = Math.max(1, ...data.map((item) => item.leads));

  return (
    <SupervisorSurfaceCard
      title="Product-wise Interest"
      action={<SupervisorHeaderAction href={rolePath("SUPERVISOR", "reports")}>View Report</SupervisorHeaderAction>}
      className="h-full"
      contentClassName="min-h-[320px] p-5"
    >
      {data.length ? (
        <div className="space-y-5">
          {data.slice(0, 5).map((item) => (
            <div key={item.name} className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)_28px] sm:items-center">
              <p className="truncate text-sm font-semibold text-slate-700">{item.name}</p>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500" style={{ width: `${item.leads === 0 ? 0 : Math.max(10, (item.leads / maxLeads) * 100)}%` }} />
              </div>
              <span className="text-right text-sm font-black text-slate-700">{item.leads}</span>
            </div>
          ))}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={BriefcaseBusiness}
          title="No product interest available"
          description="As marketers discuss products with leads and customers, demand insights will appear here."
          className="min-h-[250px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductIntelligencePanelV2({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    {
      title: "Top 5 Most Engaged Products",
      rows: workspace.productIntelligence.topEngaged,
      badgeVariant: "default" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} leads - ${item.followUpCount} follow-ups - ${item.quotationCount} quotes`,
    },
    {
      title: "Highest Conversion Products",
      rows: workspace.productIntelligence.highestConversion,
      badgeVariant: "success" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.salesCount} sales - ${item.quotationCount} quotations`,
    },
    {
      title: "Most Discussed Products",
      rows: workspace.productIntelligence.mostDiscussed,
      badgeVariant: "warning" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} discussions`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} companies - ${item.followUpCount} follow-ups`,
    },
  ] as const;

  return (
    <div data-supervisor-section>
      <SupervisorSurfaceCard title="Product Intelligence" className="h-full">
        <div className="grid gap-5 xl:grid-cols-3">
          {panels.map((panel) => (
            <div key={panel.title} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-950">{panel.title}</h3>
              {panel.rows.length ? (
                <div className="mt-4 space-y-3">
                  {panel.rows.map((item, index) => (
                    <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="flex items-start justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-blue-700">{index + 1}. {item.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{panel.description(item)}</p>
                      </div>
                      <Badge variant={panel.badgeVariant} className="shrink-0">{panel.metric(item)}</Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <SupervisorEmptyState
                  icon={BriefcaseBusiness}
                  title="No product intelligence yet"
                  description="Once team conversations, follow-ups, and quotations increase, product intelligence rankings will show here."
                  className="mt-4 min-h-[260px]"
                />
              )}
            </div>
          ))}
        </div>
      </SupervisorSurfaceCard>
    </div>
  );
}

type MarketerTaskFilter = "all" | "tasks" | "due-follow-ups" | "overdue" | "carry-forward";

const marketerKpiIcons = [ClipboardCheck, AlertTriangle, PhoneForwarded, Target, CalendarClock, Award] as const;
const marketerKpiIconTones = [
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-700",
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-rose-50 text-rose-700",
  "bg-orange-50 text-orange-700",
] as const;

function marketerTaskIcon(method: string, source: CrmWorkspace["todayWorkItems"][number]["source"]) {
  if (method.toLowerCase().includes("whatsapp")) return MessageCircleMore;
  if (method.toLowerCase().includes("meeting")) return CalendarClock;
  if (method.toLowerCase().includes("phone") || method.toLowerCase().includes("call")) return PhoneCall;
  if (source === "Follow-up") return PhoneForwarded;
  return ClipboardCheck;
}

function marketerTaskAccent(method: string, source: CrmWorkspace["todayWorkItems"][number]["source"], overdue: boolean) {
  if (overdue) return "border-red-200 bg-red-50/80";
  if (method.toLowerCase().includes("whatsapp")) return "border-emerald-200 bg-emerald-50/70";
  if (method.toLowerCase().includes("meeting")) return "border-violet-200 bg-violet-50/70";
  if (method.toLowerCase().includes("phone") || method.toLowerCase().includes("call")) return "border-blue-200 bg-blue-50/70";
  if (source === "Follow-up") return "border-amber-200 bg-amber-50/70";
  return "border-slate-200 bg-slate-50";
}

function marketerActivityIcon(title: string, detail: string) {
  const haystack = `${title} ${detail}`.toLowerCase();
  if (haystack.includes("follow-up")) return { icon: PhoneForwarded, tone: "bg-emerald-50 text-emerald-700" };
  if (haystack.includes("task")) return { icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700" };
  if (haystack.includes("meeting")) return { icon: CalendarClock, tone: "bg-amber-50 text-amber-700" };
  if (haystack.includes("lead")) return { icon: Target, tone: "bg-violet-50 text-violet-700" };
  return { icon: CheckCircle2, tone: "bg-slate-100 text-slate-700" };
}

function MarketerKpiGrid({ workspace, tasks }: { workspace: CrmWorkspace; tasks: CrmWorkspace["todayWorkItems"] }) {
  const pendingTasks = workspace.tasks.filter((task) => task.status !== "COMPLETED").length;
  const newLeads = workspace.leads.filter((lead) => lead.status === "New Lead").length;
  const meetingsToday = Number(workspace.stats.find((item) => item.title === "Meetings Today")?.value ?? 0);
  const rewardPoints = Number(workspace.stats.find((item) => item.title === "Reward Points")?.value ?? 0);
  const cards = [
    { title: "Today's Tasks", value: String(tasks.length), helper: "Unified work queue" },
    { title: "Pending Tasks", value: String(pendingTasks), helper: "Need your action" },
    { title: "Follow-ups Due", value: String(workspace.followUpSummary.overdue + workspace.followUpSummary.today), helper: "Overdue & today" },
    { title: "New Leads", value: String(newLeads), helper: "Assigned leads" },
    { title: "Meetings Today", value: String(meetingsToday), helper: "Scheduled meeting" },
    { title: "Reward Points", value: String(rewardPoints), helper: "This month" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((item, index) => {
        const Icon = marketerKpiIcons[index];
        return (
          <Card key={item.title} className="border-slate-200 shadow-sm">
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", marketerKpiIconTones[index])}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{item.title}</p>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-950">{item.value}</p>
                <p className="mt-2 text-sm text-slate-500">{item.helper}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function MarketerTodayTasksPanel({ workspace }: { workspace: CrmWorkspace }) {
  const [filter, setFilter] = React.useState<MarketerTaskFilter>("all");
  const items = workspace.todayWorkItems.filter((item) => item.source !== "Plan");

  const counts = React.useMemo(() => ({
    all: items.length,
    tasks: items.filter((item) => item.queueType === "TASK").length,
    "due-follow-ups": items.filter((item) => item.queueType === "DUE_FOLLOW_UP").length,
    overdue: items.filter((item) => item.queueType === "OVERDUE").length,
    "carry-forward": items.filter((item) => item.queueType === "CARRY_FORWARD").length,
  }), [items]);

  const filteredItems = React.useMemo(() => {
    if (filter === "tasks") return items.filter((item) => item.queueType === "TASK");
    if (filter === "due-follow-ups") return items.filter((item) => item.queueType === "DUE_FOLLOW_UP");
    if (filter === "overdue") return items.filter((item) => item.queueType === "OVERDUE");
    if (filter === "carry-forward") return items.filter((item) => item.queueType === "CARRY_FORWARD");
    return items;
  }, [filter, items]);

  const chips: { key: MarketerTaskFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "tasks", label: "Tasks" },
    { key: "due-follow-ups", label: "Due Follow-ups" },
    { key: "overdue", label: "Overdue" },
    { key: "carry-forward", label: "Carry Forward" },
  ];

  return (
    <DashboardCard title="Today's Tasks" className="h-full">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-100 hover:text-slate-700",
                )}
              >
                {chip.label}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-500")}>{counts[chip.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {filteredItems.length ? filteredItems.slice(0, 6).map((item) => {
            const Icon = marketerTaskIcon(item.method, item.source);
            return (
              <Link
                key={item.id}
                href={rolePath("MARKETER", "tasks")}
                className={cn("block rounded-2xl border px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", marketerTaskAccent(item.method, item.source, item.overdue))}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm", item.overdue ? "text-red-600" : "text-blue-700")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-black text-slate-950">
                        {item.title}
                        {item.relatedTo !== "-" ? <span className="font-semibold text-slate-500"> - {item.relatedTo}</span> : null}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-slate-700">{item.time}</p>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-xs font-semibold text-slate-500">{item.method}</span>
                      <Badge variant={item.queueType === "OVERDUE" ? "danger" : item.queueType === "DUE_FOLLOW_UP" ? "warning" : "default"}>
                        {item.queueLabel ?? item.status}
                      </Badge>
                      <Badge variant={item.priority === "Urgent" || item.priority === "High" ? "danger" : item.priority === "Medium" ? "warning" : "neutral"}>{item.priority}</Badge>
                    </div>
                  </div>
                </div>
              </Link>
            );
          }) : <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No work items in this view.</p>}
        </div>

        <div className="pt-1 text-center">
          <Link href={rolePath("MARKETER", "tasks")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-blue-700">
            View all tasks
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </DashboardCard>
  );
}

function MarketerLeadPipelinePanel({ workspace }: { workspace: CrmWorkspace }) {
  const cards = [
    { label: "New Lead", match: "New Lead", tone: "border-blue-200 bg-blue-50/60 text-blue-700" },
    { label: "Contacted", match: "Contacted", tone: "border-emerald-200 bg-emerald-50/60 text-emerald-700" },
    { label: "Interested", match: "Interested", tone: "border-violet-200 bg-violet-50/60 text-violet-700" },
    { label: "Quotation Sent", match: "Quotation Sent", tone: "border-amber-200 bg-amber-50/60 text-amber-700" },
    { label: "Won", match: "Won Sale", tone: "border-green-200 bg-green-50/60 text-green-700" },
    { label: "Lost", match: "Lost Sale", tone: "border-red-200 bg-red-50/60 text-red-700" },
  ].map((item) => ({
    ...item,
    value: workspace.pipeline.find((pipeline) => pipeline.label === item.match)?.value ?? 0,
  }));

  return (
    <DashboardCard title="Lead Pipeline" className="h-full">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className={cn("rounded-2xl border p-4 shadow-sm", card.tone)}>
            <p className="text-xs font-bold uppercase tracking-wide">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function MarketerFollowUpCenter({ workspace }: { workspace: CrmWorkspace }) {
  const groups = [
    { title: "Overdue", rows: workspace.followUps.filter((item) => item.bucket === "Overdue"), tone: "text-red-600" },
    { title: "Due Today", rows: workspace.followUps.filter((item) => item.bucket === "Due Today"), tone: "text-amber-600" },
    { title: "Upcoming", rows: workspace.followUps.filter((item) => item.bucket === "Upcoming"), tone: "text-blue-600" },
    { title: "Completed", rows: workspace.followUps.filter((item) => item.bucket === "Completed"), tone: "text-emerald-600" },
  ] as const;

  return (
    <DashboardCard
      title="Follow-up Center"
      action={<Link href={rolePath("MARKETER", "follow-ups")} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">View All <ArrowRight className="h-4 w-4" /></Link>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className={cn("text-sm font-black", group.tone)}>{group.title}</h3>
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-700 shadow-sm">{group.rows.length}</span>
            </div>
            <div className="space-y-3">
              {group.rows.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl bg-white px-3 py-3 shadow-sm">
                  <p className="truncate text-sm font-black text-slate-900">
                    <EntityLink href={item.href} className="font-black">{item.customer}</EntityLink>
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{item.method}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.followUpDate}</p>
                </div>
              ))}
              {!group.rows.length ? <p className="rounded-xl bg-white p-3 text-xs font-semibold text-slate-400">No follow-ups here.</p> : null}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function MarketerRecentActivities({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <DashboardCard
      title="Recent Activities"
      action={<Link href={rolePath("MARKETER", "communication")} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">View All <Eye className="h-4 w-4" /></Link>}
    >
      <div className="space-y-2">
        {workspace.activities.slice(0, 5).map((item) => {
          const activity = marketerActivityIcon(item.title, item.detail);
          const Icon = activity.icon;

          return (
            <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", activity.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-500">{item.detail}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-slate-500">{item.time}</p>
                <p className="mt-1 text-xs text-slate-400">by You</p>
              </div>
            </div>
          );
        })}
        {!workspace.activities.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No recent activities yet.</p> : null}
      </div>
    </DashboardCard>
  );
}

export function MarketerDashboard({ workspace }: { workspace: CrmWorkspace }) {
  const marketerTasks = workspace.todayWorkItems.filter((item) => item.source !== "Plan");

  return (
    <>
      <PageHeader
        title={`Good Morning, ${workspace.user.name} 👋`}
        description="Here’s what’s happening with your sales today."
      />

      <MarketerKpiGrid workspace={workspace} tasks={marketerTasks} />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <MarketerTodayTasksPanel workspace={workspace} />
        <MarketerLeadPipelinePanel workspace={workspace} />
      </div>

      <MarketerFollowUpCenter workspace={workspace} />
      <MarketerRecentActivities workspace={workspace} />
    </>
  );
}

export function SupervisorDashboard({ workspace }: { workspace: CrmWorkspace }) {
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);
  const charts = chartData(workspace);
  const supervisorStats = React.useMemo(() => {
    const requestedTitles = [
      "Total Marketers",
      "Total Leads",
      "Follow-up Due",
      "Overdue Follow-ups",
      "Sales This Month",
      "Conversion Rate",
    ] as const;
    const statMap = new Map(workspace.stats.map((item) => [item.title, item]));
    return requestedTitles
      .map((title) => statMap.get(title))
      .filter((item): item is CrmWorkspace["stats"][number] => Boolean(item));
  }, [workspace.stats]);
  const performanceRows = React.useMemo<SupervisorPerformanceRow[]>(() => {
    const teamRows = workspace.employees.filter((row) => row.role === "Marketer");
    const withRawScore = teamRows.map((row) => ({
      ...row,
      performanceScoreRaw:
        row.sales * 30 +
        row.leads * 7 +
        row.followUps * 5 +
        row.calls * 3 +
        row.whatsapp * 3 +
        row.meetings * 4 -
        row.pendingTasks * 2 -
        row.overdueFollowUps * 8,
    }));
    const highestRaw = Math.max(1, ...withRawScore.map((row) => Math.max(0, row.performanceScoreRaw)));

    return withRawScore
      .map((row) => ({
        ...row,
        performanceScore: Math.max(0, Math.min(100, Math.round((Math.max(0, row.performanceScoreRaw) / highestRaw) * 100))),
      }))
      .sort((left, right) => (
        right.performanceScore - left.performanceScore ||
        right.sales - left.sales ||
        right.leads - left.leads ||
        right.followUps - left.followUps
      ));
  }, [workspace.employees]);
  const leadStatusData = React.useMemo(() => buildSupervisorLeadStatusDataV2(workspace), [workspace]);
  const pendingFollowUps = React.useMemo(() => {
    const bucketRank: Record<string, number> = {
      Overdue: 0,
      "Due Today": 1,
      Upcoming: 2,
      Completed: 3,
    };

    return workspace.followUps
      .filter((item) => item.bucket !== "Completed")
      .sort((left, right) => (bucketRank[left.bucket] ?? 99) - (bucketRank[right.bucket] ?? 99))
      .slice(0, 6);
  }, [workspace.followUps]);

  React.useEffect(() => {
    if (!dashboardRef.current) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-supervisor-kpi]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
      );
      gsap.fromTo(
        "[data-supervisor-section]",
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.1, delay: 0.14, ease: "power2.out" },
      );
    }, dashboardRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={dashboardRef} className="space-y-6">
      <PageHeader
        eyebrow="Supervisor Dashboard"
        title="Team performance overview"
        description="Monitor team leads, due follow-ups, product interest, and target achievement."
        actions={<SupervisorHeaderAction>Current Month</SupervisorHeaderAction>}
      />

      <SupervisorKpiGrid items={supervisorStats} />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]" data-supervisor-section>
        <SupervisorTeamPerformancePanelV2 rows={performanceRows} />
        <SupervisorLeadStatusPanelV2 totalLeads={workspace.leads.length} data={leadStatusData} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.88fr_1fr]" data-supervisor-section>
        <SupervisorSalesTrendPanelV2 data={charts.sales} />
        <SupervisorTopPerformerPanelV2 performer={performanceRows[0]} />
        <SupervisorPendingFollowUpsPanelV2 rows={pendingFollowUps} />
      </div>

      <div data-supervisor-section>
        <SupervisorProductInterestPanelV2 data={charts.products} />
      </div>

      <SupervisorProductIntelligencePanelV2 workspace={workspace} />
    </div>
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

