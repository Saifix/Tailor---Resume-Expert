"use client";

import { useEffect, useRef, useState } from "react";
import type { RunEvent, RunStatus } from "@/lib/claude";

export type RunState = {
  status: RunStatus | "idle" | "missing";
  events: RunEvent[];
  startedAt?: number;
  result?: Extract<RunEvent, { type: "result" }>;
  error?: string;
};

/** Subscribe to a Claude run over SSE. Replays everything the run has done so far. */
export function useRun(runId: string | null | undefined): RunState {
  const [state, setState] = useState<RunState>({ status: "idle", events: [] });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when switching runs
    setState({ status: "spawning", events: [] });
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;
    es.addEventListener("meta", (m) => {
      const meta = JSON.parse((m as MessageEvent).data) as { startedAt: number };
      setState((s) => ({ ...s, startedAt: meta.startedAt }));
    });
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as RunEvent;
      setState((s) => {
        const next: RunState = { ...s, events: [...s.events, e] };
        if (e.type === "status") next.status = e.status;
        if (e.type === "result") next.result = e;
        if (e.type === "log") next.error = e.text;
        return next;
      });
      if (e.type === "status" && (e.status === "done" || e.status === "error" || e.status === "stopped")) es.close();
    };
    es.onerror = () => {
      // 404 (finished long ago / server restarted) or network drop
      setState((s) => (s.status === "spawning" && !s.events.length ? { ...s, status: "missing" } : s));
      es.close();
    };
    return () => es.close();
  }, [runId]);

  return state;
}

export const isLive = (s: RunState["status"]) => s === "spawning" || s === "streaming";

export function useElapsed(startedAt: number | undefined, live: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export async function stopRun(runId: string) {
  await fetch(`/api/runs/${runId}/stop`, { method: "POST" });
}
