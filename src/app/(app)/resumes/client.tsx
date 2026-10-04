"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { cx } from "@/components/ui";
import type { SkillInfo } from "@/lib/store";

export function SkillToggles({ skills }: { skills: SkillInfo[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [list, toggle] = useOptimistic(skills, (cur, name: string) => cur.map((s) => (s.name === name ? { ...s, enabled: !s.enabled } : s)));
  return (
    <>
      {list.map((s) => (
        <div key={s.name} className="flex items-center gap-3 px-1.5 py-[7px]">
          <span className={cx("w-[150px] shrink-0 t-mono", s.enabled ? "text-ink" : "text-ink-3")}>{s.name}</span>
          <span className="flex-1 t-body-s text-ink-2">{s.description}</span>
          <button
            role="switch"
            aria-checked={s.enabled}
            aria-label={`Toggle ${s.name}`}
            disabled={s.name === "resume-tailor"}
            onClick={() =>
              start(async () => {
                toggle(s.name);
                const disabled = list.filter((x) => (x.name === s.name ? x.enabled : !x.enabled)).map((x) => x.name);
                await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disabledSkills: disabled }) });
                router.refresh();
              })
            }
            className={cx("relative h-5 w-8 shrink-0 rounded-full transition-colors disabled:opacity-50", s.enabled ? "bg-accent" : "bg-line-strong")}
          >
            <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] duration-200", s.enabled ? "left-3.5" : "left-0.5")} />
          </button>
        </div>
      ))}
    </>
  );
}

export function MakeDefault({ file }: { file: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          await fetch("/api/resumes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultResume: file }) });
          router.refresh();
        });
      }}
      className="t-label-s text-ink-accent hover:underline"
    >
      Make default
    </button>
  );
}
