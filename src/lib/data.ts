import { connection } from "next/server";
import { displayPath, TAILOR_HOME } from "./paths";
import { getSettings, listJobs, listResumes } from "./store";
import type { JobMeta, Reminder } from "./types";

/** Every page reads the local filesystem, so always render at request time. */
export async function fresh() {
  await connection();
}

export type UpcomingReminder = Reminder & { job: Pick<JobMeta, "slug" | "company" | "role"> };

export function upcomingReminders(jobs: JobMeta[]): UpcomingReminder[] {
  return jobs
    .flatMap((j) => j.reminders.filter((r) => !r.done).map((r) => ({ ...r, job: { slug: j.slug, company: j.company, role: j.role } })))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Follow-up nudges: applied ≥ 7 days ago and still "applied". */
export function followUps(jobs: JobMeta[]) {
  const week = 7 * 86_400_000;
  return jobs.filter((j) => j.status === "applied" && j.appliedAt && Date.now() - new Date(j.appliedAt).getTime() >= week);
}

export async function shellData() {
  await fresh();
  const [jobs, resumes, settings] = await Promise.all([listJobs(), listResumes(), getSettings()]);
  const due = upcomingReminders(jobs).filter((r) => new Date(r.at).getTime() <= Date.now() + 86_400_000).length + followUps(jobs).length;
  return {
    counts: { jobs: jobs.length, resumes: resumes.length, reminders: due },
    home: displayPath(TAILOR_HOME),
    userName: settings.userName,
    unread: due,
  };
}

export function groupReminders(reminders: UpcomingReminder[]) {
  const now = Date.now();
  const endOfToday = new Date().setHours(23, 59, 59, 999);
  const t = (r: UpcomingReminder) => new Date(r.at).getTime();
  return [
    { title: "Overdue", items: reminders.filter((r) => t(r) < now) },
    { title: "Today", items: reminders.filter((r) => t(r) >= now && t(r) <= endOfToday) },
    { title: "Upcoming", items: reminders.filter((r) => t(r) > endOfToday) },
  ].filter((g) => g.items.length);
}
