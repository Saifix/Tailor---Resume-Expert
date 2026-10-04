import { spawn } from "node:child_process";
import { getJob, jobDir } from "@/lib/store";

/** Reveal the job folder in Finder / Explorer / the file manager. Local-only by design. */
export async function POST(_req: Request, ctx: RouteContext<"/api/jobs/[slug]/open">) {
  const { slug } = await ctx.params;
  if (!(await getJob(slug))) return Response.json({ error: "Job not found" }, { status: 404 });
  const dir = jobDir(slug);
  const [cmd, args] = process.platform === "win32" ? ["explorer.exe", [dir]] : process.platform === "darwin" ? ["open", [dir]] : ["xdg-open", [dir]];
  spawn(/*turbopackIgnore: true*/ cmd, args as string[], { detached: true, stdio: "ignore" }).unref();
  return Response.json({ ok: true });
}
