import { AppShell } from "@/components/app/app-shell";
import { SupervisorDashboard } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";

export default async function SupervisorDashboardPage() {
  const user = await requireCurrentUser("SUPERVISOR");
  const workspace = await getCrmWorkspace("SUPERVISOR", user);

  return (
    <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <SupervisorDashboard workspace={workspace} />
    </AppShell>
  );
}

