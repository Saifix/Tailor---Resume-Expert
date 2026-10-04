import { spawn, execFile, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { TAILOR_HOME } from "./paths";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";

/** Tools a Tailor run may use. No Bash — Claude only reads/writes files in ~/Tailor (plus web search when enabled). */
const TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Skill"];
const WEB_TOOLS = ["WebSearch", "WebFetch"];

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/** Everything about how Claude Code runs, configurable from Settings (and per run). */
export type ClaudeConfig = {
  model?: string; // alias (fable, opus, sonnet, haiku) or full model id; empty = your Claude Code default
  effort?: Effort;
  fallbackModel?: string;
  web?: boolean; // allow WebSearch + WebFetch
  instructions?: string; // appended to the system prompt on every run
  loadUserSettings?: boolean; // also load ~/.claude settings (hooks, permissions, CLAUDE.md)
};

export type RunKind = "tailor" | "outreach" | "import";
export type RunStatus = "spawning" | "streaming" | "done" | "error" | "stopped";

/** A visible step in the UI ("Read the job description", "Self-check", "Revising — round 2"). */
export type Phase = { id: string; label: string; state: "todo" | "active" | "done" | "warn" | "error"; detail?: string };

export type Check = { id: string; label: string; ok: boolean; detail?: string; blocking?: boolean };

/** Normalised events the UI consumes (sent over SSE). */
export type RunEvent =
  | { type: "status"; status: RunStatus; at: number }
  | { type: "phase"; phase: Phase; at: number }
  | { type: "tool"; name: string; target?: string; at: number }
  | { type: "text"; text: string; at: number }
  | { type: "checks"; checks: Check[]; round: number; at: number }
  | { type: "result"; ok: boolean; text: string; costUsd?: number; durationMs?: number; at: number }
  | { type: "log"; text: string; at: number };

export type Run = {
  id: string;
  kind: RunKind;
  ref: string; // job slug / outreach slug / resume file
  status: RunStatus;
  startedAt: number;
  events: RunEvent[];
  listeners: Set<(e: RunEvent) => void>;
  sessionId?: string;
  child?: ChildProcess;
};

export type ExecResult = { ok: boolean; stopped: boolean; sessionId?: string; text: string; error?: string };

// Survive Next dev hot reloads.
const g = globalThis as unknown as { __tailorRuns?: Map<string, Run> };
const runs = (g.__tailorRuns ??= new Map());

export function getRun(id: string) {
  return runs.get(id);
}

const isActive = (r: Run) => r.status === "spawning" || r.status === "streaming";

export function activeRunFor(kind: RunKind, ref: string) {
  for (const r of runs.values()) if (r.kind === kind && r.ref === ref && isActive(r)) return r;
  return undefined;
}

export function anyActiveRun() {
  for (const r of runs.values()) if (isActive(r)) return r;
  return undefined;
}

export function emit(run: Run, e: RunEvent) {
  run.events.push(e);
  for (const l of run.listeners) l(e);
}

function setStatus(run: Run, status: RunStatus) {
  if (run.status === status) return;
  run.status = status;
  emit(run, { type: "status", status, at: Date.now() });
}

export function setPhase(run: Run, phase: Phase) {
  emit(run, { type: "phase", phase, at: Date.now() });
}

/** Create a run. It can execute several Claude turns (exec) before it is finished. */
export function createRun(kind: RunKind, ref: string): Run {
  const run: Run = { id: randomUUID(), kind, ref, status: "spawning", startedAt: Date.now(), events: [], listeners: new Set() };
  runs.set(run.id, run);
  emit(run, { type: "status", status: "spawning", at: Date.now() });
  return run;
}

export function finishRun(run: Run, ok: boolean) {
  if (run.status !== "stopped") setStatus(run, ok ? "done" : "error");
  // Keep finished runs around so late subscribers can replay them.
  setTimeout(() => runs.delete(run.id), 30 * 60 * 1000).unref?.();
}

export function stopRun(run: Run) {
  if (!isActive(run)) return;
  setStatus(run, "stopped");
  run.child?.kill();
}

/** Short, human target for a tool call, relative to ~/Tailor. */
function toolTarget(input: Record<string, unknown> | undefined): string | undefined {
  const p = (input?.file_path ?? input?.path ?? input?.pattern ?? input?.skill ?? input?.command) as string | undefined;
  if (!p || typeof p !== "string") return undefined;
  const relp = path.isAbsolute(p) ? path.relative(TAILOR_HOME, p) : p;
  return relp.replaceAll("\\", "/");
}

/**
 * Run one Claude Code turn inside `run`. Pass `resume` to continue the same conversation
 * (follow-ups, self-review fixes, answers to Claude's questions) — exactly like replying in Claude Code.
 */
export function exec(run: Run, prompt: string, opts: ClaudeConfig & { resume?: string; tools?: string[] } = {}): Promise<ExecResult> {
  if (run.status === "stopped") return Promise.resolve({ ok: false, stopped: true, text: "" });
  const tools = opts.tools ?? [...TOOLS, ...(opts.web ? WEB_TOOLS : [])];
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--tools", tools.join(","), // "" = no tools at all
    ...(tools.length ? ["--allowedTools", tools.join(",")] : []),
    "--permission-mode", "acceptEdits",
    "--permission-prompts", "none",
    "--strict-mcp-config",
    "--setting-sources", opts.loadUserSettings ? "user,project,local" : "project,local",
  ];
  if (opts.model) args.push("--model", opts.model);
  if (opts.effort) args.push("--effort", opts.effort);
  if (opts.fallbackModel) args.push("--fallback-model", opts.fallbackModel);
  if (opts.instructions?.trim()) args.push("--append-system-prompt", opts.instructions.trim());
  if (opts.resume) args.push("--resume", opts.resume);

  return new Promise((resolve) => {
    const child = spawn(/*turbopackIgnore: true*/ CLAUDE_BIN, args, { cwd: TAILOR_HOME, env: process.env, windowsHide: true });
    run.child = child;
    child.stdin.end(prompt); // over stdin: no shell quoting issues on any OS

    let buf = "";
    let stderr = "";
    let result: { ok: boolean; text: string } | null = null;
    let sessionId: string | undefined;

    const handleLine = (line: string) => {
      let msg: { type?: string; subtype?: string; session_id?: string; message?: { content?: unknown[] }; [k: string]: unknown };
      try {
        msg = JSON.parse(line);
      } catch {
        emit(run, { type: "log", text: line, at: Date.now() });
        return;
      }
      if (msg.type === "system" && msg.subtype === "init") {
        sessionId = msg.session_id;
        run.sessionId = sessionId;
        if (run.status === "spawning") setStatus(run, "streaming");
      }
      if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
        for (const block of msg.message.content as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[]) {
          if (block.type === "text" && block.text?.trim()) emit(run, { type: "text", text: block.text.trim(), at: Date.now() });
          if (block.type === "tool_use" && block.name) emit(run, { type: "tool", name: block.name, target: toolTarget(block.input), at: Date.now() });
        }
      }
      if (msg.type === "result") {
        result = { ok: !msg.is_error, text: String(msg.result ?? "") };
        emit(run, {
          type: "result",
          ok: result.ok,
          text: result.text,
          costUsd: typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : undefined,
          durationMs: typeof msg.duration_ms === "number" ? msg.duration_ms : undefined,
          at: Date.now(),
        });
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) handleLine(line);
      }
    });
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));

    let settled = false;
    const done = (r: ExecResult) => {
      if (settled) return;
      settled = true;
      run.child = undefined;
      resolve(r);
    };

    child.on("error", (err: NodeJS.ErrnoException) => {
      const error = err.code === "ENOENT" ? `Could not find the \`${CLAUDE_BIN}\` command. Is Claude Code installed and on your PATH?` : err.message;
      emit(run, { type: "log", text: error, at: Date.now() });
      done({ ok: false, stopped: false, text: "", error });
    });

    child.on("close", (code) => {
      if (buf.trim()) handleLine(buf.trim());
      if (run.status === "stopped") return done({ ok: false, stopped: true, sessionId, text: "" });
      const r = result as { ok: boolean; text: string } | null;
      const error = code !== 0 ? stderr.trim().slice(-2000) || `claude exited with code ${code}` : undefined;
      if (error) emit(run, { type: "log", text: error, at: Date.now() });
      done({ ok: code === 0 && !!r?.ok, stopped: false, sessionId, text: r?.text ?? "", error });
    });
  });
}

/** One quick question to Claude outside the run registry (e.g. pulling the company/title from a JD). */
export async function quickAsk(prompt: string, opts: ClaudeConfig & { tools?: string[] } = {}): Promise<ExecResult> {
  const scratch: Run = { id: randomUUID(), kind: "import", ref: "quick", status: "streaming", startedAt: Date.now(), events: [], listeners: new Set() };
  return exec(scratch, prompt, opts);
}

/** Subscribe to a run: replays past events, then streams new ones. Returns unsubscribe. */
export function subscribe(run: Run, fn: (e: RunEvent) => void) {
  for (const e of run.events) fn(e);
  run.listeners.add(fn);
  return () => run.listeners.delete(fn);
}

// ---------- detection ----------

export type ClaudeInfo = { found: boolean; version?: string; bin: string; error?: string };

let cached: { at: number; info: ClaudeInfo } | null = null;

export function detectClaude(): Promise<ClaudeInfo> {
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.info);
  return new Promise((resolve) => {
    execFile(/*turbopackIgnore: true*/ CLAUDE_BIN, ["--version"], { timeout: 15_000, windowsHide: true }, (err, stdout) => {
      const info: ClaudeInfo = err
        ? { found: false, bin: CLAUDE_BIN, error: (err as NodeJS.ErrnoException).code === "ENOENT" ? "not found on PATH" : err.message }
        : { found: true, bin: CLAUDE_BIN, version: stdout.trim().split(/\s+/)[0] };
      cached = { at: Date.now(), info };
      resolve(info);
    });
  });
}
