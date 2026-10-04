"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, ChevronDown, Download, Folder, RotateCw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { STATUS_LABEL, STATUSES, type Reminder, type Status } from "@/lib/types";
import { Button, cx, StatusBadge } from "@/components/ui";

async function patch(slug: string, body: unknown) {
  const res = await fetch(`/api/jobs/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
}

export function StatusMenu({ slug, status }: { slug: string; status: Status }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-full pr-1 hover:opacity-80" disabled={pending || status === "tailoring"}>
        <StatusBadge status={status} />
        <ChevronDown className="size-3.5 text-ink-3" strokeWidth={2} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-8 z-30 flex w-44 flex-col gap-0.5 rounded-2xl border border-line-subtle bg-raised p-1.5 shadow-e3"
          >
            {STATUSES.filter((s) => s !== "tailoring").map((s) => (
              <button
                key={s}
                onClick={() =>
                  start(async () => {
                    setOpen(false);
                    await patch(slug, { action: "status", status: s });
                    router.refresh();
                  })
                }
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 t-label-s text-ink hover:bg-subtle"
              >
                {STATUS_LABEL[s]}
                {s === status && <Check className="size-3.5 text-accent" strokeWidth={2} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HeaderActions({ slug, hasCover }: { slug: string; hasCover: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const docs = [
    { doc: "resume", label: "Resume" },
    ...(hasCover ? [{ doc: "cover", label: "Cover letter" }] : []),
  ];
  return (
    <div className="flex items-center gap-2.5">
      <Button variant="secondary" onClick={() => fetch(`/api/jobs/${slug}/open`, { method: "POST" })}>
        <Folder strokeWidth={1.75} /> Open folder
      </Button>
      <div className="relative">
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
          <Download strokeWidth={1.75} /> Download <ChevronDown className="!size-3.5 text-ink-3" strokeWidth={2} />
        </Button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              onMouseLeave={() => setOpen(false)}
              className="absolute right-0 top-12 z-30 flex w-56 flex-col gap-0.5 rounded-2xl border border-line-subtle bg-raised p-1.5 shadow-e3"
            >
              {docs.map((d) => (
                <div key={d.doc} className="flex flex-col">
                  <p className="px-2.5 pb-1 pt-1.5 t-overline text-ink-3">{d.label}</p>
                  {(["pdf", "docx"] as const).map((f) => (
                    <a
                      key={f}
                      href={`/api/jobs/${slug}/export?doc=${d.doc}&format=${f}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 t-label-s text-ink hover:bg-subtle"
                    >
                      {f === "pdf" ? "PDF" : "Word (.docx)"}
                      <span className="t-mono-s text-ink-3">.{f}</span>
                    </a>
                  ))}
                </div>
              ))}
              <div className="my-1 h-px bg-line-subtle" />
              <button onClick={() => (setOpen(false), window.open(`/print/${slug}`, "_blank"))} className="rounded-lg px-2.5 py-1.5 text-left t-label-s text-ink-2 hover:bg-subtle">
                Print…
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/jobs/${slug}/retailor`, { method: "POST" });
          const json = await res.json();
          router.push(`/tailor?job=${slug}&run=${json.runId}`);
        }}
      >
        <RotateCw strokeWidth={1.75} /> Re-tailor
      </Button>
    </div>
  );
}

const PRESETS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

export function Reminders({ slug, reminders, company }: { slug: string; reminders: Reminder[]; company: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(`Follow up with ${company}`);
  const [custom, setCustom] = useState("");

  const add = (at: Date) =>
    start(async () => {
      await patch(slug, { action: "addReminder", at: at.toISOString(), title: title.trim() || `Follow up with ${company}` });
      setCustom("");
      router.refresh();
    });

  const inDays = (d: number) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    t.setHours(9, 0, 0, 0);
    return t;
  };

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2.5">
        <Bell className="size-[18px] text-accent" strokeWidth={1.75} />
        <h2 className="t-h3 flex-1 text-ink">Reminders</h2>
      </div>
      {reminders.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5">
          <button
            onClick={() => start(async () => (await patch(slug, { action: "toggleReminder", id: r.id }), router.refresh()))}
            className={cx("grid size-[18px] shrink-0 place-items-center rounded-md border", r.done ? "border-accent bg-accent" : "border-line-strong")}
            aria-label={r.done ? "Mark as not done" : "Mark as done"}
          >
            {r.done && <Check className="size-3 text-on-accent" strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={cx("t-label-s truncate", r.done ? "text-ink-3 line-through" : "text-ink")}>{r.title}</p>
            <p className="t-mono-s text-ink-3">{new Date(r.at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <button
            onClick={() => start(async () => (await patch(slug, { action: "deleteReminder", id: r.id }), router.refresh()))}
            className="text-ink-3 hover:text-bad"
            aria-label="Delete reminder"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 rounded-lg border border-line bg-surface px-3 t-body-s text-ink outline-none focus:border-accent focus:shadow-ring"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.label} disabled={pending} onClick={() => add(inDays(p.days))} className="rounded-full bg-subtle px-2.5 py-1 t-label-s text-ink-2 hover:bg-accent-subtle hover:text-ink-accent">
            in {p.label}
          </button>
        ))}
        <input
          type="datetime-local"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="h-7 rounded-full bg-subtle px-2.5 t-label-s text-ink-2 outline-none"
        />
        {custom && (
          <button disabled={pending} onClick={() => add(new Date(custom))} className="rounded-full bg-accent px-2.5 py-1 t-label-s text-on-accent">
            Add
          </button>
        )}
      </div>
    </section>
  );
}

export function NotesEditor({ slug, initial }: { slug: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-1 flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => (setText(e.target.value), setSaved(false))}
        placeholder="Interview notes, recruiter names, salary talks… (saved to notes.md)"
        className="min-h-[420px] flex-1 resize-none rounded-2xl border border-line bg-surface p-5 t-body text-ink outline-none focus:border-accent focus:shadow-ring"
      />
      <div className="flex items-center gap-3">
        <Button size="s" disabled={saved || pending} onClick={() => start(async () => (await patch(slug, { action: "notes", text }), setSaved(true)))}>
          {saved ? "Saved" : "Save notes"}
        </Button>
        <span className="t-mono-s text-ink-3">notes.md</span>
      </div>
    </div>
  );
}
