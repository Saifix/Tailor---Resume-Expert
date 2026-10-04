export const STATUSES = ["draft", "tailoring", "applied", "interview", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  tailoring: "Tailoring",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type TimelineEvent = { at: string; type: string; note?: string };

export type Reminder = { id: string; at: string; title: string; done?: boolean };

export type Keywords = { have: string[]; added: string[]; missing: string[] };

/** Something Claude wants to know to make the resume stronger (asked after the first draft). */
export type ClaudeQuestion = { id: string; question: string; why?: string };

/** A web link Claude found while researching (company news, learning resources). */
export type WebLink = { title: string; url: string; note?: string };
export type LearnLink = WebLink & { topic: string; kind?: "course" | "docs" | "article" | "video" | "project" | "book" };
export type Research = { company?: WebLink[]; learn?: LearnLink[]; interview?: WebLink[]; researchedAt?: string };

export type DocType = "resume" | "academic";

export type SourceFile = { name: string; original: string; readable: string; kind: "text" | "pdf" | "image" | "word" };

/** Optional extra context the candidate adds for one application (saved in jobs/<slug>/extras/). */
export type JobExtras = { note?: string; files: SourceFile[] };

/** "Build my first resume" — everything the user told us, in resumes/sources/<slug>/. */
export type BuildMeta = {
  slug: string;
  file: string; // target base resume: resumes/<file>
  name?: string;
  targetRole?: string;
  docType: DocType;
  region?: string;
  createdAt: string;
  status: "building" | "ready" | "error";
  sources: SourceFile[];
  questions?: ClaudeQuestion[];
  suggestions?: string[];
  checks?: QualityCheck[];
  revisions?: number;
  sessionId?: string;
  lastRunId?: string;
  lastError?: string;
};

export type QualityCheck = { id: string; label: string; ok: boolean; detail?: string; blocking?: boolean };

export type JobMeta = {
  slug: string;
  company: string;
  role: string;
  location?: string;
  url?: string;
  salary?: string;
  status: Status;
  createdAt: string;
  appliedAt?: string;
  baseResume: string; // file name inside resumes/
  skills: string[];
  docType?: DocType; // resume (industry, 1–2 pages) or academic CV (no page limit)
  research?: Research;
  letterChecks?: QualityCheck[];
  extras?: JobExtras;
  match?: { before: number; after: number };
  keywords?: Keywords;
  summary?: string;
  changes?: string[];
  reminders: Reminder[];
  timeline: TimelineEvent[];
  questions?: ClaudeQuestion[];
  suggestions?: string[];
  checks?: QualityCheck[];
  revisions?: number; // self-review rounds used on the last run
  sessionId?: string; // Claude Code conversation, for follow-ups
  lastRunId?: string;
  lastError?: string;
};

/** What the resume-tailor skill writes to jobs/<slug>/result.json */
export type TailorResult = {
  company?: string;
  role?: string;
  location?: string;
  matchBefore: number;
  matchAfter: number;
  keywords: Keywords;
  summary: string;
  changes: string[];
  questions?: ClaudeQuestion[];
  suggestions?: string[];
  research?: Research;
};

export type ResumeInfo = {
  file: string;
  title: string;
  words: number;
  updatedAt: string;
  usedBy: number;
  isDefault: boolean;
};

export type OutreachDraft = { label: string; text: string; chars: number; recommended?: boolean };

export type OutreachItem = {
  slug: string;
  name: string;
  headline?: string;
  intent: string;
  tone: string;
  format: string;
  jobSlug?: string;
  createdAt: string;
  context?: string[];
  drafts: OutreachDraft[];
  sessionId?: string;
  lastRunId?: string;
};

export type Settings = {
  userName: string;
  defaultResume?: string;
  model?: string; // legacy — use claude.model
  claude?: {
    model?: string;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    fallbackModel?: string;
    web?: boolean;
    instructions?: string;
    loadUserSettings?: boolean;
    humanVoice?: boolean; // apply the human-voice writing skill
  };
  dictation?: {
    language?: string; // BCP-47 tag for the browser's speech recognition (e.g. "en-US", "ur-PK"); empty = browser default
  };
};
