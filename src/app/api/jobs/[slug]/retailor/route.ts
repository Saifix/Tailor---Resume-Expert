import { activeRunFor } from "@/lib/claude";
import { getJob } from "@/lib/store";
import { startTailor } from "@/lib/workflows";

export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[slug]/retailor">) {
  const { slug } = await ctx.params;
  const job = await getJob(slug);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  const active = activeRunFor("tailor", slug);
  if (active) return Response.json({ runId: active.id });
  const run = await startTailor(job, { origin: new URL(req.url).origin });
  return Response.json({ runId: run.id });
}
