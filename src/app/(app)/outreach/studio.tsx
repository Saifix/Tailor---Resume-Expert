"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Link2, Sparkles, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { FORMATS, TONES } from "@/lib/options";
import type { OutreachItem } from "@/lib/types";
import { Button, cx, Empty, relDate } from "@/components/ui";
import { isLive, stopRun, useElapsed, useRun } from "@/components/use-run";

type HistoryItem = { slug: string; name: string; intent: string; createdAt: string; drafts: number };
const LIMIT: Record<string, number> = { "Connection note": 300, Message: 700, Email: 900 };

export function OutreachStudio({
  jobs,
  history,
  item,
  runId: initialRunId,
  presetJob,
}: {
  jobs: { slug: string; label: string }[];
  history: HistoryItem[];
  item: OutreachItem | null;
  runId: string | null;
  presetJob?: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState("");
  const [intent, setIntent] = useState(item?.intent ?? "");
  const [tone, setTone] = useState<string>(item?.tone ?? "Warm");
  const [format, setFormat] = useState<string>(item?.format ?? "Connection note");
  const [jobSlug, setJobSlug] = useState(item?.jobSlug ?? presetJob ?? "");
  const runId = initialRunId;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRun(runId);
  const live = isLive(run.status) || busy;
  const elapsed = useElapsed(run.startedAt, isLive(run.status));

  useEffect(() => {
    if (run.status === "done" || run.status === "error") router.refresh();
  }, [run.status, router]);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, intent, tone, format, jobSlug: jobSlug || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      router.push(`/outreach?item=${json.slug}&run=${json.runId}`, { scroll: false });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const parsedName = item && item.drafts.length ? item.name : null;

  return (
    <div className="grid flex-1 grid-cols-[minmax(420px,480px)_minmax(0,1fr)] gap-5 px-10 pb-8 pt-7">
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-3.5 p-[22px]">
          <div className="flex items-center gap-2">
            <Num n={1} />
            <h2 className="t-h3 flex-1 text-ink">Paste their profile</h2>
            {parsedName && (
              <span className="flex items-center gap-1 rounded-full bg-ok-bg px-2 py-[3px] t-label-s text-ok">
                <Check className="size-3" strokeWidth={2.5} /> Parsed
              </span>
            )}
          </div>
          {item && !profile ? (
            <div className="flex items-center gap-3 rounded-xl bg-subtle px-3.5 py-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ffbf8c,#f26680)] t-label text-white">
                {initials(item.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-h3 truncate text-ink">{item.name}</p>
                {item.headline && <p className="t-body-s truncate text-ink-2">{item.headline}</p>}
              </div>
              <Link href="/outreach" className="t-label-s text-ink-accent hover:underline">
                New
              </Link>
            </div>
          ) : (
            <textarea
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              disabled={live}
              placeholder={"Open their LinkedIn profile → select all → copy → paste here.\nRaw HTML (View source) works too."}
              className="min-h-[150px] resize-y rounded-xl border border-line bg-subtle px-3.5 py-3 t-mono-s text-ink-2 outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
            />
          )}
          {item?.context && item.context.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.context.map((c) => (
                <span key={c} className="rounded-md bg-info-bg px-2 py-[3px] t-label-s text-info">
                  {c}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]">
          <div className="flex items-center gap-2">
            <Num n={2} />
            <h2 className="t-h3 text-ink">What do you want from them?</h2>
          </div>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            disabled={live}
            placeholder="e.g. Ask for a referral for the Senior Product Engineer role. Mention my checkout redesign."
            className="min-h-[88px] resize-y rounded-xl border border-line bg-surface px-3.5 py-3 t-body text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
          />
          <label className="flex items-center gap-2 rounded-[10px] bg-subtle px-2.5 py-2">
            <Link2 className="size-3.5 text-ink-3" strokeWidth={1.75} />
            <select value={jobSlug} onChange={(e) => setJobSlug(e.target.value)} disabled={live} className="flex-1 bg-transparent t-label-s text-ink-2 outline-none">
              <option value="">Not linked to a job</option>
              {jobs.map((j) => (
                <option key={j.slug} value={j.slug}>
                  Linked to: {j.label}
                </option>
              ))}
            </select>
          </label>
          <Choice label="Tone" options={TONES} value={tone} onChange={setTone} disabled={live} />
          <Choice label="Format" options={FORMATS} value={format} onChange={setFormat} disabled={live} />
        </section>

        {history.length > 0 && (
          <section className="card flex flex-col gap-0.5 p-3">
            <p className="t-overline px-2 pb-1 pt-1 text-ink-3">Earlier drafts</p>
            {history.slice(0, 5).map((h) => (
              <Link
                key={h.slug}
                href={`/outreach?item=${h.slug}`}
                className={cx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-subtle", h.slug === item?.slug && "bg-subtle")}
              >
                <span className="grid size-6 place-items-center rounded-full bg-muted t-label-s text-ink-2">{initials(h.name)}</span>
                <span className="flex-1 truncate t-label-s text-ink">{h.name}</span>
                <span className="t-body-s text-ink-3">{relDate(h.createdAt)}</span>
              </Link>
            ))}
          </section>
        )}

        <div className="flex-1" />
        {error && <p className="rounded-xl bg-bad-bg px-3.5 py-2.5 t-body-s text-bad">{error}</p>}
        <div className="flex items-center gap-3.5">
          <Button onClick={submit} disabled={live || profile.trim().length < 40 || intent.trim().length < 5}>
            <Sparkles strokeWidth={1.75} /> {item ? "Draft again" : "Draft with Claude"}
          </Button>
          {item && !profile && <span className="t-body-s text-ink-3">Paste the profile again to redraft.</span>}
        </div>
      </div>

      {/* Drafts */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="t-h2 flex-1 text-ink">{item ? `Drafts for ${item.name.split(" ")[0]}` : "Drafts"}</h2>
          {live && (
            <>
              <span className="flex items-center gap-2 t-label-s text-ink-accent">
                <span className="relative grid size-3 place-items-center">
                  <span className="pulse-ring absolute inset-0 rounded-full bg-accent" />
                  <span className="size-1.5 rounded-full bg-accent" />
                </span>
                Claude is writing… <span className="t-mono-s text-ink-3">{elapsed}</span>
              </span>
              {runId && (
                <Button size="s" variant="secondary" onClick={() => stopRun(runId)}>
                  Stop
                </Button>
              )}
            </>
          )}
        </div>
        <AnimatePresence mode="popLayout">
          {live && !item?.drafts.length
            ? [0, 1].map((i) => (
                <motion.div key={`sk${i}`} exit={{ opacity: 0 }} className="card flex flex-col gap-3 p-[22px]">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="flex flex-col gap-2 rounded-2xl bg-subtle p-4">
                    {[100, 92, 96, 60].map((w, j) => (
                      <div key={j} className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${w}%`, animationDelay: `${j * 120}ms` }} />
                    ))}
                  </div>
                </motion.div>
              ))
            : item?.drafts.map((d, i) => <DraftCard key={d.label + i} draft={d} index={i} limit={LIMIT[item.format] ?? 700} />)}
        </AnimatePresence>
        {!live && !item?.drafts.length && (
          <div className="card flex flex-1 items-center justify-center">
            {run.status === "error" ? (
              <Empty title="Claude couldn’t draft this one.">{run.error ?? "Try pasting the profile as plain text."}</Empty>
            ) : (
              <Empty title="Specific beats clever.">Paste a profile and say what you want. Claude finds a genuine hook and writes two versions you can copy.</Empty>
            )}
          </div>
        )}
        {item && item.drafts.length > 0 && !live && <ReviseBox slug={item.slug} canRevise={!!item.sessionId} />}
        <div className="flex items-start gap-2.5 rounded-xl bg-muted px-3.5 py-3">
          <SquareTerminal className="mt-0.5 size-4 shrink-0 text-ink-2" strokeWidth={1.75} />
          <p className="t-body-s text-ink-2">
            Tailor never sends anything. Drafts are saved to <span className="t-mono-s">~/Tailor/outreach/{item?.slug ?? "<name>"}.md</span> — copy, paste and
            send it yourself on LinkedIn.
          </p>
        </div>
      </div>
    </div>
  );
}

function DraftCard({ draft, index, limit }: { draft: OutreachItem["drafts"][number]; index: number; limit: number }) {
  const [copied, setCopied] = useState(false);
  const over = draft.chars > limit;
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, delay: index * 0.08 }}
      className={cx("card flex flex-col gap-3.5 p-[22px]", draft.recommended && "ring-1 ring-accent/35")}
    >
      <div className="flex items-center gap-2">
        <span className="t-label text-ink">{draft.label}</span>
        {draft.recommended && <span className="rounded-full bg-accent-subtle px-2 py-0.5 t-label-s text-ink-accent">Recommended</span>}
        <span className="flex-1" />
        <span className={cx("t-mono-s", over ? "text-bad" : "text-ok")}>
          {draft.chars} / {limit}
        </span>
      </div>
      <p className="whitespace-pre-wrap rounded-2xl rounded-bl-[4px] bg-subtle px-[18px] py-3.5 t-body-l text-ink">{draft.text}</p>
      <div>
        <Button
          size="s"
          variant={draft.recommended ? "primary" : "secondary"}
          onClick={async () => {
            await navigator.clipboard.writeText(draft.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={String(copied)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="flex">
              {copied ? <Check strokeWidth={2.25} /> : <Copy strokeWidth={1.75} />}
            </motion.span>
          </AnimatePresence>
          {copied ? "Copied" : "Copy message"}
        </Button>
      </div>
    </motion.section>
  );
}

const QUICK = ["Shorter", "Warmer", "More direct", "Mention my open-source work"];

function ReviseBox({ slug, canRevise }: { slug: string; canRevise: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(instruction: string) {
    if (!instruction.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/outreach/${slug}/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Something went wrong");
    setText("");
    router.push(`/outreach?item=${slug}&run=${json.runId}`, { scroll: false });
  }
  if (!canRevise) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} disabled={busy} onClick={() => send(q)} className="rounded-full border border-line bg-surface px-3 py-1 t-label-s text-ink-2 hover:bg-accent-subtle hover:text-ink-accent">
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 pl-3.5 transition-shadow focus-within:border-accent focus-within:shadow-ring">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && send(text)}
          rows={1}
          placeholder="Ask Claude to change the drafts…"
          className="max-h-32 min-h-9 flex-1 resize-y bg-transparent py-1.5 t-body-s text-ink outline-none placeholder:text-ink-3"
        />
        <Button size="s" disabled={busy || !text.trim()} onClick={() => send(text)}>
          <Sparkles strokeWidth={1.75} /> {busy ? "Sending…" : "Revise"}
        </Button>
      </div>
      {error && <p className="t-body-s text-bad">{error}</p>}
    </div>
  );
}

function Num({ n }: { n: number }) {
  return <span className="grid size-[22px] place-items-center rounded-full bg-inverse t-label-s text-ink-inverse">{n}</span>;
}

function Choice({ label, options, value, onChange, disabled }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="t-overline text-ink-3">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            disabled={disabled}
            onClick={() => onChange(o)}
            className={cx(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 t-label-s transition-colors",
              value === o ? "border-accent/35 bg-accent-subtle text-ink-accent" : "border-line bg-surface text-ink-2 hover:bg-subtle",
            )}
          >
            {value === o && <Check className="size-3.5" strokeWidth={2} />}
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
