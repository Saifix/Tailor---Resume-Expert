import { z } from "zod";
import { extractJob } from "@/lib/extract";

const Body = z.object({ jd: z.string().max(60_000).optional(), url: z.string().url().max(800).optional() });

/** Company / title / location from a pasted JD (or a link). Called as you paste on the New tailoring page. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const out = await extractJob(parsed.data);
  if ("error" in out) return Response.json({ error: out.error }, { status: out.status });
  return Response.json(out);
}
