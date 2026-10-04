"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Mic, Plus, Sparkles, SquareTerminal, Wand2, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Phase, RunEvent } from "@/lib/claude";
import type { BuildMeta } from "@/lib/types";
import { ChecksList, ClaudeAssist } from "@/components/assist";
import { FileDrop } from "@/components/file-drop";
import { ResumeDoc } from "@/components/markdown";
import { Button, ButtonLink, cx } from "@/components/ui";
import { isLive, stopRun, useElapsed, useRun } from "@/components/use-run";

const PROMPTS = [
  ["Work history", "Work history (jobs, internships, freelance, family business, volunteering — where, when, what you did):\n"],
  ["Education", "Education (degrees, schools, years, grades, courses):\n"],
  ["Projects", "Projects (what you built or organised, for whom, what happened):\n"],
  ["Achievements", "Achievements I'm proud of (numbers if I know them):\n"],
  ["Skills & tools", "Skills and tools:\n"],
  ["Languages", "Languages:\n"],
  ["What I want next", "The kind of job I want next:\n"],
] as const;

const DOC_HINTS = ["LinkedIn profile (More → Save to PDF)", "Old CV", "Certificates", "Transcripts", "Reference letters", "Portfolio / project screenshots"];

type View = { build: BuildMeta; resume: string | null };

export function BuilderStudio({ userName, initialBuild, initialRunId, web }: { userName: string; initialBuild: BuildMeta | null; initialRunId: string | null; web: boolean }) {
  const router = useRouter();
  const [about, setAbout] = useState("");
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [links, setLinks] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [docType, setDocType] = useState<"resume" | "academic">("resume");
  const [region, setRegion] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [slug, setSlug] = useState<string | null>(initialBuild?.slug ?? null);
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);

  const run = useRun(runId);
  const live = isLive(run.status) || busy;
  const elapsed = useElapsed(run.startedAt, isLive(run.status));
  const ended = run.status === "done" || run.status === "error" || run.status === "stopped" || run.status === "missing";
  const checksSeen = run.events.filter((e) => e.type === "checks").length;

  const load = useCallback(async (s: string) => {
    const res = await fetch(`/api/resumes/build/${s}`, { cache: "no-store" });
    if (res.ok) setView(await res.json());
  }, []);

  useEffect(() => {
    if (!slug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on transitions
    void load(slug);
    if (ended) router.refresh();
  }, [slug, ended, checksSeen, load, router]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries({ about, name, email, phone, location, links, targetRole, docType, region }).forEach(([k, v]) => fd.set(k, v));
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/resumes/build", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      if (json.rejected?.length) setError(`Skipped: ${json.rejected.join(", ")}`);
      setSlug(json.slug);
      setRunId(json.runId);
      router.replace(`/resumes/new?build=${json.slug}&run=${json.runId}`, { scroll: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = (about.trim().length >= 60 || files.length > 0) && !live;
  const insertPrompt = (text: string) => setAbout((a) => (a.trim() ? `${a.trimEnd()}\n\n${text}` : text));
  const b = view?.build;
  const phases = phasesFrom(run.events);
  const finished = !live && !!view?.resume && b?.status === "ready";

  return (
    <div className="grid flex-1 grid-cols-[minmax(440px,520px)_minmax(0,1fr)] gap-5 px-10 pb-8 pt-7">
      {/* ─── Input ─── */}
      <div className="flex flex-col gap-4">
        {initialBuild && !about ? (
          <section className="card flex flex-col gap-2 p-[22px]">
            <p className="t-h3 text-ink">Building {initialBuild.name ? `${initialBuild.name}’s` : "your"} resume</p>
            <p className="t-body-s text-ink-2">
              From what you shared on {new Date(initialBuild.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {initialBuild.sources.length} document
              {initialBuild.sources.length === 1 ? "" : "s"} · saved in <span className="t-mono-s">resumes/sources/{initialBuild.slug}/</span>
            </p>
            <Link href="/resumes/new" className="t-label-s text-ink-accent hover:underline">
              Start another from scratch →
            </Link>
          </section>
        ) : (
          <>
            <section className="card flex flex-col gap-3 p-[22px]">
              <Step n={1} title="Tell Claude about yourself" />
              <p className="flex items-center gap-1.5 t-body-s text-ink-3">
                <Mic className="size-3.5 text-accent" strokeWidth={1.75} /> Talk like you’d explain it to a friend — type or dictate, in any language. Messy is fine.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPTS.map(([label, text]) => (
                  <button key={label} disabled={live} onClick={() => insertPrompt(text)} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 t-label-s text-ink-2 hover:bg-accent-subtle hover:text-ink-accent">
                    <Plus className="size-3" strokeWidth={2.25} /> {label}
                  </button>
                ))}
              </div>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                disabled={live}
                placeholder={
                  "e.g. I'm Sara, I finished a BSc in Business at LUMS in 2024. Since then I've been helping run my family's clothing shop — I took over the Instagram and online orders, and set up a simple inventory sheet. Before that I interned at an ad agency for 3 months writing social posts…"
                }
                className="min-h-[220px] resize-y rounded-xl border border-line bg-subtle px-3.5 py-3 t-body-s text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
              />
              <span className="t-mono-s text-ink-3">{about.trim().split(/\s+/).filter(Boolean).length} words</span>
            </section>

            <section className="card flex flex-col gap-3 p-[22px]">
              <div className="flex items-center justify-between gap-3">
                <Step n={2} title="Contact & goal" />
                <div className="flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
                  {(
                    [
                      ["resume", "Resume"],
                      ["academic", "Academic CV"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} disabled={live} onClick={() => setDocType(v)} className={cx("rounded-lg px-2.5 py-1 t-label-s", docType === v ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:text-ink")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={name} onChange={setName} placeholder="Full name" disabled={live} />
                <Input value={targetRole} onChange={setTargetRole} placeholder="Target role (e.g. Marketing Associate)" disabled={live} />
                <Input value={email} onChange={setEmail} placeholder="Email" disabled={live} />
                <Input value={phone} onChange={setPhone} placeholder="Phone" disabled={live} />
                <Input value={location} onChange={setLocation} placeholder="City, Country" disabled={live} />
                <select value={region} onChange={(e) => setRegion(e.target.value)} disabled={live} className="h-10 rounded-xl border border-line bg-surface px-3 t-body text-ink-2 outline-none focus:border-accent">
                  <option value="">Region: not sure</option>
                  <option value="US">US / Canada (resume)</option>
                  <option value="UK">UK / Ireland (CV)</option>
                  <option value="EU">Europe (CV)</option>
                  <option value="Middle East">Middle East / Gulf</option>
                  <option value="South Asia">Pakistan / India</option>
                </select>
              </div>
              <Input value={links} onChange={setLinks} placeholder="LinkedIn, GitHub, portfolio links (optional)" disabled={live} />
            </section>

            <section className="card flex flex-col gap-3 p-[22px]">
              <Step n={3} title="Anything on paper? (optional)" />
              <div className="flex flex-wrap gap-1.5">
                {DOC_HINTS.map((h) => (
                  <span key={h} className="rounded-md bg-subtle px-2 py-0.5 t-body-s text-ink-3">
                    {h}
                  </span>
                ))}
              </div>
              <FileDrop files={files} onChange={setFiles} disabled={live} hint="Claude reads PDFs, Word files, photos and screenshots" />
            </section>

            <div className="flex-1" />
            {error && <p className="rounded-xl bg-bad-bg px-3.5 py-2.5 t-body-s text-bad">{error}</p>}
            <div className="flex items-center gap-3.5">
              <Button onClick={submit} disabled={!canSubmit}>
                <Wand2 strokeWidth={1.75} /> {busy ? "Starting…" : "Build my resume"}
              </Button>
              <span className="t-body-s text-ink-3">Claude only uses what you share — and asks about the rest.</span>
            </div>
          </>
        )}
      </div>

      {/* ─── Output ─── */}
      {!slug ? (
        <IdleBuilder web={web} />
      ) : (
        <section className={cx("card flex min-h-0 min-w-0 flex-col gap-[18px] p-6", live && "ring-1 ring-accent/25")}>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface py-1.5 pl-2.5 pr-3 shadow-e1">
              <span className="relative grid size-3.5 place-items-center">
                {live && <span className="pulse-ring absolute inset-0 rounded-full bg-accent" />}
                <span className={cx("relative size-1.5 rounded-full", live ? "bg-accent" : b?.status === "error" ? "bg-bad" : "bg-ok")} />
              </span>
              <span className="t-label-s text-ink">{live ? "Claude is building your resume…" : b?.status === "error" ? "Didn’t finish" : "Your first resume is ready"}</span>
              <SquareTerminal className="size-3.5 text-ink-3" strokeWidth={1.75} />
            </span>
            <span className="flex-1" />
            {live && <span className="t-mono text-ink-3">{elapsed}</span>}
            {live && runId && (
              <Button variant="secondary" size="s" onClick={() => stopRun(runId)}>
                Stop
              </Button>
            )}
          </div>

          {phases.length > 0 && (
            <ol className={cx("flex flex-col", finished ? "gap-1.5" : "gap-2.5")}>
              {phases.map((p) => (
                <motion.li key={p.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                  <Dot state={live || p.state !== "active" ? p.state : "done"} />
                  <span className="min-w-0">
                    <span className={cx(finished ? "t-label-s" : "t-label", "block", p.state === "todo" ? "text-ink-3" : p.state === "active" && live ? "shimmer-text" : p.state === "warn" ? "text-warn" : p.state === "error" ? "text-bad" : "text-ink")}>
                      {p.label}
                    </span>
                    {p.detail && <span className="block truncate t-body-s text-ink-3">{p.detail}</span>}
                  </span>
                </motion.li>
              ))}
            </ol>
          )}

          {b?.lastError && !live && <p className="rounded-xl bg-bad-bg px-4 py-3 t-body-s text-bad">{b.lastError}</p>}

          <AnimatePresence>
            {finished && b && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-[18px]">
                {b.checks && <ChecksList checks={b.checks} revisions={b.revisions} compact />}
                <div className="rounded-2xl border border-accent/25 p-4">
                  <ClaudeAssist
                    slug={b.slug}
                    endpoint={`/api/resumes/build/${b.slug}/followup`}
                    questions={b.questions}
                    suggestions={b.suggestions}
                    onStarted={(id) => {
                      setRunId(id);
                      router.replace(`/resumes/new?build=${b.slug}&run=${id}`, { scroll: false });
                    }}
                    compact
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex-1 truncate t-mono-s text-ink-2">resumes/{b.file}</span>
                  <ButtonLink href={`/resumes/${encodeURIComponent(b.file)}`} variant="secondary" size="s">
                    Open
                  </ButtonLink>
                  <ButtonLink href="/tailor" size="s">
                    Tailor for a job <ArrowRight strokeWidth={2} />
                  </ButtonLink>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {view?.resume && (
            <div className="flex justify-center overflow-hidden rounded-[18px] bg-muted px-6 pt-6">
              <article className="mb-6 w-full max-w-[620px] self-start rounded-md bg-white px-10 py-9 shadow-e3">
                <ResumeDoc md={view.resume} />
              </article>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function phasesFrom(events: RunEvent[]): Phase[] {
  const map = new Map<string, Phase>();
  for (const e of events) if (e.type === "phase") map.set(e.phase.id, e.phase);
  return [...map.values()];
}

function Dot({ state }: { state: string }) {
  if (state === "done")
    return (
      <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-ok-bg">
        <Check className="size-3 text-ok" strokeWidth={2.5} />
      </span>
    );
  if (state === "warn")
    return (
      <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-warn-bg">
        <AlertTriangle className="size-3 text-warn" strokeWidth={2.25} />
      </span>
    );
  if (state === "error")
    return (
      <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-bad-bg">
        <XIcon className="size-3 text-bad" strokeWidth={2.5} />
      </span>
    );
  if (state === "active")
    return (
      <span className="relative grid size-[20px] shrink-0 place-items-center rounded-full bg-accent-subtle shadow-glow">
        <span className="pulse-ring absolute inset-1 rounded-full bg-accent/40" />
        <span className="size-2 rounded-full bg-accent" />
      </span>
    );
  return <span className="size-[20px] shrink-0 rounded-full border-[1.5px] border-dashed border-line" />;
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-[22px] place-items-center rounded-full bg-inverse t-label-s text-ink-inverse">{n}</span>
      <h2 className="t-h3 text-ink">{title}</h2>
    </div>
  );
}

function Input({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 min-w-0 rounded-xl border border-line bg-surface px-3 t-body text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
    />
  );
}

function IdleBuilder({ web }: { web: boolean }) {
  const steps = [
    ["You talk, Claude listens", "Describe your work, studies and projects in your own words — or dictate them. Attach anything you have."],
    ["Claude builds a truthful first resume", "It picks the right layout for you (student, professional, career changer), writes strong bullets from your words, and never invents."],
    ["Then it interviews you", "A few sharp questions — missing dates, a number you probably know — and it improves the resume with your answers."],
  ];
  return (
    <section className="card relative flex flex-col justify-center gap-8 overflow-hidden p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-[380px] rounded-full bg-iris-300/40 blur-[90px]" />
      <div className="relative">
        <p className="t-overline text-ink-accent">No CV? No problem</p>
        <p className="mt-2 t-h1 text-ink">Start from your story.</p>
        <p className="t-serif text-[40px] leading-[44px] text-ink-accent">we’ll shape the resume.</p>
      </div>
      <ol className="relative flex flex-col gap-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-subtle t-label text-ink-accent">{i + 1}</span>
            <span>
              <span className="block t-label text-ink">{t}</span>
              <span className="block t-body-s text-ink-2">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="relative flex items-center gap-2 t-mono-s text-ink-3">
        <Sparkles className="size-3.5" strokeWidth={1.75} /> Everything stays in ~/Tailor/resumes/sources/.{web ? " Web access is on — Claude may check what employers expect for your target role." : ""}
      </p>
    </section>
  );
}
