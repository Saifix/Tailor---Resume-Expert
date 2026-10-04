import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { norm } from "@/lib/diff";

type HastNode = { type: string; value?: string; children?: HastNode[] };
const textOf = (n: HastNode): string => (n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(textOf).join(""));

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
        }}
      >
        {md}
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
