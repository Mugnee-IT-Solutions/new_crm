import { AppShell } from "@/components/app/app-shell";
import { ReportsPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("ADMIN");
  return <AppShell role="ADMIN" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><ReportsPage workspace={workspace} /></AppShell>;
}

