import { AppShell } from "@/components/app/app-shell";
import { FollowUpsPage } from "@/components/crm/resource-pages";
import { getFollowUpPageData, type FollowUpQuery } from "@/lib/crm-data";
import { getWorkspaceContext } from "@/lib/page-context";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { user, workspace } = await getWorkspaceContext("SUPERVISOR");
  const followUpPage = await getFollowUpPageData("SUPERVISOR", user, params as FollowUpQuery);
  return <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><FollowUpsPage workspace={workspace} followUpPage={followUpPage} /></AppShell>;
}

