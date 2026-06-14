import { AppShell } from "@/components/app/app-shell";
import { LeadDetailsPage } from "@/components/crm/resource-pages";
import { getLeadDetail } from "@/lib/crm-data";
import { getWorkspaceContext } from "@/lib/page-context";
import { getCurrentRole } from "@/lib/server-role";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, role] = await Promise.all([params, getCurrentRole()]);
  const { user, workspace } = await getWorkspaceContext(role);
  const detail = await getLeadDetail(id, role, user);
  return <AppShell role={role} user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><LeadDetailsPage role={role} workspace={detail.workspace} lead={detail.lead} /></AppShell>;
}

