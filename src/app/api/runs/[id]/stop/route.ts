import { getRun, stopRun } from "@/lib/claude";

export async function POST(_req: Request, ctx: RouteContext<"/api/runs/[id]/stop">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  stopRun(run);
  return Response.json({ ok: true, status: run.status });
}
