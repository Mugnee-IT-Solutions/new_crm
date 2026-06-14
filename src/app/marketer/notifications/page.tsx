import { AppShell } from "@/components/app/app-shell";
import { NotificationsPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("MARKETER");
  return <AppShell role="MARKETER" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><NotificationsPage workspace={workspace} /></AppShell>;
}

