"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, MessageSquare, CheckCircle, Clock, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: 'agent_message' | 'review_complete' | 'task_due';
  title: string;
  body: string | null;
  conversationId: string | null;
  createdAt: string;
}

const TYPE_ICONS = {
  agent_message: MessageSquare,
  review_complete: CheckCircle,
  task_due: Clock,
};

const TYPE_COLORS = {
  agent_message: "text-blue-400",
  review_complete: "text-green-400",
  task_due: "text-amber-400",
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications([]);
  };

  const handleClick = (notification: Notification) => {
    markRead(notification.id);
    if (notification.conversationId) {
      router.push(`/dashboard?conversation=${notification.conversationId}`);
    }
    setShowDropdown(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-1.5 rounded-md hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <Bell size={16} className="text-[var(--text-muted)]" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text)]">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                No new notifications
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type];
                const color = TYPE_COLORS[n.type];
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] cursor-pointer border-b border-[var(--border)] last:border-0 transition-colors"
                    onClick={() => handleClick(n)}
                  >
                    <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text)] truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
