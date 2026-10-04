"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ClipboardList, Copy, HelpCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Phase, RunEvent } from "@/lib/claude";
import type { FormAnswer, QualityCheck } from "@/lib/types";
import { ChecksList } from "./assist";
import { Button, cx } from "./ui";
import { isLive, useRun } from "./use-run";

function parseLimit(q: string): FormAnswer["limit"] {
  const m = /(\d[\d,]*)\s*(characters?|chars?|words?)\b/i.exec(q);
  return m ? { n: Number(m[1].replace(/,/g, "")), unit: /^w/i.test(m[2]) ? "words" : "characters" } : undefined;
}
const lengthOf = (a: string, unit: "characters" | "words") => (unit === "words" ? a.split(/\s+/).filter(Boolean).length : a.length);

function phasesFrom(events: RunEvent[]): Phase[] {
  const map = new Map<string, Phase>();
  for (const e of events) if (e.type === "phase") map.set(e.phase.id, e.phase);
  return [...map.values()];
}

/** Paste an application form's questions → Claude answers each one, within limits, in your voice. */
export function FormAnswersPanel({ slug, items, checks, company }: { slug: string; items: FormAnswer[]; checks?: QualityCheck[]; company: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState("");
  const [instruction, setInstruction] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const run = useRun(runId);
  const live = isLive(run.status);
  const phases = phasesFrom(run.events);

  useEffect(() => {
    if (run.status === "done" || run.status === "error") router.refresh();
  }, [run.status, router]);

  async function send(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/jobs/${slug}/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) return setError(json.error ?? "Something went wrong");
    setQuestions("");
    setInstruction("");
    setDetails({});
    setRunId(json.runId);
  }

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const needs = items.filter((a) => a.needsInput);

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-[18px] text-accent" strokeWidth={1.75} />
          <h2 className="t-h3 flex-1 text-ink">{items.length ? "Add more questions" : "Questions from the application form"}</h2>
        </div>
        <p className="t-body-s text-ink-3">
          Paste the extra questions {company} asks — “Why us?”, “Describe a time…”, notice period, salary… Keep limits like “(max 500 characters)” in the text; Claude respects them.
        </p>
        <textarea
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          disabled={live}
          rows={items.length ? 3 : 6}
          placeholder={"1. Why do you want to work at Daraz? (max 600 characters)\n2. Tell us about a campaign you're proud of. (150 words)\n3. What is your notice period?"}
          className="resize-y rounded-xl border border-line bg-subtle px-3.5 py-3 t-body-s text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => send({ questions })} disabled={live || questions.trim().length < 5}>
            <Sparkles strokeWidth={1.75} /> Answer with Claude
          </Button>
          {error && <span className="t-body-s text-bad">{error}</span>}
        </div>
      </section>

      {(live || (runId && phases.length > 0)) && (
        <section className="card flex flex-col gap-2 p-5">
          {phases.map((p) => (
            <motion.p key={p.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
              <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", p.state === "active" ? "animate-pulse bg-accent" : p.state === "done" ? "bg-ok" : p.state === "warn" ? "bg-warn" : p.state === "error" ? "bg-bad" : "bg-line")} />
              <span className="min-w-0">
                <span className={cx("block t-label-s", p.state === "active" && live ? "shimmer-text" : "text-ink")}>{p.label}</span>
                {p.detail && <span className="block truncate t-body-s text-ink-3">{p.detail}</span>}
              </span>
            </motion.p>
          ))}
          {live && !phases.length && <p className="shimmer-text t-label-s">Starting Claude Code…</p>}
        </section>
      )}

      {items.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <h2 className="t-h3 flex-1 text-ink">
              {items.length} answer{items.length === 1 ? "" : "s"}
            </h2>
            <Button
              variant="secondary"
              size="s"
              onClick={() => copy("all", items.map((a, i) => `${i + 1}. ${a.question}\n${a.answer}`).join("\n\n"))}
            >
              {copied === "all" ? <Check strokeWidth={2.25} /> : <Copy strokeWidth={1.75} />} {copied === "all" ? "Copied" : "Copy all"}
            </Button>
          </div>
          {checks && checks.length > 0 && <ChecksList checks={checks} />}

          {needs.length > 0 && !live && (
            <section className="flex flex-col gap-3 rounded-2xl bg-warn-bg/60 p-4 ring-1 ring-warn/30">
              <p className="flex items-center gap-2 t-label text-ink">
                <HelpCircle className="size-4 text-warn" strokeWidth={2} /> Only you know {needs.length === 1 ? "this" : "these"}
              </p>
              {needs.map((a) => (
                <label key={a.id} className="flex flex-col gap-1.5">
                  <span className="t-body-s text-ink-2">{a.needsInput}</span>
                  <input
                    value={details[a.id] ?? ""}
                    onChange={(e) => setDetails((d) => ({ ...d, [a.id]: e.target.value }))}
                    placeholder="Your answer"
                    className="h-10 rounded-xl border border-line bg-surface px-3 t-body-s text-ink outline-none focus:border-accent focus:shadow-ring"
                  />
                </label>
              ))}
              <div>
                <Button size="s" disabled={!Object.values(details).some((v) => v.trim())} onClick={() => send({ details: needs.map((a) => ({ question: a.needsInput!, answer: details[a.id] ?? "" })) })}>
                  Update answers
                </Button>
              </div>
            </section>
          )}

          <AnimatePresence>
            {items.map((a, i) => {
              const lim = a.limit ?? parseLimit(a.question);
              const len = lim ? lengthOf(a.answer, lim.unit) : 0;
              return (
                <motion.section key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card flex flex-col gap-3 p-5">
                  <p className="flex gap-2 t-label text-ink">
                    <span className="text-ink-accent">{i + 1}.</span> {a.question}
                  </p>
                  <p className={cx("whitespace-pre-wrap rounded-2xl rounded-bl-[4px] px-4 py-3 t-body text-ink", a.needsInput ? "bg-warn-bg/40" : "bg-subtle")}>{a.answer}</p>
                  <div className="flex items-center gap-3">
                    <span className={cx("t-mono-s", lim ? (len > lim.n ? "text-bad" : "text-ok") : "text-ink-3")}>
                      {lim ? `${len} / ${lim.n} ${lim.unit}` : `${a.answer.split(/\s+/).filter(Boolean).length} words · ${a.answer.length} chars`}
                    </span>
                    {a.needsInput && <span className="t-label-s text-warn">needs your input</span>}
                    <span className="flex-1" />
                    <Button size="s" variant="secondary" onClick={() => copy(a.id, a.answer)}>
                      {copied === a.id ? <Check strokeWidth={2.25} /> : <Copy strokeWidth={1.75} />} {copied === a.id ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>

          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 pl-3.5 focus-within:border-accent focus-within:shadow-ring">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={live}
              rows={1}
              placeholder="Ask Claude to change an answer… e.g. “make 2 shorter and mention the Eid campaign”"
              className="max-h-32 min-h-9 flex-1 resize-y bg-transparent py-1.5 t-body-s text-ink outline-none placeholder:text-ink-3"
            />
            <Button size="s" disabled={live || !instruction.trim()} onClick={() => send({ instruction })}>
              <Sparkles strokeWidth={1.75} /> Revise
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
