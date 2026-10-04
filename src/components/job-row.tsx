import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { JobMeta } from "@/lib/types";
import { CompanyTile, MatchRing, relDate, StatusBadge } from "./ui";

export function JobRow({ job }: { job: JobMeta }) {
  const match = job.match?.after;
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="group flex h-16 items-center gap-4 rounded-xl px-4 transition-colors hover:bg-subtle"
    >
      <CompanyTile name={job.company} />
      <div className="min-w-0 flex-1">
        <p className="t-label truncate text-ink">{job.role}</p>
        <p className="t-body-s truncate text-ink-2">
          {job.company}
          {job.location ? ` · ${job.location}` : ""}
        </p>
      </div>
      <div className="flex w-[104px] items-center gap-1.5">
        {match != null ? (
          <>
            <MatchRing value={match} />
            <span className="t-mono-s text-ink-2">{match}% match</span>
          </>
        ) : (
          <span className="t-mono-s text-ink-3">—</span>
        )}
      </div>
      <div className="w-[96px]">
        <StatusBadge status={job.status} />
      </div>
      <span className="w-[64px] text-right t-body-s text-ink-3">{relDate(job.appliedAt ?? job.createdAt)}</span>
      <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
    </Link>
  );
}
