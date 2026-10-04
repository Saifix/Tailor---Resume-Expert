import path from "node:path";
import { dirs } from "@/lib/paths";
import { getBuild, readText } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/resumes/build/[slug]">) {
  const { slug } = await ctx.params;
  const build = await getBuild(slug);
  if (!build) return Response.json({ error: "Not found" }, { status: 404 });
  const resume = await readText(path.join(dirs.resumes, build.file));
  return Response.json({ build, resume });
}
