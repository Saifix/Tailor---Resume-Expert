import { z } from "zod";
import { newOutreachSlug, saveOutreach } from "@/lib/store";
import { startOutreach } from "@/lib/workflows";

const Body = z.object({
  profile: z.string().min(40, "Paste their LinkedIn profile (HTML or text).").max(400_000),
  intent: z.string().min(5, "Say what you want from them.").max(2000),
  tone: z.enum(["Warm", "Direct", "Brief", "Formal"]).default("Warm"),
  format: z.enum(["Connection note", "Message", "Email"]).default("Connection note"),
  jobSlug: z.string().optional(),
});

/** Best-effort name guess so the item has a sensible slug before Claude parses the profile. */
function guessName(profile: string) {
  const h1 = /<h1[^>]*>([^<]{2,80})<\/h1>/i.exec(profile)?.[1];
  const firstLine = profile.replace(/<[^>]+>/g, " ").split("\n").map((l) => l.trim()).find((l) => l.length > 1 && l.length < 60);
  return (h1 ?? firstLine ?? "person").trim();
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const b = parsed.data;
  const name = guessName(b.profile);
  const item = {
    slug: newOutreachSlug(name),
    name,
    intent: b.intent,
    tone: b.tone,
    format: b.format,
    jobSlug: b.jobSlug || undefined,
    createdAt: new Date().toISOString(),
    drafts: [],
  };
  await saveOutreach(item);
  const run = await startOutreach(item, { profile: b.profile });
  return Response.json({ slug: item.slug, runId: run.id });
}
