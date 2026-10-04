import { z } from "zod";
import { activeRunFor } from "@/lib/claude";
import { getOutreach } from "@/lib/store";
import { startOutreach } from "@/lib/workflows";

const Body = z.object({ instruction: z.string().min(2).max(2000) });

/** "Make it shorter", "mention my open-source work"… — continues the same conversation. */
export async function POST(req: Request, ctx: RouteContext<"/api/outreach/[slug]/revise">) {
  const { slug } = await ctx.params;
  const item = await getOutreach(slug);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  if (activeRunFor("outreach", slug)) return Response.json({ error: "Claude is already writing" }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say what to change" }, { status: 400 });
  if (!item.sessionId) return Response.json({ error: "Paste the profile again to redraft" }, { status: 400 });
  const run = await startOutreach(item, { revise: parsed.data.instruction });
  return Response.json({ runId: run.id });
}
