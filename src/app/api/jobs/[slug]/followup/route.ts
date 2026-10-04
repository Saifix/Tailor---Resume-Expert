import { z } from "zod";
import { activeRunFor } from "@/lib/claude";
import { appendFacts, getJob } from "@/lib/store";
import { startTailor } from "@/lib/workflows";

const Body = z.object({
  answers: z.array(z.object({ id: z.string(), question: z.string().max(500), answer: z.string().max(2000) })).optional(),
  instruction: z.string().max(4000).optional(),
});

/** Answer Claude's questions and/or ask for a change — continues the same Claude Code conversation. */
export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[slug]/followup">) {
  const { slug } = await ctx.params;
  const job = await getJob(slug);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (activeRunFor("tailor", slug)) return Response.json({ error: "Claude is already working on this job" }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const answered = (parsed.data.answers ?? []).filter((a) => a.answer.trim());
  const instruction = parsed.data.instruction?.trim();
  if (!answered.length && !instruction) return Response.json({ error: "Write an answer or a request first" }, { status: 400 });

  // Answers become reusable facts for every future tailoring run.
  if (answered.length) await appendFacts(`${job.company} — ${job.role}`, answered);
  const text = [
    ...answered.map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`),
    ...(parsed.data.answers ?? []).filter((a) => !a.answer.trim()).map((a) => `Q: ${a.question}\nA: (skipped — don't add anything for this)`),
    instruction ? `${answered.length ? "\nAlso: " : ""}${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const run = await startTailor(job, { origin: new URL(req.url).origin, followUp: { kind: answered.length ? "answers" : "revise", text } });
  return Response.json({ runId: run.id });
}
