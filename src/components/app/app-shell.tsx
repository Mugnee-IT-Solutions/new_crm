"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { cn, roleLabels, type Role, type ShellUser } from "@/lib/utils";
import type { CrmWorkspace } from "@/lib/crm-data";

type SidebarCounts = Pick<CrmWorkspace, "sidebarCounts">["sidebarCounts"];

function fallbackUser(role: Role): ShellUser {
  return {
    name: roleLabels[role],
    role,
    designation: roleLabels[role],
  };
}

export function AppShell({
  role,
  user,
  unreadCount = 0,
  followUpCount = 0,
  sidebarCounts,
  children,
}: {
  role: Role;
  user?: ShellUser;
  unreadCount?: number;
  followUpCount?: number;
  sidebarCounts?: SidebarCounts;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const shellUser = user ?? fallbackUser(role);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <AppSidebar
          role={role}
          collapsed={collapsed}
          followUpCount={followUpCount}
          sidebarCounts={sidebarCounts}
          onToggle={() => setCollapsed((value) => !value)}
        />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden">
          <div className="h-full w-[280px]">
            <AppSidebar
              role={role}
              collapsed={false}
              followUpCount={followUpCount}
              sidebarCounts={sidebarCounts}
              onToggle={() => setCollapsed((value) => !value)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className={cn("transition-all duration-300", collapsed ? "lg:pl-[82px]" : "lg:pl-[248px]")}>
        <AppHeader role={role} user={shellUser} unreadCount={unreadCount} onOpenSidebar={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
