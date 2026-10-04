import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays } from "lucide-react";
import { EnableNotifications } from "./enable";
import { PageBody, TopBar } from "@/components/topbar";
import { Card, CompanyTile, cx, Empty, relDate } from "@/components/ui";
import { followUps, fresh, groupReminders, shellData, upcomingReminders } from "@/lib/data";
import { listJobs } from "@/lib/store";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  await fresh();
  const [jobs, shell] = await Promise.all([listJobs(), shellData()]);
  const reminders = upcomingReminders(jobs);
  const groups = groupReminders(reminders);
  const nudges = followUps(jobs);

  return (
    <>
      <TopBar eyebrow="Follow-ups and interview prep" title="Reminders" unread={shell.unread} actions={<EnableNotifications />} />
      <PageBody>
        <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5">
          <Card className="flex flex-col gap-5 p-6">
            {groups.length ? (
              groups.map((g) => (
                <div key={g.title} className="flex flex-col gap-1.5">
                  <p className={cx("t-overline", g.title === "Overdue" ? "text-bad" : "text-ink-3")}>{g.title}</p>
                  {g.items.map((r) => (
                    <Link key={r.id} href={`/jobs/${r.job.slug}`} className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 hover:bg-subtle">
                      <span className="grid size-9 place-items-center rounded-[10px] bg-accent-subtle">
                        <CalendarDays className="size-4 text-accent" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block t-label truncate text-ink">{r.title}</span>
                        <span className="block t-body-s text-ink-2">
                          {r.job.company} · {r.job.role}
                        </span>
                      </span>
                      <span className="t-mono-s text-ink-2">
                        {new Date(r.at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </Link>
                  ))}
                </div>
              ))
            ) : (
              <Empty title="Nothing scheduled.">Add reminders from any job folder — “follow up in 1 week” is a good default after applying.</Empty>
            )}
          </Card>
          <Card className="flex flex-col gap-2 self-start p-5">
            <div className="flex items-center gap-2 pb-1">
              <Bell className="size-[18px] text-warn" strokeWidth={1.75} />
              <h2 className="t-h3 text-ink">Time to follow up</h2>
            </div>
            <p className="t-body-s text-ink-3">Applied 7+ days ago, no reply recorded.</p>
            {nudges.length ? (
              nudges.map((j) => (
                <Link key={j.slug} href={`/outreach?job=${j.slug}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-subtle">
                  <CompanyTile name={j.company} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block t-label truncate text-ink">{j.company}</span>
                    <span className="block t-body-s text-ink-3">Applied {relDate(j.appliedAt)}</span>
                  </span>
                  <span className="t-label-s text-ink-accent">Draft →</span>
                </Link>
              ))
            ) : (
              <p className="py-3 t-body-s text-ink-2">You’re all caught up.</p>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
