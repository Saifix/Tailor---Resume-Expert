import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dirs, slugify } from "@/lib/paths";
import { buildDir, ensureHome, newBuildSlug, saveBuild } from "@/lib/store";
import type { BuildMeta } from "@/lib/types";
import { saveDocuments, uniqueName } from "@/lib/uploads";
import { startBuild } from "@/lib/workflows";

const Fields = z.object({
  about: z.string().max(40_000).default(""),
  name: z.string().max(100).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(60).default(""),
  location: z.string().max(120).default(""),
  links: z.string().max(1000).default(""),
  targetRole: z.string().max(200).default(""),
  docType: z.enum(["resume", "academic"]).default("resume"),
  region: z.string().max(40).default(""),
});

/** "I don't have a CV": save what the person told us + their documents, then have Claude build a first base resume. */
export async function POST(req: Request) {
  await ensureHome();
  const fd = await req.formData();
  const parsed = Fields.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const f = parsed.data;
  const files = fd.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  if (f.about.trim().length < 60 && !files.length) return Response.json({ error: "Tell Claude a bit about yourself (a few sentences) or attach a document." }, { status: 400 });

  const slug = newBuildSlug(f.name || "me");
  const dir = buildDir(slug);
  await fs.mkdir(dir, { recursive: true });
  const { saved, rejected } = await saveDocuments(dir, files);
  await fs.writeFile(path.join(dir, "about.md"), `# In my own words\n\n${f.about.trim() || "(nothing written — see the documents)"}\n`, "utf8");
  await fs.writeFile(
    path.join(dir, "intake.md"),
    [
      `# Intake`,
      ``,
      `- Name: ${f.name || "(not given — take it from the documents)"}`,
      `- Email: ${f.email}`,
      `- Phone: ${f.phone}`,
      `- Location: ${f.location}`,
      `- Links: ${f.links}`,
      `- Target role(s): ${f.targetRole}`,
      `- Format: ${f.docType === "academic" ? "Academic CV" : "Resume"}`,
      `- Region: ${f.region || "not specified"}`,
      `- Documents: ${saved.map((s) => `${s.readable} (${s.kind}, originally "${s.original}")`).join("; ") || "none"}`,
    ].join("\n") + "\n",
    "utf8",
  );

  const file = uniqueName(dirs.resumes, `${slugify(f.name, 30) || "my"}-resume`, ".md");
  const build: BuildMeta = {
    slug,
    file,
    name: f.name || undefined,
    targetRole: f.targetRole || undefined,
    docType: f.docType,
    region: f.region || undefined,
    createdAt: new Date().toISOString(),
    status: "building",
    sources: saved,
  };
  await saveBuild(build);
  const run = await startBuild(build);
  return Response.json({ slug, file, runId: run.id, rejected });
}
