import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { norm } from "@/lib/diff";

type HastNode = { type: string; value?: string; children?: HastNode[] };
const textOf = (n: HastNode): string => (n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(textOf).join(""));

/** `### Title — Company · Mon YYYY – Mon YYYY` (the heading shape the skills write) → its three parts. */
export const ROLE_LINE = /^(.+?) — (.+?) · (.+)$/;

/**
 * Resume Markdown is line-oriented (one Skills category per line). Give consecutive text lines hard
 * breaks so Markdown doesn't merge them into one paragraph.
 */
const TEXT_LINE = String.raw`(?!\s*(?:[-*+]\s|#|>|\||$))`;
const hardBreaks = (md: string) => md.replace(/\r\n/g, "\n").replace(new RegExp(`^(${TEXT_LINE}[^\n]+)\n(?=${TEXT_LINE}[^\n]+)`, "gm"), "$1  \n");

/** Resume renderer — highlights bullets that tailoring changed. */
export function ResumeDoc({ md, changed }: { md: string; changed?: Set<string> }) {
  return (
    <div className="resume-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          li: ({ node, children }) => {
            const t = node ? norm(textOf(node as unknown as HastNode)) : "";
            return <li className={changed?.has(t) ? "changed" : undefined}>{children}</li>;
          },
          // Role headings: title bold, company plain, dates right-aligned — reads like a classic resume.
          h3: ({ node, children }) => {
            const m = node ? ROLE_LINE.exec(textOf(node as unknown as HastNode)) : null;
            if (!m) return <h3>{children}</h3>;
            return (
              <h3>
                <span className="role">{m[1]}</span>
                <span className="org">— {m[2]}</span>
                <span className="dates">{m[3]}</span>
              </h3>
            );
          },
        }}
      >
        {hardBreaks(md)}
      </ReactMarkdown>
    </div>
  );
}

/** Generic prose renderer for JDs, reports and notes, styled with design tokens. */
export function Prose({ md }: { md: string }) {
  const h = (cls: string) =>
    function Heading({ children }: { children?: ReactNode }) {
      return <p className={cls}>{children}</p>;
    };
  return (
    <div className="flex flex-col gap-2 t-body text-ink [&_a]:text-ink-accent [&_a]:underline [&_code]:t-mono-s [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ h1: h("t-h2 text-ink mb-1"), h2: h("t-overline text-ink-accent mt-4"), h3: h("t-label text-ink mt-2") }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
