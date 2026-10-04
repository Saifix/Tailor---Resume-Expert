"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

/** Page enter: fade + 8px rise, children stagger 40ms. */
export function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } } }}
    >
      {children}
    </motion.div>
  );
}

/** Numbers count up on mount (600ms, out-expo). Keeps any suffix like "%". */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 0.6, ease });
    return () => c.stop();
  }, [inView, mv, value]);
  return <motion.span ref={ref}>{rounded}</motion.span>;
}

/** Sparkline that draws itself in. */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const w = 220;
  const h = 36;
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points.map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(h - 3 - (p / max) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--color-accent-default)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease, delay: 0.15 }}
      />
    </svg>
  );
}

/** Horizontal bar that grows to its width. */
export function GrowBar({ pct, className, delay = 0 }: { pct: number; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ width: 0 }}
      animate={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
      transition={{ duration: 0.7, ease, delay }}
    />
  );
}

export function GrowColumn({ pct, className, delay = 0 }: { pct: number; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ height: 0 }}
      animate={{ height: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
      transition={{ duration: 0.7, ease, delay }}
    />
  );
}
