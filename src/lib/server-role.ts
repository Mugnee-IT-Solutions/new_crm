import { cookies } from "next/headers";
import type { Role } from "@/lib/utils";

const roles: Role[] = ["ADMIN", "SUPERVISOR", "MARKETER"];

export async function getCurrentRole(): Promise<Role> {
  const store = await cookies();
  const role = store.get("crm_role")?.value as Role | undefined;
  return role && roles.includes(role) ? role : "MARKETER";
}
