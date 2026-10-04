import type { Metadata } from "next";
import { BuilderStudio } from "./builder";
import { TopBar } from "@/components/topbar";
import { activeRunFor } from "@/lib/claude";
import { fresh, shellData } from "@/lib/data";
import { getBuild, getClaudeConfig, getSettings } from "@/lib/store";

export const metadata: Metadata = { title: "Build my first resume" };

export default async function NewResumePage(props: PageProps<"/resumes/new">) {
  await fresh();
  const sp = await props.searchParams;
  const slug = typeof sp.build === "string" ? sp.build : undefined;
  const [shell, settings, build, cfg] = await Promise.all([shellData(), getSettings(), slug ? getBuild(slug) : null, getClaudeConfig()]);
  const runId = (typeof sp.run === "string" ? sp.run : undefined) ?? (build ? activeRunFor("import", build.file)?.id : undefined);
  return (
    <>
      <TopBar eyebrow="No CV yet? Start here" title="Build my first resume" unread={shell.unread} />
      <BuilderStudio key={build?.slug ?? "new"} userName={settings.userName} initialBuild={build} initialRunId={runId ?? null} web={cfg.web} />
    </>
  );
}
