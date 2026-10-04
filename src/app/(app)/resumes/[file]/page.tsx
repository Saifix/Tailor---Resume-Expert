import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ResumeDoc } from "@/components/markdown";
import { PageBody, TopBar } from "@/components/topbar";
import { ButtonLink } from "@/components/ui";
import { fresh, shellData } from "@/lib/data";
import { getResume } from "@/lib/store";

export default async function ResumeView(props: PageProps<"/resumes/[file]">) {
  await fresh();
  const { file } = await props.params;
  const name = decodeURIComponent(file);
  const [md, shell] = await Promise.all([getResume(name).catch(() => null), shellData()]);
  if (!md) notFound();
  return (
    <>
      <TopBar
        eyebrow={
          <>
            <Link href="/resumes" className="hover:text-ink">
              Resumes
            </Link>{" "}
            / {name}
          </>
        }
        title={/^#\s+(.+)$/m.exec(md)?.[1] ?? name}
        unread={shell.unread}
        actions={
          <ButtonLink href="/tailor">
            <Sparkles strokeWidth={1.75} /> Tailor from this
          </ButtonLink>
        }
      />
      <PageBody>
        <div className="flex flex-1 justify-center rounded-[20px] bg-muted px-7 pt-8">
          <article className="mb-8 w-full max-w-[680px] self-start rounded-md bg-white px-12 py-11 shadow-e3">
            <ResumeDoc md={md} />
          </article>
        </div>
        <p className="t-body-s text-ink-3">
          This is your source of truth. Edit <span className="t-mono-s">~/Tailor/resumes/{name}</span> in any editor — Tailor reads it fresh every time.
        </p>
      </PageBody>
    </>
  );
}
