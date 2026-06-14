import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";
import type { Role } from "@/lib/utils";

export async function getWorkspaceContext(role: Role) {
  const user = await requireCurrentUser(role);
  const workspace = await getCrmWorkspace(role, user);
  return { user, workspace };
}
