"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Bell, Briefcase, FileText, Folder, LayoutGrid, Moon, Send, Sparkles, Sun, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { cx, Logo } from "./ui";
import { useClaudeStatus } from "./claude-status";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, key: null },
  { href: "/tailor", label: "New tailoring", icon: Sparkles, key: null },
  { href: "/jobs", label: "Applications", icon: Briefcase, key: "jobs" },
  { href: "/resumes", label: "Resumes", icon: FileText, key: "resumes" },
  { href: "/outreach", label: "Outreach", icon: Send, key: null },
  { href: "/reminders", label: "Reminders", icon: Bell, key: "reminders" },
] as const;

export type SidebarCounts = { jobs: number; resumes: number; reminders: number };

export function Sidebar({ counts, home, userName }: { counts: SidebarCounts; home: string; userName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <aside className="no-print sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col border-r border-line-subtle bg-subtle px-4 pb-4 pt-5">
      <Link href="/" className="mb-5 px-2">
        <Logo />
      </Link>
      <p className="t-overline px-3 pb-1.5 pt-3 text-ink-3">Workspace</p>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, key }) => {
          const active = isActive(href);
          const count = key ? counts[key] : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cx("group relative flex h-9 items-center gap-2.5 rounded-xl px-3 t-label transition-colors", active ? "text-ink" : "text-ink-2 hover:text-ink")}
            >
              {active && (
                <motion.span
                  layoutId="nav-chip"
                  className="absolute inset-0 rounded-xl bg-surface shadow-e1"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={cx("relative size-5", active ? "text-accent" : "text-ink-2 group-hover:text-ink")} strokeWidth={1.75} />
              <span className="relative flex-1">{label}</span>
              {count > 0 && <span className="relative t-mono-s text-ink-3">{count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <p className="t-overline px-3 pb-1.5 pt-3 text-ink-3">Local</p>
      <div className="flex min-w-0 items-center gap-2 px-3 pb-2.5 pt-1.5" title={`All your data lives in ${home}`}>
        <Folder className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
        <span className="t-mono truncate text-ink-2">{home}</span>
      </div>
      <div className="px-1 pb-3">
        <ClaudeChip />
      </div>
      <div className="h-px bg-line-subtle" />
      <div className="flex items-center gap-2.5 px-2 pt-3">
        <span className="grid size-[30px] place-items-center rounded-full bg-[linear-gradient(135deg,#aba4ff,#3a8dff)] t-label-s text-white">
          {(userName || "You").charAt(0).toUpperCase()}
        </span>
        <Link href="/settings" className="min-w-0 flex-1">
          <p className="t-label truncate text-ink">{userName || "You"}</p>
          <p className="t-body-s text-ink-3">Settings</p>
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function ClaudeChip() {
  const status = useClaudeStatus();
  const state = !status ? "checking" : !status.claude.found ? "offline" : status.active ? "working" : "connected";
  const label = {
    checking: "Checking Claude Code…",
    connected: `Claude Code · connected`,
    working: "Claude is working…",
    offline: "Claude Code not found",
  }[state];
  const dot = { checking: "bg-ink-3", connected: "bg-ok", working: "bg-accent", offline: "bg-bad" }[state];
  return (
    <Link
      href={status?.active ? activeHref(status.active) : "/welcome"}
      className="flex w-fit items-center gap-2 rounded-full border border-line-subtle bg-surface py-1.5 pl-2.5 pr-3 shadow-e1"
      title={status?.claude.version ? `claude ${status.claude.version}` : undefined}
    >
      <span className="relative grid size-3.5 place-items-center">
        {(state === "connected" || state === "working") && <span className={cx("pulse-ring absolute inset-0 rounded-full", dot)} />}
        <span className={cx("relative size-1.5 rounded-full", dot)} />
      </span>
      <span className="t-label-s whitespace-nowrap text-ink">{label}</span>
      <SquareTerminal className="size-3.5 text-ink-3" strokeWidth={1.75} />
    </Link>
  );
}

function activeHref(a: { kind: string; ref: string; id: string }) {
  if (a.kind === "tailor") return `/tailor?job=${a.ref}&run=${a.id}`;
  if (a.kind === "outreach") return `/outreach?item=${a.ref}&run=${a.id}`;
  return "/resumes";
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read theme once after hydration
    setDark(t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("tailor-theme", next ? "dark" : "light");
    } catch {}
  };
  const Icon = dark ? Sun : Moon;
  return (
    <button onClick={toggle} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-muted hover:text-ink" aria-label="Toggle dark mode">
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}
