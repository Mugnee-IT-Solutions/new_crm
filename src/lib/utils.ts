import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Role = "ADMIN" | "SUPERVISOR" | "MARKETER";

export type ShellUser = {
  id?: string;
  name: string;
  mobile?: string;
  email?: string | null;
  role: Role;
  designation?: string | null;
  avatar?: string | null;
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  MARKETER: "Marketer",
};

export const roleHome: Record<Role, string> = {
  ADMIN: "/admin/dashboard",
  SUPERVISOR: "/supervisor/dashboard",
  MARKETER: "/marketer/dashboard",
};

export function rolePath(role: Role, path: string) {
  const prefix = role === "ADMIN" ? "admin" : role === "SUPERVISOR" ? "supervisor" : "marketer";
  return `/${prefix}/${path}`;
}

export function formatCurrency(value: number) {
  return `BDT ${new Intl.NumberFormat("en-US").format(value)}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
