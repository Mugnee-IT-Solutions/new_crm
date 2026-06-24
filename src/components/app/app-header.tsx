"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { Bell, CheckCheck, LogOut, Menu, MessageSquare, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationCenterContext } from "@/components/app/app-shell";
import { cn, roleLabels, type Role, type ShellUser, initials } from "@/lib/utils";

function notificationPageHref(role: Role) {
  return role === "ADMIN" ? "/admin/notifications" : role === "SUPERVISOR" ? "/supervisor/communication" : "/marketer/communication";
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
  const {
    notifications,
    loading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useNotificationCenterContext();
  const [open, setOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
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

          <div ref={notificationRef} className="relative">
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Notifications"
                onClick={() => setOpen((value) => !value)}
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
