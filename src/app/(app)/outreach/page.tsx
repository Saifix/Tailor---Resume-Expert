import type { Metadata } from "next";
import { OutreachStudio } from "./studio";
import { TopBar } from "@/components/topbar";
import { activeRunFor } from "@/lib/claude";
import { fresh, shellData } from "@/lib/data";
import { getOutreach, listJobs, listOutreach } from "@/lib/store";

export const metadata: Metadata = { title: "Outreach" };

export default async function OutreachPage(props: PageProps<"/outreach">) {
  await fresh();
  const sp = await props.searchParams;
  const itemSlug = typeof sp.item === "string" ? sp.item : undefined;
  const [jobs, items, shell, item] = await Promise.all([listJobs(), listOutreach(), shellData(), itemSlug ? getOutreach(itemSlug) : null]);
  const runId = (typeof sp.run === "string" ? sp.run : undefined) ?? (item ? activeRunFor("outreach", item.slug)?.id : undefined);

  return (
    <>
      <TopBar eyebrow="Draft a LinkedIn message · you send it" title="Outreach" unread={shell.unread} />
      <OutreachStudio
        key={item?.slug ?? "new"}
        jobs={jobs.map((j) => ({ slug: j.slug, label: `${j.company} — ${j.role}` }))}
        history={items.map((i) => ({ slug: i.slug, name: i.name, intent: i.intent, createdAt: i.createdAt, drafts: i.drafts.length }))}
        item={item}
        runId={runId ?? null}
        presetJob={typeof sp.job === "string" ? sp.job : undefined}
      />
    </>
  );
}
