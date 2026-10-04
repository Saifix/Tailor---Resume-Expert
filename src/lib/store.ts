import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { dirs, safeSegment, slugify } from "./paths";
import type { ClaudeConfig } from "./claude";
import type { JobMeta, OutreachItem, ResumeInfo, Settings, Status, TailorResult } from "./types";

// ---------- low-level helpers ----------

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
}

export async function readText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

const now = () => new Date().toISOString();

// ---------- home / skills bootstrap ----------

const SKILL_TEMPLATES = path.join(process.cwd(), "skills");

let ensured: Promise<void> | null = null;

/** Create ~/Tailor and install bundled skills that aren't there yet. Never overwrites user edits. */
export function ensureHome(): Promise<void> {
  ensured ??= (async () => {
    for (const d of [dirs.root, dirs.resumes, dirs.originals, dirs.jobs, dirs.outreach, dirs.skills]) {
      await fs.mkdir(d, { recursive: true });
    }
    if (existsSync(SKILL_TEMPLATES)) {
      for (const name of await fs.readdir(SKILL_TEMPLATES)) await syncSkill(name);
    }
    if (!existsSync(dirs.settings)) await writeJson(dirs.settings, { userName: "" } satisfies Settings);
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Install or update one bundled skill. `.tailor-installed` holds the hash of the SKILL.md we last wrote:
 * if the user's copy still matches it they haven't edited it, so it's safe to upgrade to the new template.
 */
async function syncSkill(name: string) {
  const template = await readText(path.join(SKILL_TEMPLATES, name, "SKILL.md"));
  if (!template) return;
  const dir = path.join(dirs.skills, name);
  const marker = path.join(dir, ".tailor-installed");
  const current = await readText(path.join(dir, "SKILL.md"));
  const installedHash = (await readText(marker))?.trim();
  const userEdited = current !== null && sha(current) !== installedHash;
  if (current === template || userEdited) return;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), template, "utf8");
  await fs.writeFile(marker, sha(template), "utf8");
}

// ---------- settings ----------

export async function getSettings(): Promise<Settings & { disabledSkills?: string[] }> {
  await ensureHome();
  return readJson(dirs.settings, { userName: "" });
}

export async function saveSettings(patch: Partial<Settings & { disabledSkills: string[] }>) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await writeJson(dirs.settings, next);
  return next;
}

/** Effective Claude Code config: Settings → Claude, with optional per-run overrides. */
export async function getClaudeConfig(override: Partial<ClaudeConfig> = {}) {
  const s = await getSettings();
  const c = s.claude ?? {};
  const cfg = {
    model: c.model ?? s.model ?? "",
    effort: c.effort,
    fallbackModel: c.fallbackModel,
    web: c.web ?? true,
    instructions: c.instructions,
    loadUserSettings: c.loadUserSettings ?? false,
    humanVoice: c.humanVoice ?? true,
  };
  for (const [k, v] of Object.entries(override)) if (v !== undefined && v !== "") (cfg as Record<string, unknown>)[k] = v;
  return { ...cfg, model: cfg.model || undefined };
}

// ---------- skills ----------

export type SkillInfo = { name: string; description: string; enabled: boolean };

export async function listSkills(): Promise<SkillInfo[]> {
  await ensureHome();
  const settings = await getSettings();
  const disabled = new Set(settings.disabledSkills ?? []);
  const out: SkillInfo[] = [];
  for (const name of (await fs.readdir(dirs.skills)).sort()) {
    const md = await readText(path.join(dirs.skills, name, "SKILL.md"));
    if (!md) continue;
    const desc = /^description:\s*(.+)$/m.exec(md)?.[1]?.trim() ?? "";
    out.push({ name, description: desc, enabled: !disabled.has(name) });
  }
  return out;
}

// ---------- resumes ----------

export async function listResumes(): Promise<ResumeInfo[]> {
  await ensureHome();
  const [settings, jobs] = await Promise.all([getSettings(), listJobs()]);
  const files = (await fs.readdir(dirs.resumes)).filter((f) => f.endsWith(".md") && f !== FACTS_FILE);
  const out = await Promise.all(
    files.map(async (file): Promise<ResumeInfo> => {
      const full = path.join(dirs.resumes, file);
      const [text, stat] = await Promise.all([fs.readFile(full, "utf8"), fs.stat(full)]);
      const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? file.replace(/\.md$/, "");
      return {
        file,
        title,
        words: text.split(/\s+/).filter(Boolean).length,
        updatedAt: stat.mtime.toISOString(),
        usedBy: jobs.filter((j) => j.baseResume === file).length,
        isDefault: settings.defaultResume ? settings.defaultResume === file : false,
      };
    }),
  );
  if (!out.some((r) => r.isDefault) && out.length) out[0].isDefault = true;
  return out.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt));
}

/** Extra facts the user told Claude while answering its questions. Treated as true by the skills. */
export const FACTS_FILE = "facts.md";

export async function getFacts() {
  return (await readText(path.join(dirs.resumes, FACTS_FILE))) ?? "";
}

export async function appendFacts(heading: string, qa: { question: string; answer: string }[]) {
  const file = path.join(dirs.resumes, FACTS_FILE);
  const intro = "True details about you that aren't in your base resumes yet. Claude may use them when tailoring. Edit freely.";
  const cur = (await readText(file)) ?? `# Facts you told Tailor\n\n${intro}\n`;
  const block = [`\n## ${now().slice(0, 10)} · ${heading}`, ...qa.map((x) => `- **${x.question}** ${x.answer.trim()}`)].join("\n");
  await fs.writeFile(file, `${cur.trimEnd()}\n${block}\n`, "utf8");
}

export async function getResume(file: string) {
  return readText(path.join(dirs.resumes, safeSegment(file)));
}

export async function listOriginals() {
  await ensureHome();
  return (await fs.readdir(dirs.originals)).filter((f) => !f.startsWith("."));
}

// ---------- jobs ----------

export async function listJobs(): Promise<JobMeta[]> {
  await ensureHome();
  const entries = await fs.readdir(dirs.jobs, { withFileTypes: true });
  const metas = await Promise.all(
    entries.filter((e) => e.isDirectory()).map((e) => readJson<JobMeta | null>(path.join(dirs.jobs, e.name, "meta.json"), null)),
  );
  return metas.filter((m): m is JobMeta => !!m).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function jobDir(slug: string) {
  return path.join(dirs.jobs, safeSegment(slug));
}

export async function getJob(slug: string): Promise<JobMeta | null> {
  return readJson<JobMeta | null>(path.join(jobDir(slug), "meta.json"), null);
}

export async function getJobFile(slug: string, name: string) {
  return readText(path.join(jobDir(slug), safeSegment(name)));
}

export async function listJobFiles(slug: string) {
  const dir = jobDir(slug);
  const names = (await fs.readdir(dir)).filter((n) => !n.endsWith(".tmp"));
  return Promise.all(
    names.map(async (name) => {
      const s = await fs.stat(path.join(dir, name));
      return { name, size: s.size, updatedAt: s.mtime.toISOString() };
    }),
  );
}

export async function createJob(input: {
  company: string;
  role: string;
  url?: string;
  jd: string;
  baseResume: string;
  skills: string[];
  docType?: "resume" | "academic";
}): Promise<JobMeta> {
  await ensureHome();
  const date = now().slice(0, 10);
  const company = input.company.trim() || "Unknown company";
  const role = input.role.trim() || "Untitled role";
  let slug = `${date}_${slugify(company, 24) || "company"}_${slugify(role, 32) || "role"}`;
  for (let i = 2; existsSync(path.join(dirs.jobs, slug)); i++) slug = slug.replace(/(-\d+)?$/, `-${i}`);
  const meta: JobMeta = {
    slug,
    company,
    role,
    url: input.url?.trim() || undefined,
    status: "draft",
    createdAt: now(),
    baseResume: input.baseResume,
    skills: input.skills,
    docType: input.docType ?? "resume",
    reminders: [],
    timeline: [{ at: now(), type: "created", note: "Job description saved" }],
  };
  const dir = path.join(dirs.jobs, slug);
  await fs.mkdir(dir, { recursive: true });
  const header = [`# ${role} — ${company}`, input.url ? `Source: ${input.url}` : null, ""].filter((l) => l !== null).join("\n");
  await fs.writeFile(path.join(dir, "job-description.md"), `${header}\n${input.jd.trim()}\n`, "utf8");
  await writeJson(path.join(dir, "meta.json"), meta);
  return meta;
}

export async function updateJob(slug: string, patch: Partial<JobMeta> | ((m: JobMeta) => JobMeta)): Promise<JobMeta> {
  const cur = await getJob(slug);
  if (!cur) throw new Error(`Job not found: ${slug}`);
  const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
  await writeJson(path.join(jobDir(slug), "meta.json"), next);
  return next;
}

export async function setJobStatus(slug: string, status: Status) {
  return updateJob(slug, (m) => ({
    ...m,
    status,
    appliedAt: status === "applied" && !m.appliedAt ? now() : m.appliedAt,
    timeline: [...m.timeline, { at: now(), type: status }],
  }));
}

/** Merge result.json written by the resume-tailor skill into meta.json. */
export async function applyTailorResult(slug: string, opts: { gapFallback?: boolean } = {}): Promise<JobMeta> {
  const res = await readJson<TailorResult | null>(path.join(jobDir(slug), "result.json"), null);
  const hasResume = existsSync(path.join(jobDir(slug), "resume.md"));
  return updateJob(slug, (m) => ({
    ...m,
    company: m.company === "Unknown company" && res?.company ? res.company : m.company,
    role: m.role === "Untitled role" && res?.role ? res.role : m.role,
    location: res?.location || m.location,
    match: res ? { before: clampPct(res.matchBefore), after: clampPct(res.matchAfter) } : m.match,
    keywords: res?.keywords ?? m.keywords,
    summary: res?.summary ?? m.summary,
    changes: res?.changes ?? m.changes,
    questions: res ? (res.questions?.length ? res.questions : opts.gapFallback ? gapQuestions(res.keywords?.missing ?? []) : []).slice(0, 3) : m.questions,
    suggestions: res ? (res.suggestions ?? []).slice(0, 3) : m.suggestions,
    research: res?.research ? { ...res.research, researchedAt: m.research?.researchedAt ?? now() } : m.research,
    lastError: hasResume ? undefined : "Claude finished without writing resume.md",
  }));
}

/** Fallback when the model skips asking: turn the top gaps into questions so the user can fill them in. */
function gapQuestions(missing: string[]) {
  return missing.slice(0, 3).map((gap, i) => ({
    id: `gap-${i + 1}`,
    question: `The job asks for “${gap}”. Have you done this anywhere — at work, in a side project or a course? If so, what did you do and what was the result?`,
    why: "Listed in the job description, but not in your resume yet",
  }));
}

const clampPct = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

// ---------- outreach ----------

export async function listOutreach(): Promise<OutreachItem[]> {
  await ensureHome();
  const files = (await fs.readdir(dirs.outreach)).filter((f) => f.endsWith(".json") && !f.endsWith(".drafts.json"));
  const items = await Promise.all(files.map((f) => readJson<OutreachItem | null>(path.join(dirs.outreach, f), null)));
  return items.filter((i): i is OutreachItem => !!i?.createdAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOutreach(slug: string) {
  return readJson<OutreachItem | null>(path.join(dirs.outreach, `${safeSegment(slug)}.json`), null);
}

export async function saveOutreach(item: OutreachItem) {
  await writeJson(path.join(dirs.outreach, `${safeSegment(item.slug)}.json`), item);
}

export function newOutreachSlug(name: string) {
  const base = slugify(name, 32) || "person";
  let slug = base;
  for (let i = 2; existsSync(path.join(dirs.outreach, `${slug}.json`)); i++) slug = `${base}-${i}`;
  return slug;
}
