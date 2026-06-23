import { AppShell } from "@/components/app/app-shell";
import { SupervisorDashboard } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";

type TeamPerformancePeriod = "today" | "week" | "month" | "year" | "custom";

export default async function SupervisorDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawPeriod = params.performancePeriod;
  const isValidPeriod = (value: string | string[] | undefined): value is TeamPerformancePeriod => {
    const period = Array.isArray(value) ? value[0] : value;
    return period === "today" || period === "week" || period === "month" || period === "year" || period === "custom";
  };
  const period = isValidPeriod(rawPeriod) ? (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) : "month";
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  const user = await requireCurrentUser("SUPERVISOR");
  const workspace = await getCrmWorkspace("SUPERVISOR", user, { period, from, to });

  return (
    <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <SupervisorDashboard workspace={workspace} />
    </AppShell>
  );
}

