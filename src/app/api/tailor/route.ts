import { z } from "zod";
import { EFFORTS } from "@/lib/claude";
import { extractJob } from "@/lib/extract";
import { createJob, listResumes, updateJob } from "@/lib/store";
import { startTailor } from "@/lib/workflows";

const Body = z.object({
  company: z.string().max(120).default(""),
  role: z.string().max(160).default(""),
  url: z.string().max(800).optional(),
  jd: z.string().max(60_000).default(""),
  baseResume: z.string().optional(),
  skills: z.array(z.string()).default([]),
  docType: z.enum(["resume", "academic"]).default("resume"),
  model: z.string().max(80).optional(),
  effort: z.enum(EFFORTS).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const body = parsed.data;
  const url = body.url?.trim() || undefined;

  if (body.jd.trim().length < 80 && !url) return Response.json({ error: "Paste the job description (or a link to it)." }, { status: 400 });

  const resumes = await listResumes();
  const base = resumes.find((r) => r.file === body.baseResume) ?? resumes.find((r) => r.isDefault);
  if (!base) return Response.json({ error: "Add a base resume first (Resumes → Upload CV)." }, { status: 400 });

  // Fill in whatever the user didn't type: company, title, location — and the JD itself for link-only.
  let { company, role, jd } = body;
  let location: string | undefined;
  if (!company.trim() || !role.trim() || jd.trim().length < 80) {
    const ex = await extractJob({ jd: jd.trim().length >= 80 ? jd : undefined, url });
    if ("error" in ex) {
      if (jd.trim().length < 80) return Response.json({ error: ex.error }, { status: ex.status });
    } else {
      company = company.trim() || ex.company;
      role = role.trim() || ex.role;
      location = ex.location || undefined;
      if (jd.trim().length < 80 && ex.jd) jd = ex.jd;
    }
  }
  if (jd.trim().length < 80) return Response.json({ error: "Couldn't get the job description from that link — paste it instead." }, { status: 422 });

  let job = await createJob({ company, role, url, jd, baseResume: base.file, skills: body.skills, docType: body.docType });
  if (location) job = await updateJob(job.slug, { location });
  const run = await startTailor(job, { origin: new URL(req.url).origin, override: { model: body.model, effort: body.effort } });
  return Response.json({ slug: job.slug, runId: run.id, company: job.company, role: job.role });
}
