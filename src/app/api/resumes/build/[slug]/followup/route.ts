import { z } from "zod";
import { activeRunFor } from "@/lib/claude";
import { appendFacts, getBuild } from "@/lib/store";
import { startBuild } from "@/lib/workflows";

const Body = z.object({
  answers: z.array(z.object({ id: z.string(), question: z.string().max(500), answer: z.string().max(4000) })).optional(),
  instruction: z.string().max(4000).optional(),
});

/** Answer the builder's questions / ask for changes — continues the same Claude conversation. */
export async function POST(req: Request, ctx: RouteContext<"/api/resumes/build/[slug]/followup">) {
  const { slug } = await ctx.params;
  const build = await getBuild(slug);
  if (!build) return Response.json({ error: "Not found" }, { status: 404 });
  if (activeRunFor("import", build.file)) return Response.json({ error: "Claude is already working on it" }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const answered = (parsed.data.answers ?? []).filter((a) => a.answer.trim());
  const instruction = parsed.data.instruction?.trim();
  if (!answered.length && !instruction) return Response.json({ error: "Write an answer or a request first" }, { status: 400 });
  if (answered.length) await appendFacts("Building my first resume", answered);
  const text = [
    ...answered.map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`),
    ...(parsed.data.answers ?? []).filter((a) => !a.answer.trim()).map((a) => `Q: ${a.question}\nA: (skipped)`),
    instruction ? `${answered.length ? "\nAlso: " : ""}${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const run = await startBuild(build, { followUp: { kind: answered.length ? "answers" : "revise", text } });
  return Response.json({ runId: run.id });
}
