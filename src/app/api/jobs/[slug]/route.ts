import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { diffLines } from "@/lib/diff";
import { getJob, getJobFile, getResume, jobDir, setJobStatus, updateJob } from "@/lib/store";
import { STATUSES } from "@/lib/types";

/** Job meta + a compact diff of the tailored resume vs. its base resume (for the live tailoring view). */
export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[slug]">) {
  const { slug } = await ctx.params;
  const job = await getJob(slug);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  const [tailored, base] = await Promise.all([getJobFile(slug, "resume.md"), getResume(job.baseResume)]);
  const diff = tailored && base ? diffLines(base, tailored).filter((d) => d.text.trim()) : [];
  return Response.json({ job, diff, hasResume: !!tailored });
}

const Patch = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(STATUSES) }),
  z.object({ action: z.literal("addReminder"), at: z.string(), title: z.string().min(1).max(200) }),
  z.object({ action: z.literal("toggleReminder"), id: z.string() }),
  z.object({ action: z.literal("deleteReminder"), id: z.string() }),
  z.object({ action: z.literal("details"), location: z.string().max(120).optional(), salary: z.string().max(80).optional() }),
  z.object({ action: z.literal("notes"), text: z.string().max(100_000) }),
]);

export async function PATCH(req: Request, ctx: RouteContext<"/api/jobs/[slug]">) {
  const { slug } = await ctx.params;
  if (!(await getJob(slug))) return Response.json({ error: "Job not found" }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const p = parsed.data;

  switch (p.action) {
    case "status":
      return Response.json(await setJobStatus(slug, p.status));
    case "addReminder":
      return Response.json(
        await updateJob(slug, (m) => ({
          ...m,
          reminders: [...m.reminders, { id: randomUUID().slice(0, 8), at: new Date(p.at).toISOString(), title: p.title }].sort((a, b) =>
            a.at.localeCompare(b.at),
          ),
        })),
      );
    case "toggleReminder":
      return Response.json(
        await updateJob(slug, (m) => ({ ...m, reminders: m.reminders.map((r) => (r.id === p.id ? { ...r, done: !r.done } : r)) })),
      );
    case "deleteReminder":
      return Response.json(await updateJob(slug, (m) => ({ ...m, reminders: m.reminders.filter((r) => r.id !== p.id) })));
    case "details":
      return Response.json(await updateJob(slug, { location: p.location, salary: p.salary }));
    case "notes":
      await fs.writeFile(path.join(jobDir(slug), "notes.md"), p.text, "utf8");
      return Response.json({ ok: true });
  }
}
