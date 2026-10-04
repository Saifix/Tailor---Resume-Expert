#!/usr/bin/env node
// Tailor from the terminal. Talks to the local Tailor server (npm run dev).
//
//   npm run tailor -- ./jd.md --company Vercel --role "Senior Frontend Engineer"
//   pbpaste | npm run tailor -- - --company Linear
//
// Options: --company, --role, --url, --resume <file in resumes/>, --skills a,b,c, --port 4317
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    company: { type: "string", default: "" },
    role: { type: "string", default: "" },
    url: { type: "string" },
    resume: { type: "string" },
    skills: { type: "string", default: "ats-keywords,impact-bullets,one-page,match-report" },
    port: { type: "string", default: process.env.TAILOR_PORT ?? "4317" },
    help: { type: "boolean", short: "h" },
  },
});

const c = { yellow: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, iris: (s) => `\x1b[38;5;99m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

if (values.help || !positionals[0]) {
  console.log(`\n  ${c.bold("tailor")} ${c.dim("— tailor your resume to a job from the terminal")}\n
  npm run tailor -- <jd.md | -> [--company X] [--role Y] [--url U] [--resume master.md] [--skills a,b]\n
  Reads the job description from a file (or stdin with "-"), runs your local Claude Code
  through the Tailor server, and writes everything to ~/Tailor/jobs/<slug>/.\n`);
  process.exit(values.help ? 0 : 1);
}

const base = `http://127.0.0.1:${values.port}`;
const jd = positionals[0] === "-" ? readFileSync(0, "utf8") : readFileSync(positionals[0], "utf8");

let res;
try {
  res = await fetch(`${base}/api/tailor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: values.company, role: values.role, url: values.url, jd, baseResume: values.resume, skills: values.skills.split(",").map((s) => s.trim()).filter(Boolean) }),
  });
} catch {
  console.error(c.red(`\n  Can't reach Tailor on ${base}. Start it first:  npm run dev\n`));
  process.exit(1);
}
const start = await res.json();
if (!res.ok) {
  console.error(c.red(`\n  ${start.error}\n`));
  process.exit(1);
}

console.log(`\n  ${c.iris("●")} Tailoring ${c.bold(values.company || "job")} ${c.dim(`→ jobs/${start.slug}/`)}\n`);
const t0 = Date.now();
const stream = await fetch(`${base}/api/runs/${start.runId}/stream`);
const decoder = new TextDecoder();
let buf = "";
let status = "streaming";
for await (const chunk of stream.body) {
  buf += decoder.decode(chunk, { stream: true });
  let i;
  while ((i = buf.indexOf("\n\n")) >= 0) {
    const block = buf.slice(0, i);
    buf = buf.slice(i + 2);
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line || block.startsWith("event: meta")) continue;
    const e = JSON.parse(line.slice(6));
    const secs = c.dim(`${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s`);
    if (e.type === "tool") console.log(`  ${secs}  ${c.dim(`${e.name.padEnd(6)} ${e.target ?? ""}`)}`);
    if (e.type === "phase" && e.phase.state !== "todo") {
      const icon = { active: c.iris("›"), done: c.green("✓"), warn: c.yellow("!"), error: c.red("✗") }[e.phase.state];
      console.log(`  ${secs}  ${icon} ${e.phase.label}${e.phase.detail ? c.dim(` — ${e.phase.detail}`) : ""}`);
    }
    if (e.type === "checks")
      for (const k of e.checks) if (!k.ok) console.log(`         ${k.blocking ? c.red("✗") : c.yellow("!")} ${k.label}${k.detail ? c.dim(` — ${k.detail}`) : ""}`);
    if (e.type === "log") console.log(`  ${secs}  ${c.red(e.text)}`);
    if (e.type === "status") status = e.status;
  }
}

const job = await (await fetch(`${base}/api/jobs/${start.slug}`)).json();
if (status === "done" && job.job?.match) {
  const m = job.job.match;
  console.log(`\n  ${c.green("✓")} Match ${m.before}% → ${c.bold(c.green(`${m.after}%`))}  ${c.dim(job.job.summary ?? "")}`);
  const qs = job.job.questions ?? [];
  if (qs.length) {
    console.log(`\n  ${c.iris("?")} Claude has ${qs.length} question${qs.length > 1 ? "s" : ""} — answer them in the app to strengthen the resume:`);
    for (const q of qs) console.log(`    • ${q.question}`);
  }
  console.log(`\n  ${c.dim("Open:")} ${base}/jobs/${start.slug}`);
  console.log(`  ${c.dim("Word:")} ${base}/api/jobs/${start.slug}/export?format=docx`);
  console.log(`  ${c.dim("PDF: ")} ${base}/api/jobs/${start.slug}/export?format=pdf\n`);
} else {
  console.log(`\n  ${c.red("✗")} ${job.job?.lastError ?? `Run ended: ${status}`}\n`);
  process.exit(1);
}
