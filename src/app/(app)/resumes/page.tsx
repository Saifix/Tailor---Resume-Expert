import type { Metadata } from "next";
import Link from "next/link";
import { Folder, Plus, Sparkles, SquareTerminal, Wand2 } from "lucide-react";
import { MakeDefault, SkillToggles } from "./client";
import { Uploader } from "./uploader";
import { PageBody, TopBar } from "@/components/topbar";
import { Card, cx, Empty, relDate } from "@/components/ui";
import { fresh, shellData } from "@/lib/data";
import { displayPath, TAILOR_HOME } from "@/lib/paths";
import { getFacts, listJobs, listOriginals, listOutreach, listResumes, listSkills } from "@/lib/store";

export const metadata: Metadata = { title: "Resumes" };

export default async function ResumesPage() {
  await fresh();
  const [resumes, skills, jobs, originals, outreach, shell, facts] = await Promise.all([
    listResumes(),
    listSkills(),
    listJobs(),
    listOriginals(),
    listOutreach(),
    shellData(),
    getFacts(),
  ]);
  const factCount = facts.split("\n").filter((l) => /^\s*-\s/.test(l)).length;
  const tree = buildTree({ resumes: resumes.map((r) => ({ file: r.file, isDefault: r.isDefault })), originals, jobs: jobs.map((j) => j.slug), outreach: outreach.length, skills: skills.length });

  return (
    <>
      <TopBar eyebrow="Your base CVs, skills and files" title="Resumes" unread={shell.unread} />
      <PageBody className="gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4">
          <Uploader />
          <Link href="/resumes/new" className="card group flex flex-col justify-center gap-1.5 p-5 transition-shadow hover:shadow-e2">
            <span className="flex items-center gap-2 t-h3 text-ink">
              <Wand2 className="size-[18px] text-accent" strokeWidth={1.75} /> No CV yet?
            </span>
            <span className="t-body-s text-ink-2">Describe yourself — type or dictate — attach any documents, and Claude builds your first resume.</span>
            <span className="t-label-s text-ink-accent group-hover:underline">Build it with Claude →</span>
          </Link>
        </div>
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_400px] gap-5">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="t-h3 text-ink">Base resumes</h2>
              <span className="t-body-s text-ink-3">Claude starts from one of these</span>
            </div>
            {resumes.length ? (
              <div className="grid grid-cols-3 gap-4">
                {resumes.map((r) => {
                  const avg = jobs.filter((j) => j.baseResume === r.file && j.match).map((j) => j.match!.after);
                  return (
                    <Link
                      key={r.file}
                      href={`/resumes/${encodeURIComponent(r.file)}`}
                      className={cx("card flex flex-col gap-3 p-3.5 transition-shadow hover:shadow-e2", r.isDefault && "ring-1 ring-accent/40")}
                    >
                      <div className="overflow-hidden rounded-xl bg-muted px-5 pt-4">
                        <div className="flex h-[92px] flex-col gap-[5px] rounded-t bg-white p-3.5 shadow-e2">
                          <span className="h-[7px] w-14 rounded-sm bg-neutral-800" />
                          <span className="h-[3px] w-24 rounded-sm bg-neutral-400" />
                          <span className="mt-1 h-[3px] w-9 rounded-sm bg-iris-500" />
                          {[90, 80, 86, 70].map((w, i) => (
                            <span key={i} className="h-[3px] rounded-sm bg-neutral-300" style={{ width: `${w}%` }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 truncate t-label text-ink">{r.title}</span>
                        {r.isDefault ? <span className="rounded-full bg-accent-subtle px-[7px] py-0.5 t-label-s text-ink-accent">Default</span> : <MakeDefault file={r.file} />}
                      </div>
                      <span className="truncate t-mono-s text-ink-2">{r.file}</span>
                      <span className="t-body-s text-ink-3">
                        {r.usedBy ? `Used ${r.usedBy}×${avg.length ? ` · avg match ${Math.round(avg.reduce((a, b) => a + b, 0) / avg.length)}%` : ""}` : `${r.words} words · ${relDate(r.updatedAt)}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card>
                <Empty title="No base resume yet.">Drop your CV above. Claude converts it to Markdown and keeps every fact exactly as written.</Empty>
              </Card>
            )}

            {factCount > 0 && (
              <Link href="/resumes/facts.md" className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-e2">
                <span className="grid size-9 place-items-center rounded-[10px] bg-accent-subtle">
                  <Sparkles className="size-[18px] text-accent" strokeWidth={1.75} />
                </span>
                <span className="flex-1">
                  <span className="block t-label text-ink">
                    {factCount} fact{factCount > 1 ? "s" : ""} you told Claude
                  </span>
                  <span className="block t-body-s text-ink-3">From answering its questions · reused in every tailoring run · resumes/facts.md</span>
                </span>
                <span className="t-label-s text-ink-accent">View →</span>
              </Link>
            )}

            <Card className="flex flex-1 flex-col gap-1 p-4">
              <div className="flex items-center gap-2 px-1.5 pb-2">
                <Sparkles className="size-[18px] text-accent" strokeWidth={1.75} />
                <h2 className="t-h3 flex-1 text-ink">Claude skills</h2>
                <span className="t-mono-s text-ink-3">~/Tailor/.claude/skills/</span>
              </div>
              <SkillToggles skills={skills} />
              <p className="px-1.5 pt-3 t-body-s text-ink-3">
                <Plus className="mr-1.5 inline size-4 align-[-3px] text-accent" strokeWidth={1.75} />
                Add your own: create a folder with a <span className="t-mono-s">SKILL.md</span> in the skills directory — Claude picks it up on the next run.
              </p>
            </Card>
          </div>

          <Card className="flex flex-col gap-3 p-[22px]">
            <div className="flex items-center gap-2">
              <Folder className="size-[18px] text-accent" strokeWidth={1.75} />
              <h2 className="t-h3 flex-1 text-ink">On your disk</h2>
            </div>
            <pre className="flex-1 overflow-auto rounded-xl bg-subtle px-4 py-3.5 t-mono leading-[22px] text-ink-2">{tree}</pre>
            <p className="flex items-start gap-2 t-body-s text-ink-3">
              <SquareTerminal className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              Everything is plain files — edit them in your editor, or run claude in that folder.
            </p>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function buildTree(d: { resumes: { file: string; isDefault: boolean }[]; originals: string[]; jobs: string[]; outreach: number; skills: number }) {
  const lines = [displayPath(TAILOR_HOME), "├─ resumes/"];
  d.resumes.forEach((r) => lines.push(`│  ├─ ${r.file}${r.isDefault ? "   ★" : ""}`));
  lines.push(`│  └─ original/   ${d.originals.length} file${d.originals.length === 1 ? "" : "s"}`);
  lines.push("├─ jobs/");
  d.jobs.slice(0, 4).forEach((j) => lines.push(`│  ├─ ${j.length > 30 ? j.slice(0, 29) + "…" : j}/`));
  lines.push(d.jobs.length > 4 ? `│  └─ … ${d.jobs.length - 4} more` : `│  └─ (one folder per job)`);
  lines.push(`├─ outreach/   ${d.outreach} draft${d.outreach === 1 ? "" : "s"}`);
  lines.push(`├─ .claude/skills/   ${d.skills} skills`);
  lines.push("└─ tailor.json   settings");
  return lines.join("\n");
}
