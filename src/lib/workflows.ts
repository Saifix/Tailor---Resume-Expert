import fs from "node:fs/promises";
import path from "node:path";
import { createRun, emit, exec, finishRun, setPhase, subscribe, type ClaudeConfig, type ExecResult, type Phase, type Run, type RunEvent } from "./claude";
import { aiTells, issuesForClaude, runAnswerChecks, runBuildChecks, runChecks, runLetterChecks } from "./checks";
import { countPages, renderPdf } from "./pdf";
import { dirs, rel } from "./paths";
import {
  applyTailorResult,
  buildDir,
  buildForResume,
  ensureHome,
  getBuild,
  getClaudeConfig,
  getFacts,
  getJob,
  getOutreach,
  getResume,
  getSettings,
  jobDir,
  listSkills,
  readText,
  saveOutreach,
  saveSettings,
  updateBuild,
  updateJob,
} from "./store";
import type { BuildMeta, ClaudeQuestion, JobMeta, OutreachItem } from "./types";
import { readTextFiles } from "./uploads";

/** How many times Claude may fix its own work after the self-check before we hand it to the user. */
const MAX_REVISIONS = 2;

async function enabledSkillNames() {
  return new Set((await listSkills()).filter((s) => s.enabled).map((s) => s.name));
}

/** 0 = no limit (academic CV). */
export const pageLimitFor = (job: Pick<JobMeta, "skills" | "docType">) => (job.docType === "academic" ? 0 : job.skills.includes("one-page") ? 1 : 2);

const isWeb = (e: { name: string }) => e.name === "WebSearch" || e.name === "WebFetch";

/** Turn tool calls into named steps while a turn runs. Web searches show as their own "Researching" step. */
function trackPhases(run: Run, defs: { id: string; label: string; match: (e: Extract<RunEvent, { type: "tool" }>) => boolean }[]) {
  const seen = new Set<string>();
  const done = new Set<string>();
  let searches = 0;
  const research = (state: Phase["state"]) =>
    setPhase(run, { id: "research", label: "Researching the company & learning links", state, detail: searches ? `${searches} web lookup${searches > 1 ? "s" : ""}` : undefined });
  return subscribe(run, (e) => {
    if (e.type !== "tool") return;
    if (isWeb(e)) {
      searches++;
      research("active");
      return;
    }
    if (searches && !done.has("research")) {
      done.add("research");
      research("done");
    }
    const i = defs.findIndex((d) => d.match(e));
    if (i < 0 || seen.has(defs[i].id)) return;
    // Everything before the matched step is done (Claude may skip or reorder reads).
    for (const d of defs.slice(0, i)) {
      if (done.has(d.id)) continue;
      done.add(d.id);
      seen.add(d.id);
      setPhase(run, { id: d.id, label: d.label, state: "done" });
    }
    seen.add(defs[i].id);
    setPhase(run, { id: defs[i].id, label: defs[i].label, state: "active" });
  });
}

function closePhases(run: Run) {
  // Mark any still-active phase as done once a turn finishes.
  const latest = new Map<string, Phase>();
  for (const e of run.events) if (e.type === "phase") latest.set(e.phase.id, e.phase);
  for (const p of latest.values()) if (p.state === "active") setPhase(run, { ...p, state: "done" });
}

// ───────────────────────────── Tailoring ─────────────────────────────

type TailorOpts = { origin: string; followUp?: { kind: "answers" | "revise"; text: string }; override?: Partial<ClaudeConfig> };

/** Start (or continue) tailoring for a job. Returns immediately; work continues in the background. */
export async function startTailor(job: JobMeta, opts: TailorOpts): Promise<Run> {
  await ensureHome();
  const run = createRun("tailor", job.slug);
  await updateJob(job.slug, (m) => ({
    ...m,
    status: "tailoring",
    lastError: undefined,
    lastRunId: run.id,
    timeline: [...m.timeline, { at: new Date().toISOString(), type: opts.followUp ? "revising" : "tailoring", note: opts.followUp ? followUpNote(opts.followUp) : `From ${m.baseResume}` }],
  }));
  void tailorFlow(run, job, opts).catch(async (e) => {
    emit(run, { type: "log", text: (e as Error).message, at: Date.now() });
    await updateJob(job.slug, { status: job.status === "tailoring" ? "draft" : job.status, lastError: (e as Error).message }).catch(() => {});
    finishRun(run, false);
  });
  return run;
}

const followUpNote = (f: NonNullable<TailorOpts["followUp"]>) => (f.kind === "answers" ? "Answered Claude’s questions" : `“${f.text.slice(0, 60)}${f.text.length > 60 ? "…" : ""}”`);

async function tailorFlow(run: Run, job: JobMeta, opts: TailorOpts) {
  // `job` is the snapshot from before this run — put the pipeline status back when we're done.
  const restore = job.status === "tailoring" ? (job.appliedAt ? "applied" : "draft") : job.status;
  const cfg = await getClaudeConfig(opts.override);
  const installed = await enabledSkillNames();
  const folder = rel(jobDir(job.slug)) + "/";
  const options = job.skills.filter((s) => s === "one-page" || s === "match-report" || installed.has(s));
  const pageLimit = pageLimitFor(job);
  const build = await buildForResume(job.baseResume);
  const extras: Extras = {
    web: cfg.web && installed.has("job-research"),
    humanVoice: cfg.humanVoice && installed.has("human-voice"),
    academic: job.docType === "academic",
    extrasDir: job.extras && (job.extras.note || job.extras.files.length) ? `${folder}extras/` : undefined,
    sourcesDir: build ? `${rel(buildDir(build.slug))}/` : undefined,
  };
  const write = [`${folder}resume.md`, options.includes("match-report") && `${folder}match-report.md`, options.includes("cover-letter") && `${folder}cover-letter.md`, `${folder}result.json`].filter(Boolean).join(", ");

  const phaseDefs = [
    { id: "jd", label: "Read the job description", match: (e: { target?: string }) => /job-description\.md$/.test(e.target ?? "") },
    { id: "base", label: "Read your resume & facts", match: (e: { name: string; target?: string }) => e.name === "Read" && /^resumes\//.test(e.target ?? "") },
    { id: "write", label: "Writing the tailored resume", match: (e: { name: string; target?: string }) => /Write|Edit/.test(e.name) && /\/resume\.md$/.test(e.target ?? "") },
    ...(options.includes("match-report") ? [{ id: "report", label: "Writing the match report", match: (e: { target?: string }) => /match-report\.md$/.test(e.target ?? "") }] : []),
    ...(options.includes("cover-letter") ? [{ id: "cover", label: "Writing the cover letter", match: (e: { target?: string }) => /cover-letter\.md$/.test(e.target ?? "") }] : []),
    { id: "score", label: "Scoring the match", match: (e: { target?: string }) => /result\.json$/.test(e.target ?? "") },
  ];

  // ── Turn 1: draft (or follow-up in the same conversation) ──
  let first: ExecResult;
  if (opts.followUp && job.sessionId) {
    const answeredCount = (opts.followUp.text.match(/^A: (?!\(skipped)/gm) ?? []).length;
    const followDetail = opts.followUp.kind === "answers" ? `${answeredCount} answer${answeredCount === 1 ? "" : "s"} saved to resumes/facts.md` : opts.followUp.text.slice(0, 140);
    setPhase(run, { id: "followup", label: opts.followUp.kind === "answers" ? "Using your answers" : "Applying your request", state: "active", detail: followDetail });
    first = await exec(run, followUpPrompt(folder, write, opts.followUp), { ...cfg, resume: job.sessionId });
    if (!first.ok && !first.stopped) {
      // The conversation may be gone (e.g. cleared). Start fresh with the same instruction.
      first = await exec(run, `${draftPrompt(folder, job, options, write, pageLimit, extras)}\n\nAlso apply this from the user:\n${opts.followUp.text}`, cfg);
    }
    setPhase(run, { id: "followup", label: opts.followUp.kind === "answers" ? "Using your answers" : "Applying your request", state: first.ok ? "done" : "error", detail: followDetail });
  } else {
    for (const d of phaseDefs) setPhase(run, { id: d.id, label: d.label, state: "todo" });
    const stop = trackPhases(run, phaseDefs);
    first = await exec(run, draftPrompt(folder, job, options, write, pageLimit, extras), cfg);
    stop();
    closePhases(run);
  }
  let sessionId = first.sessionId ?? job.sessionId;
  if (!first.ok) return failTailor(run, job, restore, first.stopped ? "Stopped before finishing" : first.error || "Claude didn’t finish");

  // ── Self-check → fix loop ──
  let revisions = 0;
  for (let round = 1; ; round++) {
    // Only invent fallback questions on a first draft — after a follow-up, Claude decides (skipped = don't re-ask).
    await applyTailorResult(job.slug, { gapFallback: !opts.followUp });
    setPhase(run, { id: `check-${round}`, label: round === 1 ? "Self-check: pages, sections, facts" : `Re-check (round ${round})`, state: "active" });
    const checks = await checkJob(job.slug, opts.origin);
    emit(run, { type: "checks", checks, round, at: Date.now() });
    const failing = checks.filter((c) => !c.ok && c.blocking);
    setPhase(run, {
      id: `check-${round}`,
      label: round === 1 ? "Self-check: pages, sections, facts" : `Re-check (round ${round})`,
      state: failing.length ? "warn" : "done",
      detail: failing.length ? failing.map((c) => c.label).join(" · ") : `${checks.filter((c) => c.ok).length}/${checks.length} checks passed`,
    });
    await updateJob(job.slug, { checks, revisions, sessionId });
    if (!failing.length || revisions >= MAX_REVISIONS) break;

    revisions++;
    setPhase(run, { id: `fix-${revisions}`, label: `Fixing: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: "active" });
    const fix = await exec(run, fixPrompt(folder, issuesForClaude(checks)), { ...cfg, resume: sessionId });
    sessionId = fix.sessionId ?? sessionId;
    setPhase(run, { id: `fix-${revisions}`, label: `Fixing: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: fix.ok ? "done" : "error" });
    if (!fix.ok) {
      if (fix.stopped) return failTailor(run, job, restore, "Stopped before finishing");
      break; // keep the last good draft; the failed checks stay visible to the user
    }
  }

  // Form questions pasted when applying → answer them now, in the same conversation (it already knows the job).
  const fresh = await getJob(job.slug);
  if (!fresh?.formAnswers?.items.length && (await readText(path.join(jobDir(job.slug), "form-questions.md")))) {
    const a = await answersPhase(run, fresh ?? job, cfg, { resume: sessionId });
    sessionId = a.sessionId ?? sessionId;
  }

  const final = await updateJob(job.slug, (m) => ({
    ...m,
    status: restore,
    sessionId,
    revisions,
    timeline: [
      ...m.timeline,
      {
        at: new Date().toISOString(),
        type: "tailored",
        note: [m.match && `Match ${m.match.before}% → ${m.match.after}%`, revisions && `${revisions} self-fix${revisions > 1 ? "es" : ""}`].filter(Boolean).join(" · ") || undefined,
      },
    ],
  }));
  if (final?.questions?.length) setPhase(run, { id: "questions", label: `Claude has ${final.questions.length} question${final.questions.length > 1 ? "s" : ""} for you`, state: "warn" });
  finishRun(run, true);
}

async function failTailor(run: Run, job: JobMeta, restore: JobMeta["status"], error: string) {
  const hasResume = !!(await readText(path.join(jobDir(job.slug), "resume.md")));
  await updateJob(job.slug, (m) => ({ ...m, status: restore, lastError: hasResume ? `${error} — showing the previous version` : error }));
  finishRun(run, false);
}

/** Run the deterministic quality checks for a job's current resume.md. */
export async function checkJob(slug: string, origin: string) {
  const job = await getJob(slug);
  if (!job) return [];
  const [tailored, base, facts, rawResult] = await Promise.all([
    readText(path.join(jobDir(slug), "resume.md")),
    getResume(job.baseResume),
    getFacts(),
    readText(path.join(jobDir(slug), "result.json")),
  ]);
  let pages: number | null = null;
  try {
    const pdf = await renderPdf(`${origin}/print/${slug}?export=1`);
    if (pdf) pages = countPages(pdf);
  } catch {
    pages = null;
  }
  let result: unknown = null;
  try {
    result = rawResult ? JSON.parse(rawResult) : null;
  } catch {}
  const { humanVoice } = await getClaudeConfig();
  const known = [facts, await candidateExtras(job)].join("\n");
  return runChecks({ base: base ?? "", tailored: tailored ?? "", facts: known, pageLimit: pageLimitFor(job), pages, result, humanVoice });
}

/** Everything else the candidate told us that counts as true: per-job extras + first-resume sources. */
async function candidateExtras(job: JobMeta) {
  const build = await buildForResume(job.baseResume);
  const [extras, sources] = await Promise.all([readTextFiles(path.join(jobDir(job.slug), "extras")), build ? readTextFiles(buildDir(build.slug)) : ""]);
  return `${extras}\n${sources}`;
}

// ───────────────────────────── Cover letter (on demand) ─────────────────────────────

/** Write (or rewrite) cover-letter.md for a job, then self-check it: length, invented numbers, AI-sounding phrases, sign-off. */
export async function startCoverLetter(job: JobMeta, opts: { origin: string; instruction?: string; override?: Partial<ClaudeConfig> }): Promise<Run> {
  await ensureHome();
  const run = createRun("tailor", job.slug);
  await updateJob(job.slug, { lastRunId: run.id });
  void (async () => {
    const cfg = await getClaudeConfig(opts.override);
    const installed = await enabledSkillNames();
    const folder = rel(jobDir(job.slug)) + "/";
    const academic = job.docType === "academic";
    const existing = await readText(path.join(jobDir(job.slug), "cover-letter.md"));
    const research = job.research?.company?.length ? `- Research notes (from the web, already verified links): ${job.research.company.map((r) => `${r.title} — ${r.note ?? ""} (${r.url})`).join("; ")}` : "";
    setPhase(run, { id: "letter", label: existing && opts.instruction ? "Rewriting the cover letter" : "Writing the cover letter", state: "active", detail: opts.instruction?.slice(0, 120) });
    const prompt = [
      `Use the cover-letter skill${cfg.humanVoice && installed.has("human-voice") ? " and the human-voice skill" : ""}${academic ? " (academic job — follow its academic section)" : ""}.`,
      ``,
      `- Job description: ${folder}job-description.md`,
      `- Tailored ${academic ? "CV" : "resume"}: ${folder}resume.md (fall back to resumes/${job.baseResume} if missing)`,
      `- Extra facts: resumes/facts.md (if it exists)`,
      job.extras && (job.extras.note || job.extras.files.length) ? `- Extra context the candidate added for this application: ${folder}extras/ (true facts — a referral or a reason to apply belongs in the letter)` : ``,
      research,
      cfg.web && installed.has("job-research") ? `- Web access is ON: if you need one company-specific detail (product, initiative, recent news), look it up — cite nothing you didn't read.` : ``,
      existing && opts.instruction ? `- Current letter: ${folder}cover-letter.md — change it as asked: ${opts.instruction}` : opts.instruction ? `- Also: ${opts.instruction}` : ``,
      ``,
      `Write ${folder}cover-letter.md. Only read and write files inside the current directory. Reply with one short line.`,
    ]
      .filter((l) => l !== "")
      .join("\n");
    let res = await exec(run, prompt, cfg);
    setPhase(run, { id: "letter", label: existing && opts.instruction ? "Rewriting the cover letter" : "Writing the cover letter", state: res.ok ? "done" : "error" });
    if (!res.ok) return finishRun(run, false);

    let session = res.sessionId;
    for (let round = 1; round <= MAX_REVISIONS + 1; round++) {
      setPhase(run, { id: `lcheck-${round}`, label: round === 1 ? "Self-check: length, facts, voice" : `Re-check (round ${round})`, state: "active" });
      const checks = await checkLetter(job.slug, cfg.humanVoice);
      emit(run, { type: "checks", checks, round, at: Date.now() });
      const failing = checks.filter((c) => !c.ok && c.blocking);
      setPhase(run, {
        id: `lcheck-${round}`,
        label: round === 1 ? "Self-check: length, facts, voice" : `Re-check (round ${round})`,
        state: failing.length ? "warn" : "done",
        detail: failing.length ? failing.map((c) => c.label).join(" · ") : `${checks.length}/${checks.length} checks passed`,
      });
      await updateJob(job.slug, (m) => ({ ...m, letterChecks: checks, timeline: round === 1 ? [...m.timeline, { at: new Date().toISOString(), type: "cover-letter" }] : m.timeline }));
      if (!failing.length || round > MAX_REVISIONS) break;
      setPhase(run, { id: `lfix-${round}`, label: `Fixing: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: "active" });
      res = await exec(run, `Tailor's self-check found problems with ${folder}cover-letter.md:\n\n${issuesForClaude(checks)}\n\nFix them with Edit and reply with one short line.`, { ...cfg, resume: session });
      session = res.sessionId ?? session;
      setPhase(run, { id: `lfix-${round}`, label: `Fixing: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: res.ok ? "done" : "error" });
      if (!res.ok) break;
    }
    finishRun(run, true);
  })().catch((e) => {
    emit(run, { type: "log", text: (e as Error).message, at: Date.now() });
    finishRun(run, false);
  });
  return run;
}

export async function checkLetter(slug: string, humanVoice = true) {
  const job = await getJob(slug);
  if (!job) return [];
  const dir = jobDir(slug);
  const [letter, resume, base, facts, jd] = await Promise.all([
    readText(path.join(dir, "cover-letter.md")),
    readText(path.join(dir, "resume.md")),
    getResume(job.baseResume),
    getFacts(),
    readText(path.join(dir, "job-description.md")),
  ]);
  const name = /^#\s+(.+)$/m.exec(resume ?? base ?? "")?.[1]?.trim();
  const sources = [resume, base, facts, jd, JSON.stringify(job.research ?? {}), await candidateExtras(job)].filter(Boolean).join("\n");
  return runLetterChecks({ letter: letter ?? "", sources, name, academic: job.docType === "academic", humanVoice });
}

type Extras = { web: boolean; humanVoice: boolean; academic: boolean; extrasDir?: string; sourcesDir?: string };

function draftPrompt(folder: string, job: JobMeta, options: string[], write: string, pageLimit: number, x: Extras) {
  return [
    x.academic
      ? `Use the academic-cv skill to tailor an academic CV (it builds on resume-tailor's hard rules and output files).`
      : `Use the resume-tailor skill to tailor a resume.`,
    ``,
    `- Job folder: ${folder}`,
    `- Job description: ${folder}job-description.md`,
    `- Base ${x.academic ? "CV" : "resume"}: resumes/${job.baseResume}`,
    `- Extra facts from the user (if the file exists): resumes/facts.md`,
    x.sourcesDir
      ? `- More true facts about the candidate (what they shared when building their first resume): ${x.sourcesDir}about.md, ${x.sourcesDir}intake.md and ${x.sourcesDir}extracted.md`
      : ``,
    x.extrasDir
      ? `- Extra context for THIS application from the candidate (true facts — use what's relevant): ${x.extrasDir} — read context.md and every attached document. If you use a fact from a PDF or image there, also write it down in ${x.extrasDir}extracted.md (one bullet per fact, numbers exactly as in the document).`
      : ``,
    `- Enabled options: ${options.join(", ") || "none"}`,
    pageLimit ? `- Page limit: ${pageLimit} page${pageLimit > 1 ? "s" : ""} on A4` : `- Page limit: none (academic CV) — but put the strongest material first`,
    x.humanVoice ? `- Writing voice: follow the human-voice skill for every sentence you write.` : ``,
    x.web
      ? `- Web access is ON: use the job-research skill — look up the company and find current, high-quality learning links for the gaps — and put what you find in result.json "research". Never put web content into the resume as if it were the candidate's experience.`
      : `- Web access is OFF: don't research online; leave "research" out.`,
    ``,
    `Write ${write}.`,
    `Only read and write files inside the current directory. Do not modify the base resume.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function fixPrompt(folder: string, issues: string) {
  return [
    `Tailor's automatic self-check found problems with ${folder}resume.md:`,
    ``,
    issues,
    ``,
    `Fix them with Edit (keep everything else as it is), then update ${folder}result.json if the scores or keywords change.`,
    `Do not add any fact that isn't in the base resume or resumes/facts.md. Reply with one short line.`,
  ].join("\n");
}

function followUpPrompt(folder: string, write: string, f: NonNullable<TailorOpts["followUp"]>) {
  const intro =
    f.kind === "answers"
      ? `I answered your questions (my answers are also saved in resumes/facts.md, and you may use them as true facts):\n\n${f.text}`
      : `Please change the tailored resume: ${f.text}\n\nIf this request states a new fact about me (an achievement, number, tool or project), first append it to resumes/facts.md under a heading "## <today's date> · from a request", then use it. Don't treat it as a fact otherwise.`;
  return [
    intro,
    ``,
    `Update ${write} accordingly, following the resume-tailor skill (same hard rules, fact-check pass, page limit).`,
    `In result.json, drop questions that are now answered — only ask new ones if they genuinely matter. Reply with one short line.`,
  ].join("\n");
}

// ───────────────────────────── Outreach ─────────────────────────────

export async function startOutreach(item: OutreachItem, input: { profile?: string; revise?: string }): Promise<Run> {
  await ensureHome();
  const settings = await getSettings();
  const run = createRun("outreach", item.slug);
  await saveOutreach({ ...item, lastRunId: run.id });

  void (async () => {
    const cfg = await getClaudeConfig();
    let res: ExecResult;
    if (input.revise && item.sessionId) {
      setPhase(run, { id: "revise", label: "Rewriting the drafts", state: "active", detail: input.revise });
      res = await exec(
        run,
        `Please revise the drafts: ${input.revise}\n\nRewrite outreach/${item.slug}.drafts.json and outreach/${item.slug}.md following the outreach-writer skill (same rules and character limits). Reply with one short line.`,
        { ...cfg, resume: item.sessionId },
      );
      setPhase(run, { id: "revise", label: "Rewriting the drafts", state: res.ok ? "done" : "error" });
    } else {
      if (input.profile) await writeOutreachRequest(item, input.profile, settings.defaultResume);
      setPhase(run, { id: "parse", label: "Reading their profile", state: "active" });
      res = await exec(
        run,
        [
          `Use the outreach-writer skill${cfg.humanVoice ? " and the human-voice skill" : ""}.`,
          `Request: outreach/${item.slug}.request.md`,
          `Extra facts about me (if the file exists): resumes/facts.md`,
          cfg.web ? `Web access is ON: you may run one or two searches for a genuine, recent hook about their company or work (a launch, a post, a talk). Only use what you actually read; never invent shared history.` : ``,
          input.revise ? `Also: ${input.revise}` : ``,
          `Write outreach/${item.slug}.drafts.json and outreach/${item.slug}.md. Only read and write files inside the current directory.`,
        ].join("\n"),
        cfg,
      );
      setPhase(run, { id: "parse", label: "Reading their profile", state: res.ok ? "done" : "error" });
    }
    let raw = await readText(path.join(dirs.outreach, `${item.slug}.drafts.json`));

    // Self-check: stock AI phrasing in a cold message is the fastest way to get ignored. One automatic rewrite.
    if (res.ok && raw && cfg.humanVoice) {
      try {
        const drafts = (JSON.parse(raw).drafts ?? []) as { label: string; text: string }[];
        const tells = [...new Set(drafts.flatMap((d) => aiTells(d.text)))];
        if (tells.length) {
          setPhase(run, { id: "voice", label: "Making it sound like you", state: "active", detail: tells.slice(0, 5).join(", ") });
          const fix = await exec(
            run,
            `These drafts contain phrases that read as AI-written: ${tells.join(", ")}. Rewrite only those parts the way I'd actually say them (human-voice skill), keep the character limits, and update outreach/${item.slug}.drafts.json and outreach/${item.slug}.md. Reply with one short line.`,
            { ...cfg, resume: res.sessionId },
          );
          setPhase(run, { id: "voice", label: "Making it sound like you", state: fix.ok ? "done" : "warn" });
          if (fix.ok) res = { ...fix, sessionId: fix.sessionId ?? res.sessionId };
          raw = await readText(path.join(dirs.outreach, `${item.slug}.drafts.json`));
        }
      } catch {}
    }
    let ok = res.ok && !!raw;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<OutreachItem>;
        const cur = (await getOutreach(item.slug)) ?? item;
        await saveOutreach({
          ...cur,
          name: parsed.name || cur.name,
          headline: parsed.headline ?? cur.headline,
          context: parsed.context ?? cur.context,
          drafts: (parsed.drafts ?? []).map((d) => ({ ...d, chars: d.text.length })),
          sessionId: res.sessionId ?? cur.sessionId,
        });
      } catch {
        ok = false;
        emit(run, { type: "log", text: "Claude wrote invalid drafts.json", at: Date.now() });
      }
    }
    finishRun(run, ok);
  })();
  return run;
}

async function writeOutreachRequest(item: OutreachItem, profile: string, defaultResume?: string) {
  const req = [
    `# Outreach request`,
    ``,
    `- Intent: ${item.intent}`,
    `- Tone: ${item.tone}`,
    `- Format: ${item.format}`,
    item.jobSlug ? `- Linked job folder: jobs/${item.jobSlug}/` : `- Linked job folder: none`,
    defaultResume ? `- User's base resume: resumes/${defaultResume}` : ``,
    ``,
    `## Pasted profile`,
    ``,
    "```",
    profile.slice(0, 60_000),
    "```",
  ].join("\n");
  await fs.writeFile(path.join(dirs.outreach, `${item.slug}.request.md`), req, "utf8");
}

// ───────────────────────────── Application form questions ─────────────────────────────

/** Append newly pasted questions to jobs/<slug>/form-questions.md (keeps earlier batches). */
export async function addFormQuestions(slug: string, text: string) {
  const file = path.join(jobDir(slug), "form-questions.md");
  const cur = (await readText(file)) ?? "# Application form questions\n";
  await fs.writeFile(file, `${cur.trimEnd()}\n\n## Pasted ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n\n${text.trim()}\n`, "utf8");
}

/** Answer form questions on their own (job page), with the same self-check → fix loop. */
export async function startFormAnswers(job: JobMeta, opts: { instruction?: string; override?: Partial<ClaudeConfig> }): Promise<Run> {
  await ensureHome();
  const run = createRun("tailor", job.slug);
  await updateJob(job.slug, { lastRunId: run.id });
  void (async () => {
    const cfg = await getClaudeConfig(opts.override);
    const r = await answersPhase(run, job, cfg, { instruction: opts.instruction, resume: job.sessionId });
    finishRun(run, r.ok);
  })().catch((e) => {
    emit(run, { type: "log", text: (e as Error).message, at: Date.now() });
    finishRun(run, false);
  });
  return run;
}

async function answersPhase(run: Run, job: JobMeta, cfg: Awaited<ReturnType<typeof getClaudeConfig>>, opts: { instruction?: string; resume?: string }): Promise<{ ok: boolean; sessionId?: string }> {
  const installed = await enabledSkillNames();
  const folder = rel(jobDir(job.slug)) + "/";
  const questionsText = (await readText(path.join(jobDir(job.slug), "form-questions.md"))) ?? "";
  if (!questionsText.trim()) return { ok: true, sessionId: opts.resume };
  const build = await buildForResume(job.baseResume);
  const hasExtras = !!(job.extras && (job.extras.note || job.extras.files.length));
  const research = job.research?.company?.length ? job.research.company.map((r) => `${r.title}: ${r.note ?? ""} (${r.url})`).join("; ") : "";

  setPhase(run, { id: "answers", label: "Answering the form questions", state: "active", detail: opts.instruction?.slice(0, 120) });
  const prompt = [
    `Use the application-answers skill${cfg.humanVoice && installed.has("human-voice") ? " and the human-voice skill" : ""}.`,
    ``,
    `- Questions: ${folder}form-questions.md (answer every question in it; keep earlier answers in ${folder}form-answers.json unless asked to change them)`,
    `- Job description: ${folder}job-description.md`,
    `- Candidate: ${folder}resume.md (tailored; fall back to resumes/${job.baseResume}), resumes/facts.md${build ? `, ${rel(buildDir(build.slug))}/about.md and extracted.md` : ""}${hasExtras ? `, ${folder}extras/ (context for this application)` : ""}`,
    research ? `- Company research already found: ${research}` : ``,
    cfg.web && installed.has("job-research") ? `- Web access is ON: for "why us" questions you may look up one specific, current company detail.` : ``,
    opts.instruction ? `- The user asks: ${opts.instruction}` : ``,
    ``,
    `Write ${folder}form-answers.json and ${folder}form-answers.md. Only read and write files inside the current directory. Reply with one short line.`,
  ]
    .filter(Boolean)
    .join("\n");
  let res = await exec(run, prompt, { ...cfg, resume: opts.resume });
  if (!res.ok && opts.resume && !res.stopped) res = await exec(run, prompt, cfg); // session gone → fresh
  setPhase(run, { id: "answers", label: "Answering the form questions", state: res.ok ? "done" : "error" });
  if (!res.ok) return { ok: false, sessionId: opts.resume };
  let session = res.sessionId ?? opts.resume;

  for (let round = 1; round <= MAX_REVISIONS + 1; round++) {
    setPhase(run, { id: `acheck-${round}`, label: round === 1 ? "Self-check: limits, facts, voice" : `Re-check answers (round ${round})`, state: "active" });
    const { items, checks } = await checkAnswers(job.slug, cfg.humanVoice);
    emit(run, { type: "checks", checks, round, at: Date.now() });
    const failing = checks.filter((c) => !c.ok && c.blocking);
    setPhase(run, {
      id: `acheck-${round}`,
      label: round === 1 ? "Self-check: limits, facts, voice" : `Re-check answers (round ${round})`,
      state: failing.length ? "warn" : "done",
      detail: failing.length ? failing.map((c) => c.label).join(" · ") : `${items.length} answer${items.length === 1 ? "" : "s"} · ${checks.length}/${checks.length} checks passed`,
    });
    await updateJob(job.slug, (m) => ({ ...m, formAnswers: { items, checks, updatedAt: new Date().toISOString() } }));
    if (!failing.length || round > MAX_REVISIONS) break;
    setPhase(run, { id: `afix-${round}`, label: `Fixing answers: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: "active" });
    res = await exec(run, `Tailor's self-check found problems in ${folder}form-answers.json:\n\n${issuesForClaude(checks)}\n\nFix only those answers, update form-answers.json and form-answers.md, and reply with one short line.`, { ...cfg, resume: session });
    session = res.sessionId ?? session;
    setPhase(run, { id: `afix-${round}`, label: `Fixing answers: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: res.ok ? "done" : "error" });
    if (!res.ok) break;
  }
  const final = await getJob(job.slug);
  const needs = final?.formAnswers?.items.filter((a) => a.needsInput).length ?? 0;
  if (needs) setPhase(run, { id: "answers-input", label: `${needs} answer${needs > 1 ? "s need" : " needs"} a detail only you know`, state: "warn" });
  await updateJob(job.slug, (m) => ({ ...m, timeline: [...m.timeline, { at: new Date().toISOString(), type: "form-answers", note: `${final?.formAnswers?.items.length ?? 0} questions` }] }));
  return { ok: true, sessionId: session };
}

export async function checkAnswers(slug: string, humanVoice = true) {
  const job = await getJob(slug);
  const dir = jobDir(slug);
  let items: { id: string; question: string; answer: string; limit?: { n: number; unit: "characters" | "words" }; needsInput?: string }[] = [];
  try {
    const raw = JSON.parse((await readText(path.join(dir, "form-answers.json"))) ?? "{}");
    items = (Array.isArray(raw) ? raw : (raw.items ?? [])).map((it: Record<string, unknown>, i: number) => ({
      id: String(it.id ?? `q${i + 1}`),
      question: String(it.question ?? ""),
      answer: String(it.answer ?? ""),
      limit: it.limit as { n: number; unit: "characters" | "words" } | undefined,
      needsInput: typeof it.needsInput === "string" && it.needsInput.trim() ? it.needsInput : undefined,
    }));
  } catch {}
  if (!job) return { items, checks: [] };
  const [resume, base, facts, jd, questionsText] = await Promise.all([
    readText(path.join(dir, "resume.md")),
    getResume(job.baseResume),
    getFacts(),
    readText(path.join(dir, "job-description.md")),
    readText(path.join(dir, "form-questions.md")),
  ]);
  const sources = [resume, base, facts, jd, JSON.stringify(job.research ?? {}), await candidateExtras(job)].filter(Boolean).join("\n");
  return { items, checks: runAnswerChecks({ items, questionsText: questionsText ?? "", sources, humanVoice }) };
}

// ───────────────────────────── Build my first resume ─────────────────────────────

type BuildOpts = { followUp?: { kind: "answers" | "revise"; text: string } };

/** Turn a description + documents into a first base resume. Same loop as tailoring: draft → self-check → fix → questions. */
export async function startBuild(build: BuildMeta, opts: BuildOpts = {}): Promise<Run> {
  await ensureHome();
  const run = createRun("import", build.file);
  await updateBuild(build.slug, { status: "building", lastRunId: run.id, lastError: undefined });
  void buildFlow(run, build, opts).catch(async (e) => {
    emit(run, { type: "log", text: (e as Error).message, at: Date.now() });
    await updateBuild(build.slug, { status: "error", lastError: (e as Error).message }).catch(() => {});
    finishRun(run, false);
  });
  return run;
}

async function buildFlow(run: Run, build: BuildMeta, opts: BuildOpts) {
  const cfg = await getClaudeConfig();
  const installed = await enabledSkillNames();
  const src = `${rel(buildDir(build.slug))}/`;
  const target = `resumes/${build.file}`;
  const humanVoice = cfg.humanVoice && installed.has("human-voice");
  const academic = build.docType === "academic";

  let res: ExecResult;
  if (opts.followUp && build.sessionId) {
    setPhase(run, { id: "followup", label: opts.followUp.kind === "answers" ? "Adding your answers" : "Applying your request", state: "active" });
    res = await exec(
      run,
      [
        opts.followUp.kind === "answers"
          ? `Here are my answers (also saved to resumes/facts.md — they are true facts you can use):\n\n${opts.followUp.text}`
          : `Please change my resume: ${opts.followUp.text}\n\nIf this states a new fact about me, first append it to resumes/facts.md, then use it.`,
        ``,
        `Update ${target}, ${src}extracted.md (if new facts) and ${src}result.json following the resume-builder skill. Drop questions that are answered; only ask new ones that genuinely matter. Reply with one short line.`,
      ].join("\n"),
      { ...cfg, resume: build.sessionId },
    );
    setPhase(run, { id: "followup", label: opts.followUp.kind === "answers" ? "Adding your answers" : "Applying your request", state: res.ok ? "done" : "error" });
  } else {
    const defs = [
      { id: "read", label: "Reading what you shared", match: (e: { name: string; target?: string }) => e.name === "Read" && (e.target ?? "").startsWith(src) },
      { id: "facts", label: "Noting facts from your documents", match: (e: { name: string; target?: string }) => /Write|Edit/.test(e.name) && /extracted\.md$/.test(e.target ?? "") },
      { id: "write", label: "Writing your resume", match: (e: { name: string; target?: string }) => /Write|Edit/.test(e.name) && (e.target ?? "") === target },
      { id: "questions", label: "Preparing questions for you", match: (e: { target?: string }) => (e.target ?? "") === `${src}result.json` },
    ];
    for (const d of defs) setPhase(run, { id: d.id, label: d.label, state: "todo" });
    const stop = trackPhases(run, defs);
    res = await exec(
      run,
      [
        `Use the resume-builder skill${humanVoice ? " and the human-voice skill" : ""} to build a first ${academic ? "academic CV" : "resume"} for someone who doesn't have one yet.`,
        ``,
        `- Everything they shared: ${src} — about.md (their own words), intake.md (contact details, target role, preferences) and any documents (PDF, images, Word conversions *.docx.md, text).`,
        `- Format: ${academic ? "academic CV (also follow the academic-cv skill's section rules)" : "industry resume"}${build.region ? ` · region: ${build.region}` : ""}`,
        `- Write ${src}extracted.md (facts from the documents), then ${target}, then ${src}result.json.`,
        cfg.web && build.targetRole ? `- Web access is ON: you may look up what employers expect for "${build.targetRole}" to pick the right emphasis and section order — never add skills or facts the person didn't give.` : ``,
        `Only read and write files inside the current directory.`,
      ]
        .filter(Boolean)
        .join("\n"),
      cfg,
    );
    stop();
    closePhases(run);
  }
  let sessionId = res.sessionId ?? build.sessionId;
  if (!res.ok) {
    await updateBuild(build.slug, { status: (await readText(path.join(dirs.resumes, build.file))) ? "ready" : "error", lastError: res.stopped ? "Stopped before finishing" : res.error || "Claude didn’t finish", sessionId });
    return finishRun(run, false);
  }

  // Self-check → fix
  let revisions = 0;
  for (let round = 1; ; round++) {
    setPhase(run, { id: `check-${round}`, label: round === 1 ? "Self-check: facts, sections, format" : `Re-check (round ${round})`, state: "active" });
    const checks = await checkBuild(build.slug, humanVoice);
    emit(run, { type: "checks", checks, round, at: Date.now() });
    const failing = checks.filter((c) => !c.ok && c.blocking);
    setPhase(run, {
      id: `check-${round}`,
      label: round === 1 ? "Self-check: facts, sections, format" : `Re-check (round ${round})`,
      state: failing.length ? "warn" : "done",
      detail: failing.length ? failing.map((c) => c.label).join(" · ") : `${checks.filter((c) => c.ok).length}/${checks.length} checks passed`,
    });
    await updateBuild(build.slug, { checks, revisions, sessionId });
    if (!failing.length || revisions >= MAX_REVISIONS) break;
    revisions++;
    setPhase(run, { id: `fix-${revisions}`, label: `Fixing: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: "active" });
    const fix = await exec(run, `Tailor's self-check found problems with ${target}:\n\n${issuesForClaude(checks)}\n\nOnly use facts from ${src} and resumes/facts.md. Fix with Edit and reply with one short line.`, { ...cfg, resume: sessionId });
    sessionId = fix.sessionId ?? sessionId;
    setPhase(run, { id: `fix-${revisions}`, label: `Fixing: ${failing.map((c) => c.label.toLowerCase()).join(", ")}`, state: fix.ok ? "done" : "error" });
    if (!fix.ok) break;
  }

  // Questions / suggestions from result.json
  let parsed: { name?: string; questions?: ClaudeQuestion[]; suggestions?: string[] } = {};
  try {
    parsed = JSON.parse((await readText(path.join(buildDir(build.slug), "result.json"))) ?? "{}");
  } catch {}
  const updated = await updateBuild(build.slug, {
    status: "ready",
    name: parsed.name || build.name,
    questions: (parsed.questions ?? []).slice(0, 4),
    suggestions: (parsed.suggestions ?? []).slice(0, 3),
    sessionId,
    revisions,
  });
  // First resume ever? Make it the default base resume.
  const settings = await getSettings();
  if (!settings.defaultResume) await saveSettings({ defaultResume: build.file });
  if (updated.questions?.length) setPhase(run, { id: "asks", label: `Claude has ${updated.questions.length} question${updated.questions.length > 1 ? "s" : ""} to make it stronger`, state: "warn" });
  finishRun(run, true);
}

export async function checkBuild(slug: string, humanVoice = true) {
  const build = await getBuild(slug);
  if (!build) return [];
  const [resume, sources, facts] = await Promise.all([readText(path.join(dirs.resumes, build.file)), readTextFiles(buildDir(slug)), getFacts()]);
  return runBuildChecks({ resume: resume ?? "", sources: `${sources}\n${facts}`, academic: build.docType === "academic", humanVoice });
}

// ───────────────────────────── Import ─────────────────────────────

export async function startImport(sourceFile: string, targetFile: string): Promise<Run> {
  const run = createRun("import", targetFile);
  void (async () => {
    setPhase(run, { id: "read", label: "Reading your CV", state: "active" });
    const res = await exec(
      run,
      [`Use the resume-import skill.`, `Original: resumes/original/${sourceFile}`, `Target: resumes/${targetFile}`, `Only read and write files inside the current directory.`].join("\n"),
      await getClaudeConfig(),
    );
    const wrote = !!(await readText(path.join(dirs.resumes, targetFile)));
    setPhase(run, { id: "read", label: "Reading your CV", state: res.ok && wrote ? "done" : "error" });
    finishRun(run, res.ok && wrote);
  })();
  return run;
}
