"use client";

import { format } from "date-fns";
import { Bell, LogOut, Menu, MessageSquare, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, roleLabels, type Role, type ShellUser, initials } from "@/lib/utils";

export function AppHeader({
  role,
  user,
  unreadCount = 0,
  onOpenSidebar,
}: {
  role: Role;
  user: ShellUser;
  unreadCount?: number;
  onOpenSidebar: () => void;
}) {
  function handleLogout() {
    document.cookie = "crm_role=; path=/; max-age=0";
    document.cookie = "crm_mobile=; path=/; max-age=0";
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-6">
        <Button type="button" variant="outline" size="icon" className="lg:hidden" onClick={onOpenSidebar} aria-label="Open sidebar">
          <Menu className="h-4 w-4" />
        </Button>

        <div className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="max-w-md pl-9" placeholder="Search leads, customers, tasks..." />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="neutral" className="hidden sm:inline-flex">
            {format(new Date(), "MMM d, yyyy")}
          </Badge>
          <Badge variant="default" className="hidden md:inline-flex">
            {roleLabels[role]}
          </Badge>
          <div className="relative">
            <Button type="button" variant="outline" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Messages">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <div className="group relative">
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                {initials(user.name)}
              </span>
              <span className="hidden max-w-28 truncate lg:block">{user.name}</span>
            </button>
            <div
              className={cn(
                "invisible absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 opacity-0 shadow-xl transition",
                "group-hover:visible group-hover:opacity-100",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email ?? user.mobile ?? roleLabels[role]}</p>
                </div>
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleLogout} className="gap-2" aria-label="Logout">
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
