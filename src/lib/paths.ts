import os from "node:os";
import path from "node:path";

/** Root of all Tailor data. Override with TAILOR_HOME (e.g. a throwaway folder for testing). */
export const TAILOR_HOME = process.env.TAILOR_HOME
  ? path.resolve(process.env.TAILOR_HOME)
  : path.join(os.homedir(), "Tailor");

export const dirs = {
  root: TAILOR_HOME,
  resumes: path.join(TAILOR_HOME, "resumes"),
  originals: path.join(TAILOR_HOME, "resumes", "original"),
  jobs: path.join(TAILOR_HOME, "jobs"),
  outreach: path.join(TAILOR_HOME, "outreach"),
  skills: path.join(TAILOR_HOME, ".claude", "skills"),
  settings: path.join(TAILOR_HOME, "tailor.json"),
};

/** Show paths relative to the home dir the way the UI does (~/Tailor/...). */
export function displayPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length).replaceAll("\\", "/") : p.replaceAll("\\", "/");
}

/** Path relative to TAILOR_HOME with forward slashes — what we hand to Claude. */
export function rel(p: string): string {
  return path.relative(TAILOR_HOME, p).replaceAll("\\", "/");
}

/** Guard against path traversal from user-supplied slugs/names. */
export function safeSegment(s: string): string {
  const clean = s.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!clean || clean === "." || clean === "..") throw new Error(`Invalid name: ${s}`);
  return clean;
}

export function slugify(s: string, max = 40): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}
