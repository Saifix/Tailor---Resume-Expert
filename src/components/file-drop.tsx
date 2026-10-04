"use client";

import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { cx } from "./ui";

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp,.md,.markdown,.txt";
const MAX = 10 * 1024 * 1024;

/** Multi-file picker with drag & drop. Files stay in the browser until the form is submitted. */
export function FileDrop({
  files,
  onChange,
  hint,
  disabled,
  compact = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    const bad: string[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPT.split(",").includes(ext)) bad.push(`${f.name} (type)`);
      else if (f.size > MAX) bad.push(`${f.name} (over 10 MB)`);
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) ok.push(f);
    }
    setError(bad.length ? `Skipped: ${bad.join(", ")}` : null);
    if (ok.length) onChange([...files, ...ok].slice(0, 12));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && input.current?.click()}
        className={cx(
          "flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed px-3.5 transition-colors",
          compact ? "py-2.5" : "py-3.5",
          over ? "border-accent bg-accent-subtle" : "border-line hover:border-accent/50 hover:bg-subtle",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Paperclip className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block t-label-s text-ink">Attach documents</span>
          <span className="block t-body-s text-ink-3">{hint ?? "PDF, Word, images or text · up to 10 MB each"}</span>
        </span>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      </div>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={f.name + i} className="flex items-center gap-2 rounded-lg bg-subtle px-2.5 py-1.5">
              {/\.(png|jpe?g|webp)$/i.test(f.name) ? <ImageIcon className="size-3.5 text-ink-3" strokeWidth={1.75} /> : <FileText className="size-3.5 text-ink-3" strokeWidth={1.75} />}
              <span className="flex-1 truncate t-mono-s text-ink">{f.name}</span>
              <span className="t-body-s text-ink-3">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" disabled={disabled} onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-ink-3 hover:text-bad" aria-label={`Remove ${f.name}`}>
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="t-body-s text-warn">{error}</p>}
    </div>
  );
}
