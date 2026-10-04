import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { slugify } from "./paths";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const TEXT_EXT = new Set([".md", ".markdown", ".txt"]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const DOC_EXT = new Set([".pdf", ".docx", ...TEXT_EXT, ...IMAGE_EXT]);
export const ACCEPT_ATTR = ".pdf,.docx,.png,.jpg,.jpeg,.webp,.md,.markdown,.txt";

export function uniqueName(dir: string, base: string, ext: string) {
  let name = `${base}${ext}`;
  for (let i = 2; existsSync(path.join(dir, name)); i++) name = `${base}-${i}${ext}`;
  return name;
}

export type SavedFile = { name: string; original: string; readable: string; kind: "text" | "pdf" | "image" | "word" };

/**
 * Save supporting documents into `dir`. Word files also get a `.docx.md` conversion next to them
 * (Claude Code can read PDFs, images and text, but not .docx).
 */
export async function saveDocuments(dir: string, files: File[]): Promise<{ saved: SavedFile[]; rejected: string[] }> {
  await fs.mkdir(dir, { recursive: true });
  const saved: SavedFile[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!DOC_EXT.has(ext) || file.size > MAX_UPLOAD_BYTES || file.size === 0) {
      rejected.push(`${file.name}${file.size > MAX_UPLOAD_BYTES ? " (over 10 MB)" : ext === ".doc" ? " (save as .docx or PDF)" : " (unsupported type)"}`);
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const name = uniqueName(dir, slugify(path.basename(file.name, ext), 50) || "document", ext);
    await fs.writeFile(path.join(dir, name), buf);
    let readable = name;
    let kind: SavedFile["kind"] = TEXT_EXT.has(ext) ? "text" : IMAGE_EXT.has(ext) ? "image" : ext === ".pdf" ? "pdf" : "word";
    if (ext === ".docx") {
      try {
        const { value } = await (mammoth as unknown as { convertToMarkdown: typeof mammoth.convertToHtml }).convertToMarkdown({ buffer: buf });
        readable = `${name}.md`;
        await fs.writeFile(path.join(dir, readable), value, "utf8");
      } catch {
        rejected.push(`${file.name} (couldn't read this Word file)`);
        kind = "word";
      }
    }
    saved.push({ name, original: file.name, readable, kind });
  }
  return { saved, rejected };
}

/** Concatenate the plain-text files in a folder (used as "known facts" by the self-checks). */
export async function readTextFiles(dir: string): Promise<string> {
  if (!existsSync(dir)) return "";
  const names = (await fs.readdir(dir)).filter((n) => /\.(md|markdown|txt)$/i.test(n));
  const parts = await Promise.all(names.map((n) => fs.readFile(path.join(dir, n), "utf8").catch(() => "")));
  return parts.join("\n\n");
}
