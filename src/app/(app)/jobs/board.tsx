"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bell, CalendarDays } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import type { JobMeta, Status } from "@/lib/types";
import { CompanyTile, cx, MatchRing, relDate, StatusBadge } from "@/components/ui";

const COLUMNS: Status[] = ["tailoring", "draft", "applied", "interview", "offer", "rejected"];

export function Board({ jobs, stale }: { jobs: JobMeta[]; stale: string[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, move] = useOptimistic(jobs, (cur, { slug, status }: { slug: string; status: Status }) =>
    cur.map((j) => (j.slug === slug ? { ...j, status } : j)),
  );

  function drop(slug: string, status: Status) {
    const job = optimistic.find((j) => j.slug === slug);
    if (!job || job.status === status || job.status === "tailoring") return;
    start(async () => {
      move({ slug, status });
      await fetch(`/api/jobs/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", status }) });
      router.refresh();
    });
  }

  const cols = COLUMNS.filter((c) => c !== "tailoring" || optimistic.some((j) => j.status === "tailoring"));

  return (
    <div className="grid flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
      {cols.map((status) => {
        const items = optimistic.filter((j) => j.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.dataset.over = "1";
            }}
            onDragLeave={(e) => delete e.currentTarget.dataset.over}
            onDrop={(e) => {
              delete e.currentTarget.dataset.over;
              drop(e.dataTransfer.getData("text/plain"), status);
            }}
            className="flex min-h-[420px] flex-col gap-2.5 rounded-2xl bg-subtle p-2.5 transition-colors data-[over]:bg-accent-subtle data-[over]:ring-1 data-[over]:ring-accent/40"
          >
            <div className="flex items-center gap-2 px-1 pb-0.5 pt-0.5">
              <StatusBadge status={status} />
              <span className="flex-1" />
              <span className="t-mono-s text-ink-3">{items.length}</span>
            </div>
            {items.map((j) => (
              <JobCard key={j.slug} job={j} stale={stale.includes(j.slug)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function JobCard({ job, stale }: { job: JobMeta; stale: boolean }) {
  const next = job.reminders.find((r) => !r.done);
  return (
    <motion.div layout transition={{ type: "spring", stiffness: 380, damping: 30 }}>
      <Link
        href={job.status === "tailoring" ? `/tailor?job=${job.slug}` : `/jobs/${job.slug}`}
        draggable={job.status !== "tailoring"}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", job.slug)}
        className={cx(
          "flex flex-col gap-2.5 rounded-[14px] border bg-surface px-3.5 pb-3 pt-3.5 shadow-e1 transition-shadow hover:shadow-e2",
          job.status === "tailoring" ? "border-accent/40" : "border-line-subtle",
          job.status === "rejected" && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2.5">
          <CompanyTile name={job.company} size={28} className="rounded-lg t-label-s" />
          <span className="flex-1 truncate t-label-s text-ink-2">{job.company}</span>
          {stale && <Bell className="size-3.5 text-warn" strokeWidth={1.75} />}
          {next && <CalendarDays className="size-3.5 text-accent" strokeWidth={1.75} />}
        </div>
        <p className="t-label text-ink">{job.role}</p>
        {job.status === "tailoring" && <p className="shimmer-text t-mono-s">Claude is tailoring…</p>}
        <div className="flex items-center gap-1.5">
          {job.match ? (
            <>
              <MatchRing value={job.match.after} size={11} />
              <span className="flex-1 t-mono-s text-ink-2">{job.match.after}%</span>
            </>
          ) : (
            <span className="flex-1" />
          )}
          <span className={cx("t-body-s", next ? "text-ink-accent" : "text-ink-3")}>
            {next ? new Date(next.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : relDate(job.appliedAt ?? job.createdAt)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

