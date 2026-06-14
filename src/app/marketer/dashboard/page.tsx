import { AppShell } from "@/components/app/app-shell";
import { MarketerDashboard } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";

export default async function MarketerDashboardPage() {
  const user = await requireCurrentUser("MARKETER");
  const workspace = await getCrmWorkspace("MARKETER", user);

  return (
    <AppShell role="MARKETER" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <MarketerDashboard workspace={workspace} />
    </AppShell>
  );
}

