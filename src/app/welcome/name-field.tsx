"use client";

import { useState } from "react";

export function NameField({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(!!initial);
  const save = async () => {
    if (!name.trim() || saved) return;
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: name.trim() }) });
    setSaved(true);
  };
  return (
    <label className="flex items-center gap-3 rounded-xl bg-subtle px-3.5 py-2.5">
      <span className="t-label text-ink-2">What should we call you?</span>
      <input
        value={name}
        onChange={(e) => (setName(e.target.value), setSaved(false))}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="Your first name"
        className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3"
      />
      {saved && name && <span className="t-label-s text-ok">Saved</span>}
    </label>
  );
}
