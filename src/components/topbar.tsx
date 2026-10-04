import Link from "next/link";
import { Bell, Search } from "lucide-react";
import type { ReactNode } from "react";

export function TopBar({ eyebrow, title, actions, unread = 0 }: { eyebrow: ReactNode; title: ReactNode; actions?: ReactNode; unread?: number }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-[76px] shrink-0 items-center gap-3 border-b border-line-subtle bg-canvas/80 px-10 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <p className="t-overline truncate text-ink-3">{eyebrow}</p>
        <h1 className="t-h2 truncate text-ink">{title}</h1>
      </div>
      <form action="/jobs" className="relative hidden w-[280px] lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
        <input
          name="q"
          placeholder="Search jobs, companies…"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-3 t-body text-ink placeholder:text-ink-3 outline-none transition-shadow focus:border-accent focus:shadow-ring"
        />
      </form>
      <Link href="/reminders" className="relative grid size-10 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-subtle" aria-label="Reminders">
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-surface bg-accent" />}
      </Link>
      {actions}
    </header>
  );
}

export function PageBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-1 flex-col gap-6 px-10 pb-8 pt-7 ${className}`}>{children}</div>;
}
