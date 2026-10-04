import { z } from "zod";
import { activeRunFor } from "@/lib/claude";
import { appendFacts, getJob } from "@/lib/store";
import { addFormQuestions, startFormAnswers } from "@/lib/workflows";

const Body = z.object({
  questions: z.string().max(40_000).optional(), // newly pasted questions
  instruction: z.string().max(4000).optional(), // "make Q2 shorter"
  details: z.array(z.object({ question: z.string().max(500), answer: z.string().max(2000) })).optional(), // answers to needsInput
});

/** Answer an application form's questions (new or revised) for this job. */
export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[slug]/answers">) {
  const { slug } = await ctx.params;
  const job = await getJob(slug);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (activeRunFor("tailor", slug)) return Response.json({ error: "Claude is already working on this job" }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { questions, instruction, details } = parsed.data;
  const filled = (details ?? []).filter((d) => d.answer.trim());
  if (!questions?.trim() && !instruction?.trim() && !filled.length && !job.formAnswers?.items.length)
    return Response.json({ error: "Paste the form's questions first" }, { status: 400 });

  if (questions?.trim()) await addFormQuestions(slug, questions);
  // Details like notice period or salary are facts about the candidate — keep them for next time too.
  if (filled.length) await appendFacts(`Application form — ${job.company}`, filled);
  const text = [
    instruction?.trim(),
    filled.length ? `Use these details from me (also saved in resumes/facts.md) and replace the placeholders:\n${filled.map((d) => `- ${d.question} → ${d.answer.trim()}`).join("\n")}` : "",
    questions?.trim() ? "New questions were added to form-questions.md — answer them too." : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const run = await startFormAnswers(job, { instruction: text || undefined });
  return Response.json({ runId: run.id });
}
