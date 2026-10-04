"use client";

import { useEffect, useState } from "react";

export type StatusPayload = {
  claude: { found: boolean; version?: string; bin: string; error?: string };
  home: string;
  active: { id: string; kind: string; ref: string } | null;
};

/** Polls /api/status — fast while a run is active, slow otherwise. */
export function useClaudeStatus() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const json = (await res.json()) as StatusPayload;
        if (alive) setStatus(json);
        timer = setTimeout(tick, json.active ? 3000 : 20000);
      } catch {
        timer = setTimeout(tick, 10000);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return status;
}
