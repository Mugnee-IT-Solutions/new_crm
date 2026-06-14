"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sidebarMenus } from "@/lib/navigation";
import { cn, type Role } from "@/lib/utils";
import type { CrmWorkspace } from "@/lib/crm-data";

type SidebarCounts = Pick<CrmWorkspace, "sidebarCounts">["sidebarCounts"];

export function AppSidebar({
  role,
  collapsed,
  followUpCount = 0,
  onToggle,
  onNavigate,
  sidebarCounts,
}: {
  role: Role;
  collapsed: boolean;
  followUpCount?: number;
  onToggle: () => void;
  onNavigate?: () => void;
  sidebarCounts?: SidebarCounts;
}) {
  const pathname = usePathname();
  const counts = sidebarCounts ?? {
    followUps: followUpCount,
    leads: 0,
    customers: 0,
    todaysPlan: 0,
    products: 0,
    rewards: 0,
  };

  const badgeValue = (label: string) => {
    if (label === "Follow-ups") return counts.followUps;
    if (label === "Leads") return counts.leads;
    if (label === "Customers" || label === "Customers/Companies") return counts.customers;
    if (label === "Today's Plan") return counts.todaysPlan;
    if (label === "Products" || label === "Products/Services") return counts.products;
    if (label === "Rewards") return counts.rewards;
    return undefined;
  };

  const formatCount = (value: number | undefined) => {
    if (typeof value !== "number") return undefined;
    if (!Number.isFinite(value) || Number.isNaN(value)) return undefined;
    return value > 999 ? "999+" : String(value);
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[linear-gradient(180deg,#08163a_0%,#0b1d4d_48%,#091126_100%)] text-white shadow-2xl transition-all duration-300",
        collapsed ? "w-[82px]" : "w-[248px]",
        "relative overflow-hidden",
      )}
    >
      <div className="flex h-20 items-center gap-2 px-4">
        <Link href={sidebarMenus[role][0].href} className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-lg">
            <span className="text-sm font-black">M</span>
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Mugnee CRM</p>
              <p className="truncate text-xs text-blue-100">Smart sales suite</p>
            </div>
          ) : null}
        </Link>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "absolute right-[-18px] top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 rounded-full border border-white/20 bg-[#0d2a6d] text-white shadow-lg transition duration-300 hover:bg-[#16398d]",
          "lg:inline-flex",
        )}
        onClick={onToggle}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {sidebarMenus[role].map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const currentCount = badgeValue(item.label);
          const badgeText = formatCount(currentCount);
          const showBadge = Boolean(badgeText);
          const tooltip = badgeText ? `${item.label} (${badgeText})` : item.label;

          return (
            <Link
              href={item.href}
              key={item.href}
              title={tooltip}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-100 transition",
                active
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/30"
                  : "hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? (
                <>
                  <span className="truncate">{item.label}</span>
                  {showBadge ? (
                    <span
                      className={cn(
                        "ml-auto inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black",
                        active ? "bg-white text-blue-700" : "bg-blue-500/95 text-white",
                      )}
                    >
                      {badgeText}
                    </span>
                  ) : null}
                </>
              ) : showBadge ? (
                <span
                  className={cn(
                    "absolute right-2 top-1/2 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-blue-500/95 px-1 text-[10px] font-black text-white",
                    active ? "bg-white/90 text-blue-700" : "bg-blue-500/95 text-white",
                  )}
                >
                  <span className="inline-flex min-w-5 items-center justify-center">{badgeText}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onNavigate}
        className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white lg:hidden"
        aria-label="Close sidebar"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </aside>
  );
}
