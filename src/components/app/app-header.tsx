"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ArrowRight, Bell, CheckCheck, LogOut, Menu, MessageSquare, Search, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationCenterContext } from "@/components/app/app-shell";
import { formatCrmDate } from "@/lib/crm-time";
import { cn, initials, roleLabels, rolePath, type Role, type ShellUser } from "@/lib/utils";

function notificationPageHref(role: Role) {
  return role === "ADMIN" ? "/admin/notifications" : role === "SUPERVISOR" ? "/supervisor/communication" : "/marketer/communication";
}

type ActivitySearchResultRow = {
  id: string;
  href?: string;
  actionHref?: string;
  title: string;
  detail: string;
  badgeLabel: string;
  category: string;
  customerName: string;
  employeeName: string;
  discussionSummary: string;
  time: string;
  taskId?: string;
  followUpId?: string;
};

const activitySearchSuggestions = ["Call", "Demo", "Follow-up", "Quotation", "Win", "Lost"] as const;

function activitySearchBadgeVariant(category?: string) {
  if (category === "CALL") return "warning" as const;
  if (category === "FOLLOW_UP") return "violet" as const;
  if (category === "QUOTATION") return "success" as const;
  if (category === "LEAD") return "default" as const;
  return "neutral" as const;
}

function activitySearchBadgeVariantFromItem(item: Pick<ActivitySearchResultRow, "category" | "badgeLabel">) {
  const badge = item.badgeLabel?.toUpperCase() ?? "";

  if (badge === "CALL") return "warning" as const;
  if (badge === "DEMO") return "violet" as const;
  if (badge === "FOLLOW-UP") return "violet" as const;
  if (badge === "QUOTATION") return "success" as const;
  if (badge === "WIN") return "success" as const;
  if (badge === "LOST") return "danger" as const;

  return activitySearchBadgeVariant(item.category);
}

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
  const router = useRouter();
  const {
    notifications,
    loading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useNotificationCenterContext();
  const [open, setOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = React.useState<ActivitySearchResultRow[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const notificationRef = React.useRef<HTMLDivElement | null>(null);
  const dropdownPanelRef = React.useRef<HTMLDivElement | null>(null);
  const profileRef = React.useRef<HTMLDivElement | null>(null);
  const profileButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const profilePanelRef = React.useRef<HTMLDivElement | null>(null);
  const [profilePanelStyle, setProfilePanelStyle] = React.useState({
    top: 0,
    left: 0,
    width: 296,
    maxHeight: 320,
  });

  function handleLogout() {
    document.cookie = "crm_role=; path=/; max-age=0";
    document.cookie = "crm_mobile=; path=/; max-age=0";
    window.location.assign("/login");
  }

  const trimmedSearchQuery = searchQuery.trim();
  const communicationSearchHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (trimmedSearchQuery) params.set("activity", trimmedSearchQuery);
    const queryString = params.toString();
    return `${rolePath(role, "communication")}${queryString ? `?${queryString}` : ""}`;
  }, [role, trimmedSearchQuery]);

  const updateProfilePanelPosition = React.useCallback(() => {
    if (!profileButtonRef.current || typeof window === "undefined") return;

    const viewportPadding = 12;
    const gap = 10;
    const triggerRect = profileButtonRef.current.getBoundingClientRect();
    const preferredWidth = Math.min(320, window.innerWidth - viewportPadding * 2);
    const measuredHeight = profilePanelRef.current?.offsetHeight ?? 240;
    const availableBelow = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
    const availableAbove = triggerRect.top - gap - viewportPadding;
    const placeAbove = availableBelow < Math.min(measuredHeight, 220) && availableAbove > availableBelow;
    const maxHeight = Math.max(180, Math.min(360, placeAbove ? availableAbove : availableBelow));
    const resolvedHeight = Math.min(measuredHeight, maxHeight);
    const top = placeAbove
      ? Math.max(viewportPadding, triggerRect.top - gap - resolvedHeight)
      : Math.min(window.innerHeight - viewportPadding - resolvedHeight, triggerRect.bottom + gap);
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - preferredWidth),
      window.innerWidth - preferredWidth - viewportPadding,
    );

    setProfilePanelStyle({
      top,
      left,
      width: preferredWidth,
      maxHeight,
    });
  }, []);

  React.useEffect(() => {
    if (!open || !dropdownPanelRef.current) return;

    gsap.fromTo(
      dropdownPanelRef.current,
      { y: -8, autoAlpha: 0, scale: 0.98 },
      { y: 0, autoAlpha: 1, scale: 1, duration: 0.2, ease: "power2.out", clearProps: "transform,opacity,visibility" },
    );
  }, [open]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node) &&
        !(profilePanelRef.current?.contains(event.target as Node) ?? false)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (!profileOpen) return;

    const frame = window.requestAnimationFrame(() => {
      updateProfilePanelPosition();
    });
    const handleViewportChange = () => {
      updateProfilePanelPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [profileOpen, updateProfilePanelPosition]);

  React.useEffect(() => {
    const query = deferredSearchQuery.trim();

    if (!searchOpen || !query) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const params = new URLSearchParams({
          q: query,
          limit: "8",
        });
        const response = await fetch(`/api/search/activities?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as {
          success?: boolean;
          message?: string;
          rows?: ActivitySearchResultRow[];
        };

        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? "Activity search failed.");
        }

        React.startTransition(() => {
          setSearchResults(Array.isArray(payload.rows) ? payload.rows : []);
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Activity search failed.");
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredSearchQuery, searchOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-6">
        <Button type="button" variant="outline" size="icon" className="lg:hidden" onClick={onOpenSidebar} aria-label="Open sidebar">
          <Menu className="h-4 w-4" />
        </Button>

        <div ref={searchRef} className="relative hidden flex-1 md:block">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                if (!nextQuery.trim()) {
                  setSearchResults([]);
                  setSearchLoading(false);
                  setSearchError(null);
                }
                setSearchOpen(true);
              }}
              onFocus={() => {
                setOpen(false);
                setProfileOpen(false);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  return;
                }

                if (event.key === "Enter" && trimmedSearchQuery) {
                  event.preventDefault();
                  setSearchOpen(false);
                  router.push(communicationSearchHref);
                }
              }}
              className="pl-9 pr-10"
              placeholder="Search company, phone number, call, follow-up, quotation..."
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchLoading(false);
                  setSearchError(null);
                  setSearchOpen(true);
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <AnimatePresence>
            {searchOpen ? (
              <motion.div
                key="activity-search-dropdown"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(92vw,640px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.14)]"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Live Activity Search</p>
                      <p className="text-xs text-slate-500">Search by company, phone, call, follow-up, quotation, win, or lost and jump into history or edit.</p>
                    </div>
                    <Badge variant="neutral" className="shrink-0">
                      {trimmedSearchQuery ? "Live" : "Keywords"}
                    </Badge>
                  </div>
                </div>

                {!trimmedSearchQuery ? (
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Quick Search</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activitySearchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setSearchQuery(suggestion);
                            setSearchOpen(true);
                            searchInputRef.current?.focus();
                          }}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs font-medium text-slate-500">
                      Type a company name, phone number, or keywords like <span className="font-bold text-slate-700">call</span>, <span className="font-bold text-slate-700">follow-up</span>, <span className="font-bold text-slate-700">quotation</span>, <span className="font-bold text-slate-700">win</span>, or <span className="font-bold text-slate-700">lost</span>.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {searchLoading ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">Searching live CRM activities...</div>
                    ) : searchError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm font-semibold text-red-700">{searchError}</div>
                    ) : searchResults.length ? (
                      <div className="space-y-1.5">
                        {searchResults.map((item) => (
                          <Link
                            key={item.id}
                            href={item.actionHref ?? item.href ?? communicationSearchHref}
                            onClick={() => setSearchOpen(false)}
                            className="block rounded-2xl border border-transparent px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                  <Badge variant={activitySearchBadgeVariantFromItem(item)}>{item.badgeLabel}</Badge>
                                </div>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                  {item.customerName} • {item.employeeName}
                                </p>
                                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                                  {item.discussionSummary || item.detail}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold text-slate-400">{item.time}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                        <p className="text-sm font-bold text-slate-700">No matching activity found</p>
                        <p className="mt-1 text-xs text-slate-500">Try a company name, phone number, or another keyword like call, quotation, win, or lost.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-100 px-4 py-3">
                  <Link
                    href={communicationSearchHref}
                    onClick={() => setSearchOpen(false)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-800 hover:underline"
                  >
                    View all matching activities
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="neutral" className="hidden sm:inline-flex">
            {formatCrmDate(new Date(), "dd MMM yyyy")}
          </Badge>
          <Badge variant="default" className="hidden md:inline-flex">
            {roleLabels[role]}
          </Badge>

          <div ref={notificationRef} className="relative">
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Notifications"
                onClick={() => {
                  setSearchOpen(false);
                  setOpen((value) => !value);
                }}
                className={cn(open ? "border-blue-200 bg-blue-50 text-blue-700" : "")}
              >
                <Bell className="h-4 w-4" />
              </Button>
            </motion.div>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}

            <AnimatePresence>
              {open ? (
                <motion.div
                  key="notification-dropdown"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  ref={dropdownPanelRef}
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.14)]"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Notifications</p>
                      <p className="text-xs text-slate-500">{unreadCount ? `${unreadCount} unread updates` : "No new notifications"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-2.5 text-xs"
                      onClick={async () => {
                        await markAllNotificationsRead();
                      }}
                      disabled={!unreadCount}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all as read
                    </Button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {loading && !notifications.length ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">Loading notifications...</div>
                    ) : notifications.length ? (
                      <div className="space-y-1.5">
                        {notifications.map((item) => (
                          <motion.div key={item.id} layout whileHover={{ y: -1 }}>
                            <Link
                              href={item.href}
                              onClick={async () => {
                                if (!item.read) {
                                  await markNotificationRead(item.id);
                                }
                                setOpen(false);
                              }}
                              className={cn(
                                "flex gap-3 rounded-2xl border px-3 py-3 transition",
                                item.read ? "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50" : "border-blue-100 bg-blue-50/70 hover:border-blue-200 hover:bg-blue-50",
                              )}
                            >
                              <span className={cn(
                                "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                                item.read ? "bg-slate-100 text-slate-500" : "bg-white text-blue-700 shadow-sm",
                              )}>
                                <Bell className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                                  </div>
                                  {!item.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" /> : null}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="text-[11px] font-semibold text-slate-500">{item.type}</span>
                                  <span className="text-[11px] font-semibold text-slate-400">{item.createdAt}</span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                        <p className="text-sm font-bold text-slate-700">No new notifications</p>
                        <p className="mt-1 text-xs text-slate-500">Task, follow-up, and completion alerts will show here.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <Link href={notificationPageHref(role)}>
              <Button type="button" variant="outline" size="icon" aria-label="Messages" className="relative">
                <MessageSquare className="h-4 w-4" />
                {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
              </Button>
            </Link>
          </motion.div>

          <div ref={profileRef} className="relative">
            <motion.button
              ref={profileButtonRef}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 shadow-sm"
              aria-expanded={profileOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setOpen(false);
                setSearchOpen(false);
                setProfileOpen((value) => !value);
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                {initials(user.name)}
              </span>
              <span className="hidden max-w-28 truncate lg:block">{user.name}</span>
            </motion.button>
            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  ref={profilePanelRef}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                  style={profilePanelStyle}
                  className="fixed z-[70] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.16)]"
                >
                  <div className="max-h-full overflow-y-auto p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
                        <p className="truncate text-xs text-slate-500">{user.email ?? user.mobile ?? roleLabels[role]}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      Signed in as {roleLabels[role]}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
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
