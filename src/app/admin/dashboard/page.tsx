import { AppShell } from "@/components/app/app-shell";
import { AdminDashboard } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";

export default async function AdminDashboardPage() {
  const user = await requireCurrentUser("ADMIN");
  const workspace = await getCrmWorkspace("ADMIN", user);

  return (
    <AppShell role="ADMIN" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <AdminDashboard workspace={workspace} />
    </AppShell>
  );
}

