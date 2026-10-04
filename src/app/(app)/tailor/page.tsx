import type { Metadata } from "next";
import { TailorStudio } from "./studio";
import { TopBar } from "@/components/topbar";
import { fresh, shellData } from "@/lib/data";
import { getClaudeConfig, getJob, listResumes, listSkills } from "@/lib/store";
import { activeRunFor } from "@/lib/claude";

export const metadata: Metadata = { title: "New tailoring" };

export default async function TailorPage(props: PageProps<"/tailor">) {
  await fresh();
  const sp = await props.searchParams;
  const jobSlug = typeof sp.job === "string" ? sp.job : undefined;
  const [resumes, skills, shell, job, cfg] = await Promise.all([listResumes(), listSkills(), shellData(), jobSlug ? getJob(jobSlug) : null, getClaudeConfig()]);
  const runId = (typeof sp.run === "string" ? sp.run : undefined) ?? (job ? activeRunFor("tailor", job.slug)?.id : undefined);

  return (
    <>
      <TopBar eyebrow="Paste a job · get a tailored resume" title="New tailoring" unread={shell.unread} />
      <TailorStudio
        resumes={resumes.map((r) => ({ file: r.file, title: r.title, words: r.words, updatedAt: r.updatedAt, isDefault: r.isDefault }))}
        installedSkills={skills.filter((s) => s.enabled).map((s) => s.name)}
        initialJob={job}
        initialRunId={runId ?? null}
        defaults={{ model: cfg.model, effort: cfg.effort, web: cfg.web }}
      />
    </>
  );
}
