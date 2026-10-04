import type { Metadata } from "next";
import { SettingsForm } from "./form";
import { PageBody, TopBar } from "@/components/topbar";
import { Card } from "@/components/ui";
import { detectClaude } from "@/lib/claude";
import { fresh, shellData } from "@/lib/data";
import { displayPath, TAILOR_HOME } from "@/lib/paths";
import { getSettings } from "@/lib/store";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await fresh();
  const [settings, claude, shell] = await Promise.all([getSettings(), detectClaude(), shellData()]);
  return (
    <>
      <TopBar eyebrow="Local preferences" title="Settings" unread={shell.unread} />
      <PageBody>
        <div className="grid max-w-[1040px] grid-cols-[minmax(0,1fr)_320px] gap-5">
          <Card className="p-6">
            <SettingsForm userName={settings.userName} claude={{ ...settings.claude, model: settings.claude?.model ?? settings.model }} dictationLanguage={settings.dictation?.language} />
          </Card>
          <Card className="flex flex-col gap-3 self-start p-5">
            <h2 className="t-h3 text-ink">This machine</h2>
            <Row k="Claude Code" v={claude.found ? `claude ${claude.version}` : "not found"} ok={claude.found} />
            <Row k="Data folder" v={displayPath(TAILOR_HOME)} />
            <Row k="Settings" v="tailor.json" />
            <p className="t-body-s text-ink-3">
              Change the data folder with the <span className="t-mono-s">TAILOR_HOME</span> environment variable.
            </p>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="t-body-s text-ink-3">{k}</span>
      <span className={`t-mono-s ${ok === false ? "text-bad" : "text-ink"}`}>{v}</span>
    </div>
  );
}
