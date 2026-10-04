"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, Check, Lightbulb, MessageCircleQuestion, Send, X } from "lucide-react";
import { useState } from "react";
import type { ClaudeQuestion, QualityCheck } from "@/lib/types";
import { Button, cx } from "./ui";

/** Claude's questions + suggestions + a free-form "ask for a change" box. Continues the same conversation. */
export function ClaudeAssist({
  slug,
  questions = [],
  suggestions = [],
  onStarted,
  compact = false,
}: {
  slug: string;
  questions?: ClaudeQuestion[];
  suggestions?: string[];
  onStarted?: (runId: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInput = Object.values(answers).some((a) => a.trim()) || instruction.trim();

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${slug}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q) => ({ id: q.id, question: q.question, answer: answers[q.id] ?? "" })),
          instruction: instruction.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setAnswers({});
      setInstruction("");
      if (onStarted) onStarted(json.runId);
      else router.push(`/tailor?job=${slug}&run=${json.runId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cx("flex flex-col gap-3.5", !compact && "card p-5")}>
      {questions.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="size-[18px] text-accent" strokeWidth={1.75} />
            <h3 className="t-h3 text-ink">
              Claude has {questions.length} question{questions.length > 1 ? "s" : ""}
            </h3>
          </div>
          <p className="t-body-s text-ink-3">Answer what’s true — your answers are saved to resumes/facts.md and reused next time. Skip anything that doesn’t apply.</p>
          {questions.map((q, i) => (
            <motion.label
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex flex-col gap-2 rounded-2xl bg-accent-subtle/60 p-3.5"
            >
              <span className="t-label text-ink">{q.question}</span>
              {q.why && <span className="t-body-s text-ink-3">{q.why}</span>}
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={2}
                placeholder="Your answer (leave empty to skip)"
                className="resize-y rounded-xl border border-line bg-surface px-3 py-2 t-body-s text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
              />
            </motion.label>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 t-overline text-ink-3">
            <Lightbulb className="size-3.5 text-warn" strokeWidth={2} /> Suggestions
          </p>
          {suggestions.map((s) => (
            <p key={s} className="rounded-xl bg-subtle px-3 py-2 t-body-s text-ink-2">
              {s}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(questions.length > 0 || suggestions.length > 0) && <p className="t-overline text-ink-3">Anything else?</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 pl-3.5 transition-shadow focus-within:border-accent focus-within:shadow-ring">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasInput && !busy) send();
            }}
            rows={1}
            placeholder="Ask Claude to change something… e.g. “lead with the Bolt Labs GraphQL work”"
            className="max-h-40 min-h-9 flex-1 resize-y bg-transparent py-1.5 t-body-s text-ink outline-none placeholder:text-ink-3"
          />
          <Button size="s" onClick={send} disabled={!hasInput || busy}>
            <Send strokeWidth={1.75} /> {busy ? "Sending…" : questions.length ? "Send" : "Revise"}
          </Button>
        </div>
        {error && <p className="t-body-s text-bad">{error}</p>}
      </div>
    </section>
  );
}

/** Automatic quality checks (pages, sections, facts, formatting). */
export function ChecksList({ checks, revisions = 0, compact = false }: { checks: QualityCheck[]; revisions?: number; compact?: boolean }) {
  if (!checks.length) return null;
  const passed = checks.filter((c) => c.ok).length;
  return (
    <div className={cx("flex flex-col gap-2", !compact && "card p-5")}>
      <div className="flex items-center justify-between">
        <p className={compact ? "t-overline text-ink-3" : "t-h3 text-ink"}>Quality checks</p>
        <span className="t-mono-s text-ink-3">
          {passed}/{checks.length}
          {revisions > 0 && ` · ${revisions} self-fix${revisions > 1 ? "es" : ""}`}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <span
              className={cx(
                "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full",
                c.ok ? "bg-ok-bg text-ok" : c.blocking ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn",
              )}
            >
              {c.ok ? <Check className="size-3" strokeWidth={3} /> : c.blocking ? <X className="size-3" strokeWidth={3} /> : <AlertTriangle className="size-2.5" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="block t-label-s text-ink">{c.label}</span>
              {c.detail && <span className="block whitespace-pre-line t-body-s text-ink-3">{c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
