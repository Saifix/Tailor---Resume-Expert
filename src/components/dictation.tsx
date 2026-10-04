"use client";

import { AnimatePresence, motion } from "motion/react";
import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice dictation for every text field in the app, using the browser's built-in Web Speech API
 * (free, no install; Chrome sends audio to Google's speech service, Edge to Microsoft's).
 * A mic button follows whichever input/textarea has focus. Shortcut: Ctrl/⌘ + Shift + Space.
 */

type Field = HTMLInputElement | HTMLTextAreaElement;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const TEXT_TYPES = new Set(["text", "search", "url", "email", ""]);

function isDictatable(el: Element | null): el is Field {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLInputElement) return TEXT_TYPES.has(el.type) && !el.disabled && !el.readOnly;
  return false;
}

/** Set a value so React's onChange fires (controlled inputs ignore plain `el.value = …`). */
function setNativeValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Add right padding for the mic button; returns a function that restores the original padding. */
function reserveMicSpace(el: Field) {
  const prev = el.style.paddingRight;
  const base = parseFloat(getComputedStyle(el).paddingRight) || 0;
  if (base < 34) el.style.paddingRight = `${base + 34}px`;
  return () => {
    el.style.paddingRight = prev;
  };
}

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Dictation({ language }: { language?: string }) {
  const [supported, setSupported] = useState(false);
  const [field, setField] = useState<Field | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const session = useRef<{ el: Field; before: string; after: string; final: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature-detect after hydration
    setSupported(!!getRecognition());
  }, []);

  // Track the focused field — or the hovered one when nothing is focused — so every field offers the mic.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overButton = useRef(false);
  useEffect(() => {
    if (!supported) return;
    const cancelHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimer.current = setTimeout(() => {
        if (session.current || overButton.current) return;
        const active = document.activeElement;
        setField(isDictatable(active) ? active : null);
      }, 220);
    };
    const onFocus = (e: FocusEvent) => {
      if (isDictatable(e.target as Element)) {
        cancelHide();
        setField(e.target as Field);
      }
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element;
      if (session.current || !isDictatable(t)) return;
      if (isDictatable(document.activeElement) && document.activeElement !== t) return; // focus wins
      cancelHide();
      setField(t);
    };
    const onOut = (e: MouseEvent) => {
      if (isDictatable(e.target as Element) && document.activeElement !== e.target) scheduleHide();
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", scheduleHide);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      cancelHide();
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", scheduleHide);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, [supported]);

  // Make room for the mic so text never runs underneath it.
  useEffect(() => (field ? reserveMicSpace(field) : undefined), [field]);

  // Keep the button pinned to the field's right edge.
  useEffect(() => {
    if (!field) return;
    const place = () => {
      if (!field.isConnected) return setField(null);
      const r = field.getBoundingClientRect();
      const multi = field instanceof HTMLTextAreaElement;
      setPos({ top: multi ? r.bottom - 38 : r.top + r.height / 2 - 15, left: r.right - (multi ? 40 : 38) });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(field);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [field]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(
    (el: Field) => {
      const Recognition = getRecognition();
      if (!Recognition) return;
      setError(null);
      const r = new Recognition();
      r.lang = language || navigator.language || "en-US";
      r.continuous = true;
      r.interimResults = true;
      const caretStart = el.selectionStart ?? el.value.length;
      const caretEnd = el.selectionEnd ?? el.value.length;
      session.current = { el, before: el.value.slice(0, caretStart), after: el.value.slice(caretEnd), final: "" };

      r.onresult = (e) => {
        const s = session.current;
        if (!s) return;
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) s.final += res[0].transcript;
          else interim += res[0].transcript;
        }
        const spoken = (s.final + interim).trim();
        const gapBefore = s.before && !/\s$/.test(s.before) && spoken ? " " : "";
        const gapAfter = s.after && !/^\s/.test(s.after) && spoken ? " " : "";
        setNativeValue(s.el, s.before + gapBefore + spoken + gapAfter + s.after);
        const caret = (s.before + gapBefore + spoken).length;
        s.el.setSelectionRange?.(caret, caret);
      };
      r.onerror = (e) => {
        const msg: Record<string, string> = {
          "not-allowed": "Microphone blocked — allow it in the address bar",
          "no-speech": "Didn’t hear anything",
          network: "Speech service unreachable (needs internet)",
          "audio-capture": "No microphone found",
        };
        if (e.error !== "aborted") setError(msg[e.error] ?? `Dictation error: ${e.error}`);
      };
      r.onend = () => {
        session.current = null;
        rec.current = null;
        setListening(false);
        el.focus();
      };
      rec.current = r;
      r.start();
      setListening(true);
    },
    [language],
  );

  const toggle = useCallback(() => {
    if (listening) return stop();
    const el = field ?? (isDictatable(document.activeElement) ? document.activeElement : null);
    if (el) start(el);
  }, [field, listening, start, stop]);

  // Ctrl/⌘ + Shift + Space toggles dictation in the focused field; Esc stops.
  useEffect(() => {
    if (!supported) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && listening) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supported, toggle, listening, stop]);

  useEffect(() => () => rec.current?.abort(), []);

  if (!supported || !field || !pos) return null;

  return (
    <div
      className="no-print pointer-events-none fixed z-50"
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={() => (overButton.current = true)}
      onMouseLeave={() => (overButton.current = false)}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep focus (and the caret) in the field
        onClick={toggle}
        aria-label={listening ? "Stop dictation" : "Dictate"}
        title={listening ? "Stop dictation (Esc)" : "Dictate (Ctrl+Shift+Space)"}
        className={`pointer-events-auto relative grid size-[30px] place-items-center rounded-full transition-colors ${
          listening ? "bg-bad text-white shadow-e2" : "bg-surface text-ink-3 shadow-e1 ring-1 ring-line hover:text-accent"
        }`}
      >
        {listening && <span className="pulse-ring absolute inset-0 rounded-full bg-bad" />}
        {listening ? <Square className="relative size-3" fill="currentColor" strokeWidth={0} /> : <Mic className="size-4" strokeWidth={1.75} />}
      </button>
      <AnimatePresence>
        {(listening || error) && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`absolute right-0 top-9 whitespace-nowrap rounded-lg px-2 py-1 t-label-s shadow-e2 ${error ? "bg-bad-bg text-bad" : "bg-inverse text-ink-inverse"}`}
          >
            {error ?? "Listening… Esc to stop"}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
