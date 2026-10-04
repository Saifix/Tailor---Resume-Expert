import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Board } from "./board";
import { JobRow } from "@/components/job-row";
import { PageBody, TopBar } from "@/components/topbar";
import { ButtonLink, Card, cx, Empty } from "@/components/ui";
import { followUps, fresh, shellData } from "@/lib/data";
import { listJobs } from "@/lib/store";

export const metadata: Metadata = { title: "Applications" };

export default async function JobsPage(props: PageProps<"/jobs">) {
  await fresh();
  const sp = await props.searchParams;
  const view = sp.view === "list" ? "list" : "board";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [all, shell] = await Promise.all([listJobs(), shellData()]);
  const jobs = q ? all.filter((j) => `${j.company} ${j.role} ${j.location ?? ""}`.toLowerCase().includes(q)) : all;
  const interviews = all.filter((j) => j.status === "interview").length;

  return (
    <>
      <TopBar
        eyebrow={`${all.length} application${all.length === 1 ? "" : "s"} · ${interviews} active interview${interviews === 1 ? "" : "s"}`}
        title="Applications"
        unread={shell.unread}
        actions={
          <ButtonLink href="/tailor">
            <Plus strokeWidth={2} /> New tailoring
          </ButtonLink>
        }
      />
      <PageBody className="gap-5 pt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
            {(
              [
                ["board", "Board", LayoutGrid],
                ["list", "List", List],
              ] as const
            ).map(([v, label, Icon]) => (
              <Link
                key={v}
                href={{ pathname: "/jobs", query: { ...(q ? { q } : {}), ...(v === "list" ? { view: "list" } : {}) } }}
                className={cx("flex items-center gap-1.5 rounded-lg px-3 py-[5px] t-label-s", view === v ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:text-ink")}
              >
                <Icon className="size-3.5" strokeWidth={1.75} /> {label}
              </Link>
            ))}
          </div>
          {q && (
            <Link href={{ pathname: "/jobs", query: view === "list" ? { view } : {} }} className="rounded-full bg-accent-subtle px-3 py-1.5 t-label-s text-ink-accent">
              “{q}” · clear ×
            </Link>
          )}
          <span className="flex-1" />
          {view === "board" && <span className="t-body-s text-ink-3">Drag cards to change status</span>}
        </div>

        {!all.length ? (
          <Card className="flex flex-1 items-center justify-center">
            <Empty title="Nothing here yet." action={<ButtonLink href="/tailor">Tailor your first resume</ButtonLink>}>
              Every job you tailor for gets a folder and a card here.
            </Empty>
          </Card>
        ) : view === "board" ? (
          <Board jobs={jobs} stale={followUps(all).map((j) => j.slug)} />
        ) : (
          <Card className="p-3">
            {jobs.map((j) => (
              <JobRow key={j.slug} job={j} />
            ))}
            {!jobs.length && <Empty title="No matches.">Try a different search.</Empty>}
          </Card>
        )}
      </PageBody>
    </>
  );
}
