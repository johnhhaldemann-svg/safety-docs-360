"use client";

import Link from "next/link";
import { Bell, CheckCheck, Inbox, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import type { CompanyNotification } from "@/types/product-depth";

function priorityClass(priority: string) {
  if (priority === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "high") return "bg-amber-50 text-amber-700 border-amber-200";
  if (priority === "low") return "bg-slate-50 text-slate-500 border-slate-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function NotificationCenter() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<CompanyNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  const hasUnread = unreadCount > 0;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const response = await fetch("/api/company/notifications?limit=12", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | { notifications?: CompanyNotification[]; unreadCount?: number; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Notifications could not be loaded.");
      }
      setNotifications(data?.notifications ?? []);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const id = window.setInterval(() => {
      void loadNotifications();
    }, 60000);
    return () => window.clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const markAllRead = useCallback(async () => {
    const token = await getSupabaseAccessToken();
    if (!token) return;
    await fetch("/api/company/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadNotifications();
  }, [loadNotifications]);

  const markRead = useCallback(
    async (notification: CompanyNotification) => {
      if (notification.readAt) return;
      const token = await getSupabaseAccessToken();
      if (!token) return;
      await fetch(`/api/company/notifications/${encodeURIComponent(notification.id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ read: true }),
      });
      await loadNotifications();
    },
    [loadNotifications]
  );

  const orderedNotifications = useMemo(
    () =>
      notifications.slice().sort((a, b) => {
        if (!a.readAt && b.readAt) return -1;
        if (a.readAt && !b.readAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [notifications]
  );

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--app-border)] bg-white text-[var(--app-text)] shadow-sm transition hover:bg-[var(--app-panel-soft)]"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,26rem)] rounded-xl border border-[var(--app-border)] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] pb-3">
            <div>
              <div className="text-sm font-bold text-[var(--app-text-strong)]">Notifications</div>
              <div className="text-xs text-[var(--app-muted)]">
                {hasUnread ? `${unreadCount} unread` : "All caught up"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={!hasUnread}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)] disabled:opacity-40"
                aria-label="Mark all notifications read"
              >
                <CheckCheck aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)]"
                aria-label="Close notifications"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : orderedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] px-4 py-8 text-center">
                <Inbox aria-hidden="true" className="h-5 w-5 text-[var(--app-muted)]" />
                <div className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">No notifications</div>
                <div className="mt-1 text-xs text-[var(--app-muted)]">Important work will appear here.</div>
              </div>
            ) : (
              orderedNotifications.map((notification) => {
                const content = (
                  <div
                    className={`rounded-lg border px-3 py-2.5 transition ${
                      notification.readAt
                        ? "border-[var(--app-border)] bg-white"
                        : "border-[var(--app-accent-border-22)] bg-[var(--app-accent-primary-soft)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[var(--app-text-strong)]">
                          {notification.title}
                        </div>
                        {notification.body ? (
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--app-text)]">
                            {notification.body}
                          </div>
                        ) : null}
                      </div>
                      <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${priorityClass(notification.priority)}`}>
                        {notification.priority}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      {formatNotificationTime(notification.createdAt)}
                    </div>
                  </div>
                );

                if (notification.href) {
                  return (
                    <Link
                      key={notification.id}
                      href={notification.href}
                      onClick={() => {
                        setOpen(false);
                        void markRead(notification);
                      }}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void markRead(notification)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
