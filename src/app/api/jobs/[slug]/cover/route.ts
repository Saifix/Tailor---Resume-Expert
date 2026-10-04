import { z } from "zod";
import { activeRunFor, EFFORTS } from "@/lib/claude";
import { getJob } from "@/lib/store";
import { startCoverLetter } from "@/lib/workflows";

const Body = z.object({ instruction: z.string().max(2000).optional(), model: z.string().max(80).optional(), effort: z.enum(EFFORTS).optional() });

/** Generate (or revise) the cover letter for a job — self-checked for length, facts and voice. */
export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[slug]/cover">) {
  const { slug } = await ctx.params;
  const job = await getJob(slug);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (activeRunFor("tailor", slug)) return Response.json({ error: "Claude is already working on this job" }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const run = await startCoverLetter(job, {
    origin: new URL(req.url).origin,
    instruction: parsed.data.instruction?.trim() || undefined,
    override: { model: parsed.data.model, effort: parsed.data.effort },
  });
  return Response.json({ runId: run.id });
}
