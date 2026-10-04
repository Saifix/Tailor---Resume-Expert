"use client";

import { useEffect } from "react";

type Due = { id: string; at: string; title: string; href: string; body: string };

/** Fires desktop notifications for reminders while Tailor is open in a tab. */
export function ReminderNotifier({ reminders }: { reminders: Due[] }) {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const fired = new Set<string>(JSON.parse(sessionStorage.getItem("tailor-fired") ?? "[]"));
    const timers = reminders
      .filter((r) => !fired.has(r.id))
      .map((r) => {
        const ms = new Date(r.at).getTime() - Date.now();
        if (ms > 24 * 3600_000) return null;
        return setTimeout(() => {
          const n = new Notification(r.title, { body: r.body, tag: r.id });
          n.onclick = () => {
            window.focus();
            window.location.href = r.href;
          };
          fired.add(r.id);
          sessionStorage.setItem("tailor-fired", JSON.stringify([...fired]));
        }, Math.max(0, ms));
      });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [reminders]);
  return null;
}
