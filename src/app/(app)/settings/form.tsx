"use client";

import { useRouter } from "next/navigation";
import { Globe, Mic, PenLine, Settings2, Sparkles } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Button, cx } from "@/components/ui";

export type ClaudeSettings = {
  model?: string;
  effort?: string;
  fallbackModel?: string;
  web?: boolean;
  humanVoice?: boolean;
  instructions?: string;
  loadUserSettings?: boolean;
};

export const MODELS = [
  { id: "", label: "Default", hint: "Whatever your Claude Code uses" },
  { id: "fable", label: "Fable", hint: "Newest flagship" },
  { id: "opus", label: "Opus", hint: "Most careful writing" },
  { id: "sonnet", label: "Sonnet", hint: "Fast and strong — recommended" },
  { id: "haiku", label: "Haiku", hint: "Quickest, least careful" },
];

export const EFFORT_OPTIONS = [
  { id: "", label: "Default" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra high" },
  { id: "max", label: "Max" },
];

export const DICTATION_LANGUAGES = [
  { id: "", label: "Browser default" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "en-IN", label: "English (India)" },
  { id: "ur-PK", label: "Urdu (Pakistan)" },
  { id: "hi-IN", label: "Hindi (India)" },
  { id: "ar-SA", label: "Arabic" },
  { id: "de-DE", label: "German" },
  { id: "fr-FR", label: "French" },
  { id: "es-ES", label: "Spanish" },
];

export function SettingsForm({ userName, claude, dictationLanguage = "" }: { userName: string; claude: ClaudeSettings; dictationLanguage?: string }) {
  const router = useRouter();
  const [name, setName] = useState(userName);
  const [lang, setLang] = useState(dictationLanguage);
  const [c, setC] = useState<ClaudeSettings>({ web: true, humanVoice: true, loadUserSettings: false, ...claude });
  const [custom, setCustom] = useState(!!claude.model && !MODELS.some((m) => m.id === claude.model));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<ClaudeSettings>) => {
    setC((cur) => ({ ...cur, ...patch }));
    setSaved(false);
  };

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName: name.trim(), claude: c, dictation: { language: lang } }),
          });
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="t-label text-ink">Your name</span>
        <input
          value={name}
          onChange={(e) => (setName(e.target.value), setSaved(false))}
          placeholder="Used for the greeting"
          className="h-10 rounded-xl border border-line bg-surface px-3 t-body text-ink outline-none focus:border-accent focus:shadow-ring"
        />
      </label>

      <Section icon={Sparkles} title="Model" hint={<>Passed as <code className="t-mono-s">--model</code>. Runs always use your own Claude Code login.</>}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {MODELS.map((m) => (
            <Choice key={m.id || "default"} on={!custom && (c.model ?? "") === m.id} onClick={() => (setCustom(false), set({ model: m.id }))} title={m.label} hint={m.hint} />
          ))}
          <Choice on={custom} onClick={() => setCustom(true)} title="Custom…" hint="A full model ID" />
        </div>
        {custom && (
          <input
            value={c.model ?? ""}
            onChange={(e) => set({ model: e.target.value })}
            placeholder="e.g. claude-sonnet-5-5"
            className="h-10 rounded-xl border border-line bg-surface px-3 t-mono text-ink outline-none focus:border-accent focus:shadow-ring"
          />
        )}
      </Section>

      <Section icon={Settings2} title="Effort" hint={<>How hard Claude thinks (<code className="t-mono-s">--effort</code>). Higher is slower but more careful — worth it for important applications.</>}>
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {EFFORT_OPTIONS.map((o) => (
            <button
              type="button"
              key={o.id || "default"}
              onClick={() => set({ effort: o.id })}
              className={cx("flex-1 rounded-lg px-3 py-1.5 t-label-s", (c.effort ?? "") === o.id ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:text-ink")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3">
          <span className="w-32 t-body-s text-ink-2">Fallback model</span>
          <select
            value={c.fallbackModel ?? ""}
            onChange={(e) => set({ fallbackModel: e.target.value })}
            className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 t-body-s text-ink outline-none focus:border-accent"
          >
            <option value="">None</option>
            {MODELS.filter((m) => m.id).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — used if the main model is overloaded
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section icon={Globe} title="Abilities">
        <Toggle
          on={!!c.web}
          onChange={(web) => set({ web })}
          title="Search the web"
          hint="Research the company, read job links, and suggest current learning resources for your gaps (WebSearch + WebFetch). Web pages can contain misleading text — Claude still only writes inside ~/Tailor."
        />
        <Toggle
          on={!!c.humanVoice}
          onChange={(humanVoice) => set({ humanVoice })}
          title="Write like a person"
          hint="Plain, specific wording without stock AI phrases. Tailor checks letters and messages and has Claude rewrite anything that sounds generated."
        />
        <Toggle
          on={!!c.loadUserSettings}
          onChange={(loadUserSettings) => set({ loadUserSettings })}
          title="Use my Claude Code settings"
          hint="Also load ~/.claude settings, hooks and CLAUDE.md. Off keeps runs predictable."
        />
      </Section>

      <Section icon={PenLine} title="Always tell Claude…" hint={<>Added to every run (<code className="t-mono-s">--append-system-prompt</code>).</>}>
        <textarea
          value={c.instructions ?? ""}
          onChange={(e) => set({ instructions: e.target.value })}
          rows={4}
          placeholder={"e.g. Use UK spelling. I'm targeting staff-level roles in fintech. Never mention my current employer by name in outreach."}
          className="resize-y rounded-xl border border-line bg-surface px-3.5 py-3 t-body-s text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:shadow-ring"
        />
      </Section>

      <Section
        icon={Mic}
        title="Voice dictation"
        hint={
          <>
            A mic appears in every text field (or press <kbd className="t-mono-s">Ctrl+Shift+Space</kbd>). Uses your browser’s built-in speech recognition — free, but the audio goes
            to Google (Chrome) or Microsoft (Edge). Not available in Firefox.
          </>
        }
      >
        <label className="flex items-center gap-3">
          <span className="w-32 t-body-s text-ink-2">Language</span>
          <select
            value={lang}
            onChange={(e) => (setLang(e.target.value), setSaved(false))}
            className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 t-body-s text-ink outline-none focus:border-accent"
          >
            {DICTATION_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {saved ? "Saved" : "Save settings"}
        </Button>
        <span className="t-body-s text-ink-3">You can also override model and effort per run on the New tailoring page.</span>
      </div>
    </form>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: typeof Globe; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 t-h3 text-ink">
          <Icon className="size-[18px] text-accent" strokeWidth={1.75} /> {title}
        </h2>
        {hint && <p className="mt-0.5 t-body-s text-ink-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice({ on, onClick, title, hint }: { on: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("flex flex-col items-start rounded-xl px-3 py-2.5 text-left transition-colors", on ? "bg-accent-subtle ring-1 ring-accent/40" : "bg-subtle hover:bg-muted")}
    >
      <span className="t-label text-ink">{title}</span>
      <span className="t-body-s text-ink-3">{hint}</span>
    </button>
  );
}

function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-subtle px-3.5 py-3">
      <div className="flex-1">
        <p className="t-label text-ink">{title}</p>
        <p className="t-body-s text-ink-3">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={cx("relative mt-0.5 h-5 w-8 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-line-strong")}
      >
        <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] duration-200", on ? "left-3.5" : "left-0.5")} />
      </button>
    </div>
  );
}
