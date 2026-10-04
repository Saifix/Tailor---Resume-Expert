import type { JobMeta } from "./types";

const DAY = 86_400_000;
const sentStatuses = new Set(["applied", "interview", "offer", "rejected"]);

export const wasApplied = (j: JobMeta) => sentStatuses.has(j.status) || !!j.appliedAt;
const appliedTime = (j: JobMeta) => new Date(j.appliedAt ?? j.createdAt).getTime();

export function computeStats(jobs: JobMeta[]) {
  const now = Date.now();
  const applied = jobs.filter(wasApplied);
  const interviews = jobs.filter((j) => j.status === "interview" || j.status === "offer" || j.timeline.some((t) => t.type === "interview"));
  const offers = jobs.filter((j) => j.status === "offer");
  const tailored = jobs.filter((j) => j.match || j.timeline.some((t) => t.type === "tailored"));
  const thisWeek = applied.filter((j) => now - appliedTime(j) < 7 * DAY).length;
  const responded = applied.filter((j) => j.status === "interview" || j.status === "offer" || j.timeline.some((t) => t.type === "interview"));
  const matches = jobs.map((j) => j.match?.after).filter((m): m is number => m != null);
  const before = jobs.map((j) => j.match?.before).filter((m): m is number => m != null);

  // Applications per day for the last 14 days (sparkline)
  const daily = Array.from({ length: 14 }, (_, i) => {
    const start = startOfDay(now - (13 - i) * DAY);
    return applied.filter((j) => appliedTime(j) >= start && appliedTime(j) < start + DAY).length;
  });

  // Applications per ISO-ish week for the last 8 weeks
  const weekStart = startOfWeek(now);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const start = weekStart - (7 - i) * 7 * DAY;
    return {
      label: `W${isoWeek(new Date(start))}`,
      count: applied.filter((j) => appliedTime(j) >= start && appliedTime(j) < start + 7 * DAY).length,
    };
  });

  return {
    applied: applied.length,
    thisWeek,
    responseRate: applied.length ? Math.round((responded.length / applied.length) * 100) : 0,
    interviews: interviews.length,
    offers: offers.length,
    tailored: tailored.length,
    avgMatch: matches.length ? Math.round(matches.reduce((a, b) => a + b, 0) / matches.length) : 0,
    avgBefore: before.length ? Math.round(before.reduce((a, b) => a + b, 0) / before.length) : 0,
    daily,
    weekly,
  };
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(t: number) {
  const d = new Date(startOfDay(t));
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return d.getTime() - day * DAY;
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}
