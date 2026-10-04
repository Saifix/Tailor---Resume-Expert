"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BookOpen, Building2, ExternalLink, FileSignature, GraduationCap, Mic, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Phase, RunEvent } from "@/lib/claude";
import type { QualityCheck, Research, WebLink } from "@/lib/types";
import { ChecksList } from "./assist";
import { Button, cx } from "./ui";
import { isLive, useRun } from "./use-run";

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function LinkRow({ l, badge }: { l: WebLink; badge?: string }) {
  return (
    <a href={l.url} target="_blank" rel="noreferrer noopener" className="group flex items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-subtle">
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-ink-3 group-hover:text-accent" strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="block t-label-s text-ink group-hover:text-ink-accent">{l.title}</span>
        <span className="block t-body-s text-ink-3">
          {badge && <span className="mr-1.5 rounded bg-muted px-1 py-px t-mono-s text-ink-2">{badge}</span>}
          {l.note ? `${l.note} · ` : ""}
          {host(l.url)}
        </span>
      </span>
    </a>
  );
}

/** Links Claude found on the web: company context, learning resources for gaps, interview prep. */
export function ResearchCard({ research, compact = false }: { research?: Research; compact?: boolean }) {
  const company = research?.company ?? [];
  const learn = research?.learn ?? [];
  const interview = research?.interview ?? [];
  if (!company.length && !learn.length && !interview.length) return null;
  const topics = [...new Set(learn.map((l) => l.topic))];
  return (
    <section className={cx("flex flex-col gap-3", !compact && "card p-5")}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-[18px] text-accent" strokeWidth={1.75} />
        <h3 className={compact ? "t-overline text-ink-3" : "t-h3 text-ink"}>From the web</h3>
        {research?.researchedAt && <span className="ml-auto t-mono-s text-ink-3">{new Date(research.researchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
      </div>
      {company.length > 0 && (
        <div className="flex flex-col">
          <p className="flex items-center gap-1.5 px-2 pb-1 t-overline text-ink-3">
            <Building2 className="size-3.5" strokeWidth={2} /> The company
          </p>
          {company.map((l) => (
            <LinkRow key={l.url} l={l} />
          ))}
        </div>
      )}
      {topics.length > 0 && (
        <div className="flex flex-col">
          <p className="flex items-center gap-1.5 px-2 pb-1 t-overline text-ink-3">
            <GraduationCap className="size-3.5" strokeWidth={2} /> Learn for your gaps
          </p>
          {topics.map((t) => (
            <div key={t} className="flex flex-col">
              <p className="px-2 pt-1 t-label-s text-ink-accent">{t}</p>
              {learn
                .filter((l) => l.topic === t)
                .map((l) => (
                  <LinkRow key={l.url} l={l} badge={l.kind} />
                ))}
            </div>
          ))}
        </div>
      )}
      {interview.length > 0 && (
        <div className="flex flex-col">
          <p className="flex items-center gap-1.5 px-2 pb-1 t-overline text-ink-3">
            <Mic className="size-3.5" strokeWidth={2} /> Interview prep
          </p>
          {interview.map((l) => (
            <LinkRow key={l.url} l={l} />
          ))}
        </div>
      )}
    </section>
  );
}

function phasesFrom(events: RunEvent[]): Phase[] {
  const map = new Map<string, Phase>();
  for (const e of events) if (e.type === "phase") map.set(e.phase.id, e.phase);
  return [...map.values()];
}

/** Generate / rewrite the cover letter, watch it self-check live, then jump to the letter. */
export function CoverLetterPanel({ slug, exists, checks }: { slug: string; exists: boolean; checks?: QualityCheck[] }) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useRun(runId);
  const live = isLive(run.status);

  useEffect(() => {
    if (run.status === "done") router.push(`/jobs/${slug}?tab=cover`, { scroll: false });
    if (run.status === "error") router.refresh();
  }, [run.status, router, slug]);

  async function go() {
    setError(null);
    const res = await fetch(`/api/jobs/${slug}/cover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: instruction.trim() || undefined }) });
    const json = await res.json();
    if (!res.ok) return setError(json.error ?? "Something went wrong");
    setInstruction("");
    setRunId(json.runId);
  }

  const phases = phasesFrom(run.events);
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <FileSignature className="size-[18px] text-accent" strokeWidth={1.75} />
        <h3 className="t-h3 flex-1 text-ink">Cover letter</h3>
        {exists && !live && <span className="rounded-full bg-ok-bg px-2 py-0.5 t-label-s text-ok">Ready</span>}
      </div>
      {live || (runId && phases.length) ? (
        <ol className="flex flex-col gap-1.5">
          {phases.map((p) => (
            <motion.li key={p.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
              <span
                className={cx(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  p.state === "active" ? "animate-pulse bg-accent" : p.state === "done" ? "bg-ok" : p.state === "warn" ? "bg-warn" : p.state === "error" ? "bg-bad" : "bg-line",
                )}
              />
              <span className="min-w-0">
                <span className={cx("block t-label-s", p.state === "active" ? "shimmer-text" : "text-ink")}>{p.label}</span>
                {p.detail && <span className="block truncate t-body-s text-ink-3">{p.detail}</span>}
              </span>
            </motion.li>
          ))}
          {live && !phases.length && <li className="shimmer-text t-label-s">Starting Claude Code…</li>}
        </ol>
      ) : (
        <>
          <p className="t-body-s text-ink-3">
            {exists
              ? "Ask for changes, or rewrite it from scratch with your latest resume and facts."
              : "One page, in your voice, built only from your resume, facts and the job post — then checked for length, invented claims and AI-sounding phrases."}
          </p>
          {checks && checks.length > 0 && <ChecksList checks={checks} compact />}
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 pl-3.5 focus-within:border-accent focus-within:shadow-ring">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={1}
              placeholder={exists ? "e.g. warmer opening, mention the Geist design system" : "Anything to emphasise? (optional)"}
              className="max-h-32 min-h-9 flex-1 resize-y bg-transparent py-1.5 t-body-s text-ink outline-none placeholder:text-ink-3"
            />
            <Button size="s" onClick={go}>
              {exists ? (
                <>
                  <BookOpen strokeWidth={1.75} /> {instruction.trim() ? "Revise" : "Rewrite"}
                </>
              ) : (
                <>
                  <Sparkles strokeWidth={1.75} /> Generate
                </>
              )}
            </Button>
          </div>
        </>
      )}
      {error && <p className="t-body-s text-bad">{error}</p>}
    </section>
  );
}
