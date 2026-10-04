import { Sidebar } from "@/components/sidebar";
import { PageEnter } from "@/components/motion";
import { ReminderNotifier } from "@/components/notifier";
import { Dictation } from "@/components/dictation";
import { shellData, upcomingReminders } from "@/lib/data";
import { getSettings, listJobs } from "@/lib/store";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [{ counts, home, userName }, jobs, settings] = await Promise.all([shellData(), listJobs(), getSettings()]);
  const due = upcomingReminders(jobs).map((r) => ({ id: r.id, at: r.at, title: r.title, body: `${r.job.company} · ${r.job.role}`, href: `/jobs/${r.job.slug}` }));
  return (
    <div className="flex min-h-dvh">
      <Sidebar counts={counts} home={home} userName={userName} />
      <main className="flex min-w-0 flex-1 flex-col">
        <PageEnter>{children}</PageEnter>
      </main>
      <ReminderNotifier reminders={due} />
      <Dictation language={settings.dictation?.language} />
    </div>
  );
}
