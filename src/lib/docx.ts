import { AlignmentType, BorderStyle, Document, ExternalHyperlink, LevelFormat, Packer, Paragraph, TextRun, type ParagraphChild } from "docx";

/**
 * Markdown resume / cover letter → a clean, ATS-friendly Word document.
 * Our Markdown is deliberately simple (#, ##, ###, -, **bold**, [links]), so a line parser is enough.
 */
const FONT = "Calibri";
const INK = "1C1C1E";
const GREY = "636366";
const ACCENT = "4A3DC4";

function inline(text: string, base: { size: number; color?: string; bold?: boolean }): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    if (m[1]) out.push(new TextRun({ text: m[1], font: FONT, ...base, bold: true }));
    else out.push(new ExternalHyperlink({ link: m[3], children: [new TextRun({ text: m[2], font: FONT, ...base, color: ACCENT, underline: {} })] }));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}

export async function markdownToDocx(md: string, kind: "resume" | "letter"): Promise<Buffer> {
  const children: Paragraph[] = [];
  const src = md.replace(/\r\n/g, "\n").split("\n");
  let afterName = false;

  for (const raw of src) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      afterName = false;
      if (kind === "letter") children.push(new Paragraph({ spacing: { after: 0 } }));
      continue;
    }
    if (/^#\s+/.test(line)) {
      children.push(new Paragraph({ children: inline(line.replace(/^#\s+/, ""), { size: 40, bold: true, color: INK }), spacing: { after: 60 } }));
      afterName = true;
    } else if (/^##\s+/.test(line)) {
      children.push(
        new Paragraph({
          children: inline(line.replace(/^##\s+/, "").toUpperCase(), { size: 19, bold: true, color: ACCENT }),
          spacing: { before: 220, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D1D6", space: 2 } },
        }),
      );
    } else if (/^###\s+/.test(line)) {
      children.push(new Paragraph({ children: inline(line.replace(/^###\s+/, ""), { size: 22, bold: true, color: INK }), spacing: { before: 120, after: 40 } }));
    } else if (/^\s*[-*]\s+/.test(line)) {
      children.push(new Paragraph({ children: inline(line.replace(/^\s*[-*]\s+/, ""), { size: 20, color: INK }), numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 } }));
    } else {
      children.push(
        new Paragraph({
          children: inline(line, afterName ? { size: 18, color: GREY } : { size: kind === "letter" ? 22 : 20, color: INK }),
          spacing: { after: afterName ? 120 : 80 },
          alignment: kind === "letter" ? AlignmentType.LEFT : undefined,
        }),
      );
    }
  }

  const doc = new Document({
    creator: "Tailor",
    styles: { default: { document: { run: { font: FONT, size: 20, color: INK } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 220 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 800, bottom: 800, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
