import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { z } from "zod";
import { dirs, slugify } from "@/lib/paths";
import { ensureHome, saveSettings } from "@/lib/store";
import { startImport } from "@/lib/workflows";

const MAX_BYTES = 10 * 1024 * 1024;
const TEXT = new Set([".md", ".markdown", ".txt"]);
const IMAGES = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const OK_EXT = new Set([".pdf", ".docx", ...TEXT, ...IMAGES]);

function uniqueName(dir: string, base: string, ext: string) {
  let name = `${base}${ext}`;
  for (let i = 2; existsSync(path.join(dir, name)); i++) name = `${base}-${i}${ext}`;
  return name;
}

/**
 * Upload a CV.
 * - Markdown / text: stored as-is.
 * - Word (.docx): converted to text locally with mammoth (Claude Code can't open .docx), then cleaned up by Claude.
 * - PDF and images (PNG/JPG/WebP scans): read directly by Claude via the resume-import skill.
 */
export async function POST(req: Request) {
  await ensureHome();
  const fd = await req.formData();
  const file = fd.get("file");
  const label = String(fd.get("name") ?? "").trim();
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 10 MB" }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  if (ext === ".doc") return Response.json({ error: "Old .doc files aren't supported — save it as .docx or PDF first" }, { status: 400 });
  if (!OK_EXT.has(ext)) return Response.json({ error: "Use a PDF, Word (.docx), image (PNG/JPG), Markdown or text file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const base = slugify(label || path.basename(file.name, ext), 40) || "resume";
  const original = uniqueName(dirs.originals, base, ext);
  await fs.writeFile(path.join(dirs.originals, original), buf);

  const target = uniqueName(dirs.resumes, base, ".md");
  if (TEXT.has(ext)) {
    await fs.writeFile(path.join(dirs.resumes, target), buf);
    return Response.json({ file: target });
  }

  let source = original;
  if (ext === ".docx") {
    try {
      // convertToMarkdown keeps headings, bold and lists — a good starting point for the import skill.
      const { value } = await (mammoth as unknown as { convertToMarkdown: typeof mammoth.convertToHtml }).convertToMarkdown({ buffer: buf });
      if (!value.trim()) throw new Error("empty");
      source = `${path.basename(original, ext)}.docx.md`;
      await fs.writeFile(path.join(dirs.originals, source), value, "utf8");
    } catch {
      return Response.json({ error: "Couldn't read that Word file — try exporting it as PDF" }, { status: 400 });
    }
  }
  const run = await startImport(source, target);
  return Response.json({ file: target, runId: run.id });
}

const Patch = z.object({ defaultResume: z.string() });

export async function PATCH(req: Request) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (!existsSync(path.join(dirs.resumes, path.basename(parsed.data.defaultResume))))
    return Response.json({ error: "Resume not found" }, { status: 404 });
  return Response.json(await saveSettings({ defaultResume: path.basename(parsed.data.defaultResume) }));
}
