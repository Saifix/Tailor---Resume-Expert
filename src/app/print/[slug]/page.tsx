import { notFound } from "next/navigation";
import { PrintButton } from "./print-button";
import { Prose, ResumeDoc } from "@/components/markdown";
import { fresh } from "@/lib/data";
import { getJob, getJobFile } from "@/lib/store";

export async function generateMetadata(props: PageProps<"/print/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const job = await getJob(slug);
  const what = sp.doc === "cover" ? "Cover letter" : "Resume";
  // The PDF file name defaults to the page title.
  return { title: { absolute: job ? `${what} — ${job.company} — ${job.role}` : what } };
}

/** Printable resume / cover letter. `?export=1` = bare page used for PDF rendering and page counting. */
export default async function PrintPage(props: PageProps<"/print/[slug]">) {
  await fresh();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const cover = sp.doc === "cover";
  const bare = sp.export === "1";
  const md = await getJobFile(slug, cover ? "cover-letter.md" : "resume.md");
  if (!md) notFound();

  const doc = cover ? (
    <div className="resume-doc [&_p]:my-3 [&_p]:text-[14px] [&_p]:leading-[22px]">
      <Prose md={md} />
    </div>
  ) : (
    <ResumeDoc md={md} />
  );

  if (bare) return <article className="bg-white">{doc}</article>;

  return (
    <div className="min-h-full bg-muted py-10 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-5 flex max-w-[794px] items-center justify-between px-2">
        <p className="t-body-s text-ink-2">Choose “Save as PDF” in the print dialog — or download it directly from the job page.</p>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[794px] bg-white px-14 py-12 shadow-e3 print:max-w-none print:p-0 print:shadow-none">{doc}</article>
    </div>
  );
}
