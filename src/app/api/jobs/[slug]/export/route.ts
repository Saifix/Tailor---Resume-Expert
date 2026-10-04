import { markdownToDocx } from "@/lib/docx";
import { renderPdf } from "@/lib/pdf";
import { getJob, getJobFile } from "@/lib/store";

const DOCS = { resume: "resume.md", cover: "cover-letter.md" } as const;

/** Download the tailored resume / cover letter as PDF or Word. */
export async function GET(req: Request, ctx: RouteContext<"/api/jobs/[slug]/export">) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const doc = url.searchParams.get("doc") === "cover" ? "cover" : "resume";
  const format = url.searchParams.get("format") === "docx" ? "docx" : "pdf";
  const [job, md] = await Promise.all([getJob(slug), getJobFile(slug, DOCS[doc])]);
  if (!job || !md) return Response.json({ error: "Nothing to export yet" }, { status: 404 });

  const person = /^#\s+(.+)$/m.exec(md)?.[1]?.trim();
  const name = [person, doc === "cover" ? "Cover letter" : "Resume", job.company].filter(Boolean).join(" - ").replace(/[\/:*?"<>|]/g, "");

  let body: Buffer | null;
  let type: string;
  if (format === "docx") {
    body = await markdownToDocx(md, doc === "cover" ? "letter" : "resume");
    type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    body = await renderPdf(`${url.origin}/print/${slug}?export=1&doc=${doc}`);
    type = "application/pdf";
    if (!body) return Response.json({ error: "No Chrome or Edge found for PDF export — use Print instead." }, { status: 501 });
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}.${format}"; filename*=UTF-8''${encodeURIComponent(`${name}.${format}`)}`,
      "Cache-Control": "no-store",
    },
  });
}
