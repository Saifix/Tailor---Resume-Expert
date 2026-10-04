import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Folder, Send, Sparkles, Briefcase, NotebookPen } from "lucide-react";
import { HeaderActions, NotesEditor, Reminders, StatusMenu } from "./actions";
import { ChecksList, ClaudeAssist } from "@/components/assist";
import { CoverLetterPanel, ResearchCard } from "@/components/research";
import { FormAnswersPanel } from "@/components/form-answers";
import { Prose, ResumeDoc } from "@/components/markdown";
import { PageBody, TopBar } from "@/components/topbar";
import { ButtonLink, CompanyTile, cx, Empty, MatchRing } from "@/components/ui";
import { changedLines } from "@/lib/diff";
import { fresh, shellData } from "@/lib/data";
import { getJob, getJobFile, getResume, listJobFiles } from "@/lib/store";
import { STATUS_LABEL } from "@/lib/types";

const TABS = [
  { id: "resume", label: "Resume", file: "resume.md" },
  { id: "jd", label: "Job description", file: "job-description.md" },
  { id: "report", label: "Match report", file: "match-report.md" },
  { id: "cover", label: "Cover letter", file: "cover-letter.md" },
  { id: "answers", label: "Form answers", file: "form-answers.md" },
  { id: "notes", label: "Notes", file: "notes.md" },
] as const;

export async function generateMetadata(props: PageProps<"/jobs/[slug]">) {
  const { slug } = await props.params;
  const job = await getJob(slug);
  return { title: job ? `${job.company} — ${job.role}` : "Job" };
}

export default async function JobPage(props: PageProps<"/jobs/[slug]">) {
  await fresh();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const job = await getJob(slug);
  if (!job) notFound();

  const [files, shell] = await Promise.all([listJobFiles(slug), shellData()]);
  const fileNames = new Set(files.map((f) => f.name));
  const tabs = TABS.filter((t) => t.id === "resume" || t.id === "notes" || t.id === "answers" || fileNames.has(t.file));
  const tab = tabs.find((t) => t.id === sp.tab) ?? tabs[0];
  const content = tab.id === "notes" ? ((await getJobFile(slug, "notes.md")) ?? "") : await getJobFile(slug, tab.file);
  const base = tab.id === "resume" && content ? await getResume(job.baseResume) : null;
  const changed = base && content ? changedLines(base, content) : undefined;

  return (
    <>
      <TopBar
        eyebrow={
          <>
            <Link href="/jobs" className="hover:text-ink">
              Applications
            </Link>{" "}
            / {job.company}
          </>
        }
        title={job.role}
        unread={shell.unread}
        actions={
          <ButtonLink href={`/outreach?job=${slug}`}>
            <Send strokeWidth={1.75} /> Draft outreach
          </ButtonLink>
        }
      />
      <PageBody className="gap-5 pt-6">
        <div className="flex items-center gap-4">
          <CompanyTile name={job.company} size={52} accent className="rounded-[14px] t-h2" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="t-h3 text-ink">{job.company}</span>
              <StatusMenu slug={slug} status={job.status} />
              {job.match && (
                <span className="flex items-center gap-1.5 rounded-full bg-ok-bg px-2 py-[3px]">
                  <MatchRing value={job.match.after} size={12} />
                  <span className="t-mono-s text-ok">{job.match.after}% match</span>
                </span>
              )}
            </div>
            <p className="t-body-s truncate text-ink-2">
              {[job.location, job.salary, job.appliedAt ? `Applied ${new Date(job.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Not applied yet"]
                .filter(Boolean)
                .join(" · ")}
              {job.url && (
                <>
                  {" · "}
                  <a href={job.url} target="_blank" rel="noreferrer" className="text-ink-accent hover:underline">
                    job post ↗
                  </a>
                </>
              )}
            </p>
          </div>
          <HeaderActions slug={slug} hasCover={fileNames.has("cover-letter.md")} />
        </div>

        <nav className="flex w-fit gap-0.5 rounded-xl bg-muted p-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/jobs/${slug}?tab=${t.id}`}
              scroll={false}
              className={cx("rounded-[9px] px-3.5 py-1.5 t-label", t.id === tab.id ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:text-ink")}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_330px] gap-5">
          {tab.id === "answers" ? (
            <FormAnswersPanel slug={slug} items={job.formAnswers?.items ?? []} checks={job.formAnswers?.checks} company={job.company} />
          ) : tab.id === "notes" ? (
            <NotesEditor slug={slug} initial={content ?? ""} />
          ) : tab.id === "resume" ? (
            <div className="relative flex justify-center overflow-hidden rounded-[20px] bg-muted px-7 pt-14">
              {changed && changed.size > 0 && (
                <span className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface/85 px-3 py-1.5 shadow-e2 backdrop-blur">
                  <span className="size-2.5 rounded-[3px] bg-iris-100" />
                  <span className="t-label-s text-ink-2">
                    {changed.size} line{changed.size === 1 ? "" : "s"} tailored for {job.company}
                  </span>
                </span>
              )}
              {content ? (
                <article className="mb-7 w-full max-w-[640px] self-start rounded-md bg-white px-12 py-11 shadow-e3">
                  <ResumeDoc md={content} changed={changed} />
                </article>
              ) : (
                <div className="self-center">
                  <Empty
                    title={job.status === "tailoring" ? "Claude is on it…" : "No tailored resume yet."}
                    action={
                      <ButtonLink href={`/tailor?job=${slug}`}>
                        <Sparkles strokeWidth={1.75} /> {job.status === "tailoring" ? "Watch progress" : "Tailor now"}
                      </ButtonLink>
                    }
                  >
                    {job.lastError}
                  </Empty>
                </div>
              )}
            </div>
          ) : (
            <section className="card p-8">{content ? <Prose md={content} /> : <Empty title="Empty file." />}</section>
          )}

          <aside className="flex flex-col gap-4">
            {fileNames.has("resume.md") && job.status !== "tailoring" && (
              <ClaudeAssist slug={slug} questions={job.questions} suggestions={job.suggestions} />
            )}
            {job.checks && <ChecksList checks={job.checks} revisions={job.revisions} />}
            {fileNames.has("resume.md") && job.status !== "tailoring" && (
              <CoverLetterPanel slug={slug} exists={fileNames.has("cover-letter.md")} checks={job.letterChecks} />
            )}
            <ResearchCard research={job.research} />
            <section className="card flex flex-col p-5">
              <h2 className="t-h3 mb-3 text-ink">Timeline</h2>
              {job.timeline.map((t, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cx("mt-1 size-3 rounded-full", i === job.timeline.length - 1 ? "bg-accent ring-4 ring-accent/20" : "bg-ok")} />
                    {i < job.timeline.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                  </div>
                  <div className="pb-3.5">
                    <p className="t-label text-ink">{eventLabel(t.type)}</p>
                    <p className="t-body-s text-ink-3">
                      {new Date(t.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </section>
            <Reminders slug={slug} reminders={job.reminders} company={job.company} />
            <section className="card flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <h2 className="t-h3 text-ink">Folder</h2>
                <span className="truncate pl-3 t-mono-s text-ink-3">jobs/{slug.slice(0, 22)}…/</span>
              </div>
              {files
                .filter((f) => !f.name.endsWith(".json") || f.name === "result.json")
                .map((f) => {
                  const t = TABS.find((x) => x.file === f.name);
                  const Icon = f.name.startsWith("job-") ? Briefcase : f.name.startsWith("notes") ? NotebookPen : f.name.endsWith(".md") ? FileText : Folder;
                  const row = (
                    <>
                      <Icon className="size-4 text-ink-3" strokeWidth={1.75} />
                      <span className="flex-1 truncate t-mono text-ink">{f.name}</span>
                      <span className="t-body-s text-ink-3">{(f.size / 1024).toFixed(1)} KB</span>
                    </>
                  );
                  return t ? (
                    <Link key={f.name} href={`/jobs/${slug}?tab=${t.id}`} className={cx("flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-subtle", t.id === tab.id && "bg-subtle")}>
                      {row}
                    </Link>
                  ) : (
                    <div key={f.name} className="flex items-center gap-2.5 px-1.5 py-1.5">
                      {row}
                    </div>
                  );
                })}
            </section>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function eventLabel(type: string) {
  const map: Record<string, string> = { created: "Job saved", tailoring: "Tailoring started", revising: "Asked Claude for changes", tailored: "Tailored with Claude", "cover-letter": "Cover letter written", "form-answers": "Form questions answered" };
  return map[type] ?? STATUS_LABEL[type as keyof typeof STATUS_LABEL] ?? type;
}
