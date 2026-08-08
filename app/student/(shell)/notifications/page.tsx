"use client";
import { useEffect, useState } from "react";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex flex-col w-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Notifications</h1>
          <p className="text-ink-soft mt-2">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="card text-center text-ink-soft">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="card text-center text-ink-soft">No notifications yet.</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              className={`card cursor-pointer transition-colors ${!n.isRead ? "border-l-4 border-brand" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`font-semibold ${!n.isRead ? "text-ink" : "text-ink-soft"}`}>{n.title}</h3>
                  <p className="text-sm text-ink-soft mt-1">{n.message}</p>
                </div>
                {!n.isRead && <span className="w-2.5 h-2.5 rounded-full bg-brand flex-shrink-0 mt-1" />}
              </div>
              <p className="text-xs text-ink-soft/70 mt-3">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
