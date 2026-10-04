import type { Metadata } from "next";
import { ArrowUpRight, Check } from "lucide-react";
import { NameField } from "./name-field";
import { Dictation } from "@/components/dictation";
import { Uploader } from "@/app/(app)/resumes/uploader";
import { ButtonLink, cx, Logo, LogoMark } from "@/components/ui";
import { detectClaude } from "@/lib/claude";
import { fresh } from "@/lib/data";
import { displayPath, TAILOR_HOME } from "@/lib/paths";
import { getSettings, listResumes, listSkills } from "@/lib/store";

export const metadata: Metadata = { title: "Welcome" };

export default async function Welcome() {
  await fresh();
  const [claude, skills, resumes, settings] = await Promise.all([detectClaude(), listSkills(), listResumes(), getSettings()]);
  const checks = [
    {
      ok: claude.found,
      title: claude.found ? "Claude Code found" : "Claude Code not found",
      detail: claude.found ? `claude ${claude.version} · on your PATH` : "Install it from claude.com/claude-code, run `claude` once to sign in, then reload.",
      mono: claude.found,
    },
    { ok: claude.found, title: "Runs on your Claude plan", detail: "No API key — headless runs use the login Claude Code already has.", mono: false },
    { ok: true, title: "Data folder ready", detail: displayPath(TAILOR_HOME), mono: true },
    { ok: skills.length > 0, title: `${skills.length} skills installed`, detail: skills.map((s) => s.name).join(" · "), mono: false },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute -left-40 -top-56 size-[720px] rounded-full bg-iris-300/50 blur-[180px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 size-[640px] rounded-full bg-[#3a8dff]/25 blur-[180px]" />
      <div className="absolute left-10 top-8">
        <Logo />
      </div>
      <main className="relative mx-auto flex max-w-[640px] flex-col gap-5 px-4 py-24">
        <section className="flex flex-col gap-[22px] rounded-[28px] border border-white/70 bg-surface/90 px-10 pb-8 pt-10 shadow-e3 backdrop-blur-2xl">
          <LogoMark size={56} />
          <div>
            <h1 className="t-h1 text-ink">Welcome to Tailor</h1>
            <p className="t-serif text-[28px] leading-8 text-ink-accent">let’s get you set up.</p>
          </div>
          <p className="t-body text-ink-2">
            Tailor is a local app. It talks to the Claude Code already installed on this computer — so it runs on your Claude plan, and your files never
            leave this machine.
          </p>
          <ul className="overflow-hidden rounded-2xl border border-line-subtle bg-surface">
            {checks.map((c) => (
              <li key={c.title} className="flex items-center gap-3.5 border-b border-line-subtle px-4 py-3.5 last:border-b-0">
                <span className={cx("grid size-[26px] shrink-0 place-items-center rounded-full", c.ok ? "bg-ok-bg" : "bg-bad-bg")}>
                  {c.ok ? <Check className="size-3.5 text-ok" strokeWidth={2.5} /> : <span className="t-label-s text-bad">!</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block t-label text-ink">{c.title}</span>
                  <span className={cx("block truncate text-ink-3", c.mono ? "t-mono-s" : "t-body-s")}>{c.detail}</span>
                </span>
                {c.ok && c.title.startsWith("Claude Code") && <span className="rounded-full bg-ok-bg px-2.5 py-[3px] t-label-s text-ok">Connected</span>}
              </li>
            ))}
          </ul>
          <NameField initial={settings.userName} />
          {resumes.length ? (
            <p className="flex items-center gap-2 t-body-s text-ok">
              <Check className="size-4" strokeWidth={2.5} /> {resumes.length} base resume{resumes.length > 1 ? "s" : ""} ready
            </p>
          ) : (
            <Uploader compact />
          )}
          <div className="flex items-center gap-3.5">
            <ButtonLink href="/">
              <ArrowUpRight strokeWidth={1.75} /> Open dashboard
            </ButtonLink>
            {!resumes.length && <span className="t-body-s text-ink-3">You can add your CV later.</span>}
          </div>
        </section>

        <section data-theme="dark" className="overflow-hidden rounded-[18px] border border-neutral-700 bg-neutral-900 shadow-e3">
          <div className="flex items-center gap-[7px] border-b border-neutral-800 px-3.5 py-[11px]">
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
            ))}
            <span className="flex-1 text-center t-label-s text-neutral-500">Prefer the terminal? Three ways to use it</span>
          </div>
          <div className="flex flex-col gap-2 px-[18px] pb-4 pt-3.5 t-mono">
            {[
              ["npm run dev", "# UI on http://127.0.0.1:4317"],
              ["cd ~/Tailor && claude", "# or just talk to Claude Code directly"],
              ["npm run tailor -- ./jd.md", "# CLI only → jobs/<slug>/resume.md"],
            ].map(([cmd, c]) => (
              <div key={cmd} className="flex gap-2.5">
                <span className="text-iris-300">$</span>
                <span className="w-[230px] text-neutral-100">{cmd}</span>
                <span className="text-neutral-500">{c}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Dictation language={settings.dictation?.language} />
    </div>
  );
}
