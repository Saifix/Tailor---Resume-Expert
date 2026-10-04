import { anyActiveRun, detectClaude } from "@/lib/claude";
import { displayPath, TAILOR_HOME } from "@/lib/paths";
import { ensureHome } from "@/lib/store";

export async function GET() {
  await ensureHome();
  const [claude, active] = [await detectClaude(), anyActiveRun()];
  return Response.json({
    claude,
    home: displayPath(TAILOR_HOME),
    active: active ? { id: active.id, kind: active.kind, ref: active.ref } : null,
  });
}
