import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, Plus, Send, Sparkles } from "lucide-react";
import { JobRow } from "@/components/job-row";
import { CountUp, GrowBar, GrowColumn, Item, Sparkline, Stagger } from "@/components/motion";
import { PageBody, TopBar } from "@/components/topbar";
import { ButtonLink, Card, CardHeader, cx, Empty, relDate } from "@/components/ui";
import { computeStats } from "@/lib/analytics";
import { followUps, fresh, shellData, upcomingReminders } from "@/lib/data";
import { getSettings, listJobs, listResumes } from "@/lib/store";

export default async function Dashboard() {
  await fresh();
  const [jobs, resumes, settings, shell] = await Promise.all([listJobs(), listResumes(), getSettings(), shellData()]);
  if (!jobs.length && !resumes.length) redirect("/welcome");

  const s = computeStats(jobs);
  const greeting = greet(settings.userName);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const upNext = [
    ...upcomingReminders(jobs).slice(0, 4).map((r) => ({
      key: r.id,
      icon: CalendarDays,
      title: r.title,
      body: `${r.job.company} · ${new Date(r.at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      href: `/jobs/${r.job.slug}`,
    })),
    ...followUps(jobs).slice(0, 3).map((j) => ({
      key: `f-${j.slug}`,
      icon: Bell,
      title: `Follow up with ${j.company}`,
      body: `Applied ${relDate(j.appliedAt).toLowerCase()} · no reply yet`,
      href: `/jobs/${j.slug}`,
    })),
    ...jobs
      .filter((j) => j.status === "draft" && j.match)
      .slice(0, 2)
      .map((j) => ({ key: `r-${j.slug}`, icon: Sparkles, title: `${j.company} resume is ready`, body: "Review it, then mark as applied", href: `/jobs/${j.slug}` })),
  ].slice(0, 4);

  const funnel = [
    { label: "Tailored", value: s.tailored, color: "bg-iris-200" },
    { label: "Applied", value: s.applied, color: "bg-iris-300" },
    { label: "Interview", value: s.interviews, color: "bg-iris-500" },
    { label: "Offer", value: s.offers, color: "bg-mint-500" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));
  const weekMax = Math.max(1, ...s.weekly.map((w) => w.count));

  return (
    <>
      <TopBar
        eyebrow={today}
        title={greeting}
        unread={shell.unread}
        actions={
          <ButtonLink href="/tailor">
            <Plus strokeWidth={2} /> New tailoring
          </ButtonLink>
        }
      />
      <PageBody>
        <Stagger className="grid grid-cols-4 gap-4">
          <Kpi label="Applications" value={s.applied} delta={s.thisWeek ? `+${s.thisWeek} this week` : "none this week"} spark={s.daily} />
          <Kpi label="Response rate" value={s.responseRate} suffix="%" delta={`${s.interviews} replied with interviews`} spark={s.daily} />
          <Kpi label="Interviews" value={s.interviews} delta={s.offers ? `${s.offers} offer${s.offers > 1 ? "s" : ""}` : "keep going"} spark={s.daily} />
          <Kpi label="Avg. match" value={s.avgMatch} suffix="%" delta={s.avgBefore ? `up from ${s.avgBefore}%` : "after tailoring"} spark={s.daily} />
        </Stagger>

        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
          <Card className="flex flex-col gap-[18px] p-6">
            <CardHeader title="Pipeline" aside="All time" />
            {funnel.map((f, i) => {
              const prev = i ? funnel[i - 1].value : 0;
              return (
                <div key={f.label} className="flex items-center gap-3.5">
                  <span className="w-[84px] t-label text-ink-2">{f.label}</span>
                  <div className="h-[30px] flex-1 overflow-hidden rounded-lg bg-subtle">
                    <GrowBar pct={(f.value / funnelMax) * 100} delay={i * 0.06} className={cx("h-full rounded-lg", f.color)} />
                  </div>
                  <span className="w-7 text-right t-mono text-ink">{f.value}</span>
                  <span className="w-9 text-right t-mono-s text-ink-3">{i && prev ? `${Math.round((f.value / prev) * 100)}%` : "—"}</span>
                </div>
              );
            })}
          </Card>
          <Card className="flex flex-col gap-4 p-6">
            <CardHeader title="Applications per week" aside="8 wks" />
            <div className="flex h-[150px] items-end gap-3">
              {s.weekly.map((w, i) => (
                <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className={cx("t-mono-s", i === 7 ? "text-ink-accent" : "text-ink-3")}>{w.count}</span>
                  <div className="flex h-[110px] w-full items-end">
                    <GrowColumn
                      pct={(w.count / weekMax) * 100}
                      delay={i * 0.04}
                      className={cx("w-full rounded-t-lg rounded-b", i === 7 ? "bg-accent" : "bg-accent/30")}
                    />
                  </div>
                  <span className="t-mono-s text-ink-3">{w.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid flex-1 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
          <Card className="flex flex-col p-3">
            <CardHeader
              className="px-3 py-2"
              title="Recent applications"
              aside={
                <Link href="/jobs" className="text-ink-accent hover:underline">
                  View all →
                </Link>
              }
            />
            {jobs.length ? (
              <Stagger>
                {jobs.slice(0, 5).map((j) => (
                  <Item key={j.slug}>
                    <JobRow job={j} />
                  </Item>
                ))}
              </Stagger>
            ) : (
              <Empty title="No applications yet." action={<ButtonLink href="/tailor">Tailor your first resume</ButtonLink>}>
                Paste a job description and Claude will tailor your CV for it.
              </Empty>
            )}
          </Card>
          <Card className="flex flex-col gap-2.5 p-5">
            <CardHeader title="Up next" aside={`${upNext.length} item${upNext.length === 1 ? "" : "s"}`} className="pb-1" />
            {upNext.length ? (
              upNext.map(({ key, icon: Icon, title, body, href }) => (
                <Link key={key} href={href} className="flex items-start gap-3 rounded-2xl bg-subtle px-4 py-3 transition-colors hover:bg-muted">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-subtle">
                    <Icon className="size-4 text-accent" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block t-label truncate text-ink">{title}</span>
                    <span className="block t-body-s truncate text-ink-2">{body}</span>
                  </span>
                </Link>
              ))
            ) : (
              <Empty title="All clear.">Reminders and follow-ups show up here.</Empty>
            )}
            <div className="flex-1" />
            <Link href="/outreach" className="flex items-center gap-2 px-1 t-label-s text-ink-accent hover:underline">
              <Send className="size-3.5" strokeWidth={1.75} /> Draft a LinkedIn message
            </Link>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function Kpi({ label, value, suffix = "", delta, spark }: { label: string; value: number; suffix?: string; delta: string; spark: number[] }) {
  return (
    <Item>
      <Card className="flex flex-col gap-1.5 rounded-2xl p-5">
        <span className="t-overline text-ink-3">{label}</span>
        <div className="flex items-baseline gap-2.5">
          <span className="t-h1 text-ink tabular-nums">
            <CountUp value={value} suffix={suffix} />
          </span>
          <span className={cx("t-label-s truncate", value > 0 ? "text-ok" : "text-ink-3")}>{delta}</span>
        </div>
        <Sparkline points={spark} className="h-9 w-full" />
      </Card>
    </Item>
  );
}

function greet(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}
