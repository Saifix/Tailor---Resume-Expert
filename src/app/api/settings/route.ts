import { z } from "zod";
import { EFFORTS } from "@/lib/claude";
import { saveSettings } from "@/lib/store";

const Patch = z.object({
  userName: z.string().max(60).optional(),
  disabledSkills: z.array(z.string()).optional(),
  claude: z
    .object({
      model: z.string().max(80).optional(),
      effort: z.enum(EFFORTS).optional().or(z.literal("")),
      fallbackModel: z.string().max(80).optional(),
      web: z.boolean().optional(),
      humanVoice: z.boolean().optional(),
      instructions: z.string().max(4000).optional(),
      loadUserSettings: z.boolean().optional(),
    })
    .optional(),
  dictation: z.object({ language: z.string().max(20).optional() }).optional(),
});

export async function PATCH(req: Request) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { claude, ...rest } = parsed.data;
  const patch: Parameters<typeof saveSettings>[0] = { ...rest };
  if (claude) patch.claude = { ...claude, effort: claude.effort || undefined, model: claude.model?.trim() || undefined, fallbackModel: claude.fallbackModel?.trim() || undefined };
  return Response.json(await saveSettings(patch));
}
