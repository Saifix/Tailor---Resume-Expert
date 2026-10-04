"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Briefcase, Check, ClipboardList, Download, FileText, Folder, Globe, Link2, Plus, RotateCw, Sparkles, SquareTerminal, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DiffLine } from "@/lib/diff";
import type { Phase, RunEvent } from "@/lib/claude";
import { TAILOR_OPTIONS } from "@/lib/options";
import type { JobMeta } from "@/lib/types";
import { ChecksList, ClaudeAssist } from "@/components/assist";
import { FileDrop } from "@/components/file-drop";
import { ResearchCard } from "@/components/research";
import { Button, ButtonLink, buttonClass, cx, MatchRing } from "@/components/ui";
import { isLive, stopRun, useElapsed, useRun } from "@/components/use-run";

type ResumeLite = { file: string; title: string; words: number; updatedAt: string; isDefault: boolean };
type JobView = { job: JobMeta; diff: DiffLine[]; hasResume: boolean };

const ease = [0.16, 1, 0.3, 1] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TailorStudio({
  resumes,
  installedSkills,
  initialJob,
  initialRunId,
  defaults,
}: {
  resumes: ResumeLite[];
  installedSkills: string[];
  initialJob: JobMeta | null;
  initialRunId: string | null;
  defaults: { model?: string; effort?: string; web: boolean };
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initialJob?.company ?? "");
  const [role, setRole] = useState(initialJob?.role ?? "");
  const [url, setUrl] = useState(initialJob?.url ?? "");
  const [jd, setJd] = useState("");
  const [base, setBase] = useState(initialJob?.baseResume ?? resumes.find((r) => r.isDefault)?.file ?? "");
  const [opts, setOpts] = useState<string[]>(initialJob?.skills ?? TAILOR_OPTIONS.filter((o) => o.default).map((o) => o.id));
  const [jobSlug, setJobSlug] = useState<string | null>(initialJob?.slug ?? null);
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [view, setView] = useState<JobView | null>(null);
  const [docType, setDocType] = useState<"resume" | "academic">(initialJob?.docType ?? "resume");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  // Auto-detection of company / title from the pasted JD (or a link)
  const [detect, setDetect] = useState<{ state: "idle" | "working" | "done" | "error"; msg?: string }>({ state: "idle" });
  // Optional context for this application
  const [note, setNote] = useState("");
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [formQs, setFormQs] = useState("");

  const run = useRun(runId);
  const live = isLive(run.status) || submitting;
  const elapsed = useElapsed(run.startedAt, isLive(run.status));

  const loadJob = useCallback(async (slug: string) => {
    const res = await fetch(`/api/jobs/${slug}`, { cache: "no-store" });
    if (res.ok) setView(await res.json());
  }, []);

  // Load the job view on mount (when opened via ?job=) and whenever the resume gets written / the run ends.
  const wroteResume = run.events.filter((e) => (e.type === "tool" && /resume\.md$/.test(e.target ?? "") && /Write|Edit/.test(e.name)) || e.type === "checks").length;
  const ended = run.status === "done" || run.status === "error" || run.status === "stopped" || run.status === "missing";
  useEffect(() => {
    if (!jobSlug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on state transitions
    void loadJob(jobSlug);
    if (ended) router.refresh();
  }, [jobSlug, wroteResume, ended, loadJob, router]);

  // Detect company / title / location shortly after a JD is pasted (there are no fields to type them in).
  useEffect(() => {
    if (live || jd.trim().length < 120) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setDetect({ state: "working" });
      try {
        const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jd }), signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setCompany(json.company ?? "");
        setRole(json.role ?? "");
        const found = [json.company, json.role, json.location].filter(Boolean).join(" · ");
        setDetect(found ? { state: "done", msg: found } : { state: "error", msg: "Couldn’t spot the company or title yet — Claude will pick them up when it reads the full post" });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setDetect({ state: "error", msg: "Couldn’t detect yet — Claude will pick them up when it reads the full post" });
      }
    }, 900);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [jd, live]);

  async function fetchFromLink() {
    setDetect({ state: "working", msg: "Reading the job post…" });
    setFormError(null);
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.jd) setJd(json.jd);
      setCompany(json.company ?? "");
      setRole(json.role ?? "");
      setDetect({ state: "done", msg: [json.company, json.role, json.location].filter(Boolean).join(" · ") });
    } catch (e) {
      setDetect({ state: "error", msg: (e as Error).message || "Couldn’t read that link" });
    }
  }

  async function submit() {
    setFormError(null);
    setSubmitting(true);
    setView(null);
    try {
      const data = { company, role, url, jd, baseResume: base, skills: opts, docType, model: model || undefined, effort: effort || undefined, note: note.trim() || undefined, formQuestions: formQs.trim() || undefined };
      let res: Response;
      if (extraFiles.length) {
        const fd = new FormData();
        fd.set("data", JSON.stringify(data));
        extraFiles.forEach((f) => fd.append("files", f));
        res = await fetch("/api/tailor", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setJobSlug(json.slug);
      setRunId(json.runId);
      router.replace(`/tailor?job=${json.slug}&run=${json.runId}`, { scroll: false });
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function retry() {
    if (!jobSlug) return;
    const res = await fetch(`/api/jobs/${jobSlug}/retailor`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setView(null);
      setRunId(json.runId);
      router.replace(`/tailor?job=${jobSlug}&run=${json.runId}`, { scroll: false });
    }
  }

  function reset() {
    setJobSlug(null);
    setRunId(null);
    setView(null);
    setCompany("");
    setRole("");
    setUrl("");
    setJd("");
    router.replace("/tailor", { scroll: false });
  }

  const linkOnly = jd.trim().length < 80 && /^https?:\/\/\S+$/.test(url.trim());
  const canSubmit = (jd.trim().length >= 80 || (linkOnly && defaults.web)) && !!base && !live;

  return (
    <div className="grid flex-1 grid-cols-[minmax(420px,500px)_1fr] gap-5 px-10 pb-8 pt-7">
      {/* ─── Input column ─── */}
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-3.5 p-[22px]">
          <div className="flex items-center justify-between gap-3">
            <Step n={1} title="The job" />
            <div className="flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
              {(
                [
                  ["resume", "Resume"],
                  ["academic", "Academic CV"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  disabled={live}
                  onClick={() => setDocType(v)}
                  className={cx("rounded-lg px-2.5 py-1 t-label-s", docType === v ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:text-ink")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Field icon={Link2} value={url} onChange={setUrl} placeholder="Job post link (optional)" disabled={live} />
            </div>
            {linkOnly && defaults.web && !live && (
              <Button variant="secondary" size="s" onClick={fetchFromLink} disabled={detect.state === "working"}>
                <Globe strokeWidth={1.75} /> Fetch
              </Button>
            )}
          </div>
          {initialJob && !jd ? (
            <p className="flex items-center gap-1.5 t-body-s text-ink-2">
              <Briefcase className="size-3.5 text-ink-3" strokeWidth={1.75} /> {[initialJob.company, initialJob.role, initialJob.location].filter(Boolean).join(" · ")}
            </p>
          ) : detect.state !== "idle" ? (
            <p className={cx("flex items-center gap-1.5 t-body-s", detect.state === "error" ? "text-ink-3" : detect.state === "done" ? "text-ok" : "text-ink-3")}>
              {detect.state === "working" ? (
                <span className="shimmer-text">{detect.msg ?? "Detecting company & title…"}</span>
              ) : (
                <>
                  {detect.state === "done" && (
                    <>
                      <Check className="size-3.5" strokeWidth={2.5} /> Detected:
                    </>
                  )}{" "}
                  {detect.msg}
                </>
              )}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 t-body-s text-ink-3">
              <Sparkles className="size-3.5" strokeWidth={1.75} /> Company, job title and location are picked up from the post automatically.
            </p>
          )}
          {initialJob && !jd ? (
            <div className="rounded-xl bg-subtle px-3.5 py-3 t-body-s text-ink-2">
              Using the saved job description in <span className="t-mono-s">jobs/{initialJob.slug}/</span>.{" "}
              <button className="text-ink-accent hover:underline" onClick={reset}>
                Start a new one
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-subtle px-3.5 pb-3 pt-3 transition-shadow focus-within:border-accent focus-within:shadow-ring">
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                disabled={live}
                placeholder={`Paste the full job description here — company and title are picked up automatically.${defaults.web ? "\nOr just paste a link above and hit Fetch." : ""}`}
                className="min-h-[220px] w-full resize-y bg-transparent t-body-s text-ink outline-none placeholder:text-ink-3"
              />
              <div className="flex items-center justify-between">
                <span className="t-mono-s text-ink-3">{jd.length.toLocaleString()} characters</span>
                {jd && !live && (
                  <button className="t-label-s text-ink-accent hover:underline" onClick={() => setJd("")}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-[22px]">
          <Step n={2} title="Base resume" />
          {resumes.length ? (
            <div className="flex flex-col gap-1.5">
              {resumes.map((r) => (
                <button
                  key={r.file}
                  disabled={live}
                  onClick={() => setBase(r.file)}
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    base === r.file ? "bg-accent-subtle ring-1 ring-accent/40" : "bg-subtle hover:bg-muted",
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-[10px] bg-surface">
                    <FileText className="size-[18px] text-accent" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block t-label truncate text-ink">{r.title}</span>
                    <span className="block t-mono-s text-ink-3">
                      resumes/{r.file} · {r.words} words
                    </span>
                  </span>
                  {base === r.file && <Check className="size-4 text-accent" strokeWidth={2} />}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/resumes" className="rounded-xl bg-subtle px-3.5 py-3 t-body-s text-ink-2 hover:bg-muted">
                <span className="block t-label text-ink">I have a CV</span>
                Upload it →
              </Link>
              <Link href="/resumes/new" className="rounded-xl bg-accent-subtle px-3.5 py-3 t-body-s text-ink-2 ring-1 ring-accent/30 hover:bg-accent-subtle/70">
                <span className="block t-label text-ink">I don’t have one</span>
                <span className="text-ink-accent">Build it with Claude →</span>
              </Link>
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-[22px]">
          <Step n={3} title="Skills Claude will use" />
          <div className="flex flex-wrap gap-2">
            {TAILOR_OPTIONS.map((o) => {
              const on = opts.includes(o.id);
              const available = o.id === "one-page" || o.id === "match-report" || installedSkills.includes(o.id);
              return (
                <button
                  key={o.id}
                  disabled={live || !available}
                  title={available ? undefined : "Skill is turned off in Resumes → Claude skills"}
                  onClick={() => setOpts((cur) => (on ? cur.filter((x) => x !== o.id) : [...cur, o.id]))}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 t-label-s transition-colors disabled:opacity-40",
                    on ? "border-accent/35 bg-accent-subtle text-ink-accent" : "border-line bg-surface text-ink-2 hover:bg-subtle",
                  )}
                >
                  {on ? <Check className="size-3.5" strokeWidth={2} /> : <Plus className="size-3.5" strokeWidth={2} />}
                  {o.label}
                </button>
              );
            })}
          </div>
        </section>

        {(!initialJob || jd) && (
          <section className="card flex flex-col gap-3 p-[22px]">
            <button className="flex items-center gap-2 text-left" onClick={() => setShowExtras((s) => !s)} disabled={live}>
              <span className="grid size-[22px] place-items-center rounded-full bg-inverse t-label-s text-ink-inverse">4</span>
              <span className="flex-1">
                <span className="block t-h3 text-ink">Anything else for this application?</span>
                <span className="block t-body-s text-ink-3">Optional — the form’s own questions, a referral, projects not on your CV, a portfolio…</span>
              </span>
              <span className="t-label-s text-ink-accent">
                {showExtras ? "Hide" : note || extraFiles.length || formQs ? [formQs && "questions", note && "note", extraFiles.length && `${extraFiles.length} file${extraFiles.length > 1 ? "s" : ""}`].filter(Boolean).join(" · ") + " added" : "Add"}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {showExtras && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-3 overflow-hidden">
                  <label className="flex flex-col gap-1.5">
                    <span className="t-label-s text-ink">Questions from the application form</span>
                    <textarea
                      value={formQs}
                      onChange={(e) => setFormQs(e.target.value)}
                      disabled={live}
                      rows={3}
                      placeholder={"1. Why do you want to join us? (max 600 characters)\n2. Describe a project you're proud of. (150 words)\n3. What is your notice period?"}
                      className="resize-y rounded-xl border border-line bg-subtle px-3.5 py-3 t-body-s text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
                    />
                    <span className="t-body-s text-ink-3">Claude answers them right after tailoring — within each limit. You can add more later on the job page.</span>
                  </label>
                  <span className="t-label-s text-ink">Context for Claude</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={live}
                    rows={4}
                    placeholder={"e.g. Maya Chen (EM on the Geist team) said she'd refer me. I've used Vercel's AI SDK in a side project — repo attached. I can't relocate before March."}
                    className="resize-y rounded-xl border border-line bg-subtle px-3.5 py-3 t-body-s text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
                  />
                  <FileDrop files={extraFiles} onChange={setExtraFiles} disabled={live} compact hint="Portfolio, project write-up, reference letter, certificate…" />
                  <p className="t-body-s text-ink-3">Saved in this job’s folder (extras/). Claude treats it as true and uses what’s relevant — for this application only.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        <div className="flex-1" />
        {formError && <p className="rounded-xl bg-bad-bg px-3.5 py-2.5 t-body-s text-bad">{formError}</p>}
        <div className="flex items-center gap-3.5">
          {!initialJob || jd ? (
            <Button onClick={submit} disabled={!canSubmit}>
              <Sparkles strokeWidth={1.75} /> {submitting ? "Starting…" : "Tailor with Claude"}
            </Button>
          ) : (
            <Button onClick={retry} disabled={live}>
              <RotateCw strokeWidth={1.75} /> Re-tailor
            </Button>
          )}
          <div className="flex items-center gap-1.5" title="Override for this run — defaults live in Settings">
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={live} className="h-8 rounded-full border border-line bg-surface px-2.5 t-label-s text-ink-2 outline-none focus:border-accent">
              <option value="">Model: {defaults.model ? cap(defaults.model) : "default"}</option>
              {["fable", "opus", "sonnet", "haiku"].map((m) => (
                <option key={m} value={m}>
                  {cap(m)}
                </option>
              ))}
            </select>
            <select value={effort} onChange={(e) => setEffort(e.target.value)} disabled={live} className="h-8 rounded-full border border-line bg-surface px-2.5 t-label-s text-ink-2 outline-none focus:border-accent">
              <option value="">Effort: {defaults.effort ? cap(defaults.effort) : "default"}</option>
              {["low", "medium", "high", "xhigh", "max"].map((m) => (
                <option key={m} value={m}>
                  {m === "xhigh" ? "Extra high" : cap(m)}
                </option>
              ))}
            </select>
            {defaults.web && (
              <span className="flex items-center gap-1 t-mono-s text-ink-3" title="Web research is on (Settings)">
                <Globe className="size-3.5" strokeWidth={1.75} /> web
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Output column ─── */}
      <OutputPanel
        live={live}
        status={run.status}
        events={run.events}
        elapsed={elapsed}
        error={run.error}
        view={view}
        onStop={() => runId && stopRun(runId)}
        onRetry={retry}
        onReset={reset}
        onFollowUp={(id) => {
          setRunId(id);
          if (jobSlug) router.replace(`/tailor?job=${jobSlug}&run=${id}`, { scroll: false });
        }}
        hasRun={!!runId || !!jobSlug}
      />
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-[22px] place-items-center rounded-full bg-inverse t-label-s text-ink-inverse">{n}</span>
      <h2 className="t-h3 text-ink">{title}</h2>
    </div>
  );
}

function Field({
  icon: Icon,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  icon: typeof Briefcase;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex h-10 min-w-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 transition-shadow focus-within:border-accent focus-within:shadow-ring">
      <Icon className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.75} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3"
      />
    </label>
  );
}

// ───────────────────────── Output ─────────────────────────

/** Latest state of every phase the server emitted, in first-seen order. */
function phasesFrom(events: RunEvent[]): Phase[] {
  const map = new Map<string, Phase>();
  for (const e of events) if (e.type === "phase") map.set(e.phase.id, e.phase);
  return [...map.values()];
}

function OutputPanel({
  live,
  status,
  events,
  elapsed,
  error,
  view,
  onStop,
  onRetry,
  onReset,
  onFollowUp,
  hasRun,
}: {
  live: boolean;
  status: string;
  events: RunEvent[];
  elapsed: string;
  error?: string;
  view: JobView | null;
  onStop: () => void;
  onRetry: () => void;
  onReset: () => void;
  onFollowUp: (runId: string) => void;
  hasRun: boolean;
}) {
  const phases = phasesFrom(events);
  const texts = events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text);
  const job = view?.job;
  const finished = !live && !!view?.hasResume && status !== "error" && status !== "stopped";
  const failed = !live && (status === "error" || status === "stopped" || (!!job?.lastError && !view?.hasResume));
  const fixing = phases.some((p) => p.id.startsWith("fix-") && p.state === "active");

  if (!hasRun) return <IdlePanel />;

  return (
    <section className={cx("card flex min-h-0 flex-col gap-[18px] p-6", live && "ring-1 ring-accent/25")}>
      {/* header */}
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface py-1.5 pl-2.5 pr-3 shadow-e1">
          <span className="relative grid size-3.5 place-items-center">
            {live && <span className="pulse-ring absolute inset-0 rounded-full bg-accent" />}
            <span className={cx("relative size-1.5 rounded-full", live ? "bg-accent" : failed ? "bg-bad" : "bg-ok")} />
          </span>
          <span className="t-label-s text-ink">
            {live
              ? status === "spawning"
                ? "Starting Claude Code…"
                : fixing
                  ? "Claude is fixing what the self-check found…"
                  : "Claude is tailoring…"
              : failed
                ? "Tailoring didn’t finish"
                : "Tailored"}
          </span>
          <SquareTerminal className="size-3.5 text-ink-3" strokeWidth={1.75} />
        </span>
        <span className="flex-1" />
        {live && <span className="t-mono text-ink-3">{elapsed}</span>}
        {live ? (
          <Button variant="secondary" size="s" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button variant="ghost" size="s" onClick={onReset}>
            <Plus strokeWidth={2} /> New
          </Button>
        )}
      </div>

      {/* steps (server-driven: draft → self-check → fixes) */}
      {phases.length > 0 && (
        <ol className={cx("flex flex-col", finished ? "gap-1.5" : "gap-2.5")}>
          {phases.map((p) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
              <StepDot state={live || p.state !== "active" ? p.state : "done"} small={finished} />
              <span className="min-w-0">
                <span
                  className={cx(
                    finished ? "t-label-s" : "t-label",
                    "block",
                    p.state === "todo" ? "text-ink-3" : p.state === "active" && live ? "shimmer-text" : p.state === "warn" ? "text-warn" : p.state === "error" ? "text-bad" : "text-ink",
                  )}
                >
                  {p.label}
                </span>
                {p.detail && <span className="block truncate t-body-s text-ink-3">{p.detail}</span>}
              </span>
            </motion.li>
          ))}
        </ol>
      )}

      {/* what Claude says */}
      {live && texts.length > 0 && (
        <motion.p key={texts.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="line-clamp-3 rounded-xl bg-subtle px-3.5 py-2.5 t-body-s text-ink-2">
          {texts[texts.length - 1]}
        </motion.p>
      )}

      {failed && (
        <div className="flex items-start gap-3 rounded-xl bg-bad-bg px-4 py-3">
          <p className="flex-1 t-body-s text-bad">{error || job?.lastError || "Claude stopped before writing the resume."}</p>
          <Button size="s" variant="secondary" onClick={onRetry}>
            <RotateCw strokeWidth={1.75} /> Retry
          </Button>
        </div>
      )}

      {/* results */}
      <AnimatePresence>
        {job && (job.match || view?.hasResume) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="flex min-h-0 flex-1 flex-col gap-[18px]">
            {job.match && (
              <div className="flex items-center gap-5 rounded-2xl bg-subtle px-5 py-4">
                <MatchRing value={job.match.after} size={44} />
                <div className="flex-1">
                  <p className="t-h3 text-ink">
                    Tailored for {job.company} <span className="t-body text-ink-3">· {job.role}</span>
                  </p>
                  {job.summary && <p className="t-body-s text-ink-2">{job.summary}</p>}
                </div>
                <div className="text-right">
                  <p className="t-overline text-ink-3">Match</p>
                  <p className="t-mono text-ink-3">
                    {job.match.before}% → <span className="t-h2 text-ok">{job.match.after}%</span>
                  </p>
                </div>
              </div>
            )}
            {finished && job.checks && <ChecksList checks={job.checks} revisions={job.revisions} compact />}
            {job.keywords && <Keywords k={job.keywords} />}
            {finished && <ResearchCard research={job.research} compact />}
            {finished && !!job.formAnswers?.items.length && (
              <Link href={`/jobs/${job.slug}?tab=answers`} className="flex items-center gap-3 rounded-2xl bg-subtle px-4 py-3 transition-colors hover:bg-muted">
                <ClipboardList className="size-[18px] text-accent" strokeWidth={1.75} />
                <span className="flex-1">
                  <span className="block t-label text-ink">
                    {job.formAnswers.items.length} form question{job.formAnswers.items.length === 1 ? "" : "s"} answered
                  </span>
                  <span className="block t-body-s text-ink-3">
                    {job.formAnswers.items.some((a) => a.needsInput) ? "Some need a detail only you know — " : "Ready to copy — "}open the Form answers tab
                  </span>
                </span>
                <ArrowRight className="size-4 text-ink-3" strokeWidth={2} />
              </Link>
            )}
            {finished && (
              <div className="rounded-2xl border border-accent/25 p-4">
                <ClaudeAssist slug={job.slug} questions={job.questions} suggestions={job.suggestions} onStarted={onFollowUp} compact />
              </div>
            )}
            {view && view.diff.length > 0 && <DiffPreview diff={view.diff} live={live} />}
            {finished && (
              <div className="flex items-center gap-2.5">
                <Folder className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                <span className="flex-1 truncate t-mono-s text-ink-2">jobs/{job.slug}/</span>
                <a href={`/api/jobs/${job.slug}/export?format=docx`} className={buttonClass("secondary", "s")}>
                  <Download strokeWidth={1.75} /> Word
                </a>
                <a href={`/api/jobs/${job.slug}/export?format=pdf`} className={buttonClass("secondary", "s")}>
                  <Download strokeWidth={1.75} /> PDF
                </a>
                <ButtonLink href={`/jobs/${job.slug}`} size="s">
                  Open job folder <ArrowRight strokeWidth={2} />
                </ButtonLink>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function StepDot({ state, small }: { state: string; small?: boolean }) {
  const size = small ? "size-[18px]" : "size-[22px]";
  if (state === "done")
    return (
      <motion.span
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={cx("grid shrink-0 place-items-center rounded-full bg-ok-bg", size)}
      >
        <Check className="size-3.5 text-ok" strokeWidth={2.25} />
      </motion.span>
    );
  if (state === "warn")
    return (
      <span className={cx("grid shrink-0 place-items-center rounded-full bg-warn-bg", size)}>
        <AlertTriangle className="size-3 text-warn" strokeWidth={2.25} />
      </span>
    );
  if (state === "error")
    return (
      <span className={cx("grid shrink-0 place-items-center rounded-full bg-bad-bg", size)}>
        <XIcon className="size-3 text-bad" strokeWidth={2.5} />
      </span>
    );
  if (state === "active")
    return (
      <span className={cx("relative grid shrink-0 place-items-center rounded-full bg-accent-subtle shadow-glow", size)}>
        <span className="pulse-ring absolute inset-1 rounded-full bg-accent/40" />
        <span className="size-2 rounded-full bg-accent" />
      </span>
    );
  return <span className={cx("shrink-0 rounded-full border-[1.5px] border-dashed border-line", size)} />;
}

function Keywords({ k }: { k: NonNullable<JobMeta["keywords"]> }) {
  const all = [
    ...k.have.map((w) => ({ w, kind: "have" as const })),
    ...k.added.map((w) => ({ w, kind: "added" as const })),
    ...k.missing.map((w) => ({ w, kind: "missing" as const })),
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <p className="t-overline text-ink-3">Keywords from the JD</p>
      <div className="flex flex-wrap gap-1.5">
        {all.map(({ w, kind }) => (
          <span
            key={kind + w}
            className={cx(
              "rounded-md px-2 py-[3px] t-mono-s",
              kind === "have" && "bg-subtle text-ink-2",
              kind === "added" && "bg-ok-bg text-ok",
              kind === "missing" && "bg-bad-bg text-bad",
            )}
            title={{ have: "Already in your resume", added: "Surfaced by tailoring", missing: "No honest evidence — not added" }[kind]}
          >
            {kind === "added" ? "+ " : kind === "missing" ? "– " : ""}
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function DiffPreview({ diff, live }: { diff: DiffLine[]; live: boolean }) {
  const changed = diff.filter((d) => d.kind !== "same");
  const shown = diff.length > 60 ? diff.filter((d, i) => d.kind !== "same" || diff[i + 1]?.kind !== "same" || diff[i - 1]?.kind !== "same") : diff;
  return (
    <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-[14px] bg-subtle">
      <div className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-2.5">
        <FileText className="size-3.5 text-ink-3" strokeWidth={1.75} />
        <span className="flex-1 t-mono-s text-ink-2">resume.md — changes vs. your base resume</span>
        <span className="t-mono-s text-ink-3">
          +{changed.filter((d) => d.kind === "add").length} −{changed.filter((d) => d.kind === "del").length}
        </span>
      </div>
      <div className="max-h-[460px] flex-1 overflow-auto py-1">
        {shown.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(i * 0.02, 0.8) }}
            className={cx("flex gap-2.5 px-3.5 py-1 t-mono", d.kind === "add" && "bg-ok-bg/70", d.kind === "del" && "bg-bad-bg/70")}
          >
            <span className={cx("w-2.5 shrink-0", d.kind === "add" ? "text-ok" : d.kind === "del" ? "text-bad" : "text-ink-3")}>
              {d.kind === "add" ? "+" : d.kind === "del" ? "−" : " "}
            </span>
            <span className={cx("whitespace-pre-wrap break-words", d.kind === "del" ? "text-bad line-through" : "text-ink")}>{d.text}</span>
          </motion.div>
        ))}
        {live && <span className="caret mx-3.5 inline-block h-4 w-2 rounded-sm bg-accent align-middle" />}
      </div>
    </div>
  );
}

function IdlePanel() {
  const items = [
    ["Reads the job", "Pulls 10–20 must-have keywords straight from the JD."],
    ["Rewrites honestly", "Reorders and rephrases your real experience — never invents facts or numbers."],
    ["Saves a job folder", "resume.md, match report and status land in ~/Tailor/jobs/."],
  ];
  return (
    <section className="card relative flex flex-col justify-center gap-8 overflow-hidden p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-[380px] rounded-full bg-iris-300/40 blur-[90px]" />
      <div className="relative">
        <p className="t-overline text-ink-accent">How it works</p>
        <p className="mt-2 t-h1 text-ink">Paste a job.</p>
        <p className="t-serif text-[40px] leading-[44px] text-ink-accent">get a resume made to measure.</p>
      </div>
      <ol className="relative flex flex-col gap-4">
        {items.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-subtle t-label text-ink-accent">{i + 1}</span>
            <span>
              <span className="block t-label text-ink">{t}</span>
              <span className="block t-body-s text-ink-2">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="relative t-mono-s text-ink-3">Claude Code runs on this machine with your own login. Nothing is uploaded.</p>
    </section>
  );
}
