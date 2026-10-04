import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_LABEL, type Status } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnStyle = "primary" | "secondary" | "ghost";
type BtnSize = "m" | "s";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap select-none transition-[background,box-shadow,transform,color] duration-[140ms] ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";
const btnStyles: Record<BtnStyle, string> = {
  primary: "bg-accent text-on-accent shadow-glow hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line hover:bg-subtle",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink",
};
const btnSizes: Record<BtnSize, string> = {
  m: "h-10 px-4 t-label [&_svg]:size-[18px]",
  s: "h-8 px-3 t-label-s [&_svg]:size-4",
};

export function buttonClass(style: BtnStyle = "primary", size: BtnSize = "m", extra?: string) {
  return cx(btnBase, btnStyles[style], btnSizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "m",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: BtnStyle; size?: BtnSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "m",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnStyle; size?: BtnSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const statusTone: Record<Status, string> = {
  draft: "bg-muted text-ink-2",
  tailoring: "bg-warn-bg text-warn",
  applied: "bg-info-bg text-info",
  interview: "bg-accent-subtle text-ink-accent",
  offer: "bg-ok-bg text-ok",
  rejected: "bg-bad-bg text-bad",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] t-label-s", statusTone[status], className)}>
      <span className={cx("size-1.5 rounded-full bg-current", status === "tailoring" && "animate-pulse")} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("card", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-3", className)}>
      <h2 className="t-h3 text-ink">{title}</h2>
      {aside && <div className="t-label-s text-ink-3">{aside}</div>}
    </div>
  );
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx("relative inline-grid shrink-0 place-items-center overflow-hidden", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: "linear-gradient(135deg, #aba4ff 0%, #6e62f7 55%, #4a3dc4 100%)",
      }}
      aria-hidden
    >
      <span className="t-serif text-white" style={{ fontSize: size * 0.8, lineHeight: 1, marginTop: -size * 0.04 }}>
        t
      </span>
      <span className="absolute rounded-full bg-white/90" style={{ width: size * 0.15, height: size * 0.15, left: size * 0.67, top: size * 0.22 }} />
    </span>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={32} />
      <span className="t-h2 text-ink">Tailor</span>
    </span>
  );
}

export function MatchRing({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const tone = value >= 85 ? "text-ok" : value >= 70 ? "text-warn" : "text-bad";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cx("-rotate-90 shrink-0", tone, className)} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={2.5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} strokeLinecap="round" />
    </svg>
  );
}

export function CompanyTile({ name, size = 36, accent, className }: { name: string; size?: number; accent?: boolean; className?: string }) {
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-[10px] t-label", accent ? "bg-accent text-on-accent" : "bg-muted text-ink", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function Empty({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="t-serif text-[28px] leading-8 text-ink-accent">{title}</p>
      {children && <p className="t-body-s max-w-sm text-ink-3">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function relDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0 && d.toDateString() === new Date().toDateString()) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
