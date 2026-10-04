"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Folder, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, cx } from "@/components/ui";
import { isLive, useRun } from "@/components/use-run";

export function Uploader({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const run = useRun(runId);

  useEffect(() => {
    if (run.status === "done" || run.status === "error") router.refresh();
  }, [run.status, router]);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/resumes", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setTarget(json.file);
      if (json.runId) setRunId(json.runId);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const converting = isLive(run.status);
  const lastText = [...run.events].reverse().find((e) => e.type === "text");

  return (
    <div
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) upload(f);
      }}
      className={cx(
        "relative flex items-center gap-5 overflow-hidden rounded-[20px] border-[1.5px] border-dashed px-7 transition-colors",
        compact ? "py-4" : "py-6",
        over ? "border-accent bg-accent-subtle" : "border-accent/50 bg-accent-subtle/60",
      )}
    >
      <motion.span animate={over ? { y: -3, scale: 1.05 } : { y: 0, scale: 1 }} className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface shadow-e2">
        <Upload className="size-6 text-accent" strokeWidth={1.75} />
      </motion.span>
      <div className="min-w-0 flex-1">
        {converting ? (
          <>
            <p className="t-h3 shimmer-text">Claude is reading your CV…</p>
            <p className="t-body-s truncate text-ink-2">{lastText && "text" in lastText ? lastText.text : `Writing resumes/${target}`}</p>
          </>
        ) : run.status === "done" ? (
          <>
            <p className="t-h3 text-ink">Added resumes/{target}</p>
            <p className="t-body-s text-ink-2">Check it below — it’s now available as a base resume.</p>
          </>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="t-h2 text-ink">Drop your CV here</span>
              {!compact && <span className="t-serif text-[28px] leading-8 text-ink-accent">— Claude turns it into clean Markdown.</span>}
            </p>
            <p className="t-body text-ink-2">PDF, Word, a photo/scan, Markdown or text · saved in your Tailor folder · never uploaded anywhere</p>
          </>
        )}
        {(error || run.status === "error") && <p className="mt-1 t-body-s text-bad">{error ?? run.error ?? "Conversion failed — try a PDF or paste it as .md"}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.md,.markdown,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" disabled={busy || converting} onClick={() => input.current?.click()}>
        <Folder strokeWidth={1.75} /> {busy ? "Uploading…" : "Browse files"}
      </Button>
    </div>
  );
}
