import { AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, LevelFormat, Packer, Paragraph, TabStopType, TextRun, type ParagraphChild } from "docx";

/**
 * Markdown resume / cover letter → a clean, ATS-friendly Word document.
 * Our Markdown is deliberately simple (#, ##, ###, -, **bold**, [links]), so a line parser is enough.
 *
 * Layout follows what parsers and recruiters expect from a Word resume: A4, single column, real Word
 * heading styles, 10.5pt Calibri body, month–year dates right-aligned with a tab stop (no tables or
 * text boxes), and contact details in the body rather than the page header.
 */
const FONT = "Calibri";
const INK = "1C1C1E";
const GREY = "4A4A4F";
const ACCENT = "4A3DC4";
const RULE = "C7C7CC";

// A4 in twips (1/20 pt). The right tab stop for dates sits on the text edge.
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { top: 620, right: 800, bottom: 620, left: 800 };
const TEXT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

const BODY = 20; // half-points → 10pt, the same density as the PDF so both fit the same words per page

type Base = { size: number; color?: string; bold?: boolean };

const LINK_TLDS = "com|ai|io|dev|org|net|me|co|uk|pk|edu|app|sh|gg|xyz|tech";
/** **bold** · [text](url) · email · bare URL (lower-case TLD so "Next.js" / "Socket.IO" stay plain text). */
const INLINE = new RegExp(
  String.raw`\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:${LINK_TLDS})(?:\/[^\s·,;)]*)?)`,
  "g",
);

function run(text: string, base: Base, extra: Partial<ConstructorParameters<typeof TextRun>[0] & object> = {}) {
  return new TextRun({ text, font: FONT, ...base, ...extra });
}

function link(text: string, href: string, base: Base) {
  return new ExternalHyperlink({ link: href, children: [run(text, base, { color: ACCENT, underline: {} })] });
}

/** Inline Markdown → runs. Bare URLs and emails become clickable so recruiters can open them from Word. */
function inline(text: string, base: Base): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index!;
    if (start > last) out.push(run(text.slice(last, start), base));
    let consumed = m[0];
    if (m[1]) out.push(run(m[1], base, { bold: true }));
    else if (m[2]) out.push(link(m[2], m[3], base));
    else if (m[4]) out.push(link(m[4], `mailto:${m[4]}`, base));
    else {
      // Trailing punctuation belongs to the sentence, not the URL.
      const url = m[5].replace(/[.,;:]+$/, "");
      out.push(link(url, /^https?:\/\//.test(url) ? url : `https://${url}`, base));
      consumed = url;
    }
    last = start + consumed.length;
  }
  if (last < text.length) out.push(run(text.slice(last), base));
  return out;
}

/** `Title — Company · dates` → bold title, plain company, dates right-aligned on a tab stop. */
function roleHeading(text: string): Paragraph {
  const m = /^(.+?) — (.+?) · (.+)$/.exec(text);
  const children: ParagraphChild[] = m
    ? [...inline(m[1], { size: BODY, bold: true }), run(` — ${m[2]}`, { size: BODY }), run("\t", { size: BODY }), run(m[3], { size: BODY, color: GREY })]
    : inline(text, { size: BODY, bold: true });
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children,
    tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
    spacing: { before: 110, after: 20 },
    keepNext: true,
  });
}

export async function markdownToDocx(md: string, kind: "resume" | "letter"): Promise<Buffer> {
  const children: Paragraph[] = [];
  const src = md.replace(/\r\n/g, "\n").split("\n");
  let afterName = false;
  let name = "";

  for (const raw of src) {
    const line = raw.trimEnd();
    if (!line.trim() || /^-{3,}$/.test(line.trim())) {
      afterName = false;
      continue; // spacing comes from paragraph styles, not empty paragraphs
    }
    if (/^#\s+/.test(line)) {
      name = line.replace(/^#\s+/, "").trim();
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: inline(name, { size: 40, bold: true, color: INK }), spacing: { before: 0, after: 30 } }));
      afterName = true;
    } else if (/^##\s+/.test(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: inline(line.replace(/^##\s+/, "").toUpperCase(), { size: 18, bold: true, color: ACCENT }),
          spacing: { before: 150, after: 50 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 2 } },
          keepNext: true,
        }),
      );
      afterName = false;
    } else if (/^###\s+/.test(line)) {
      children.push(roleHeading(line.replace(/^###\s+/, "").trim()));
      afterName = false;
    } else if (/^\s*[-*+]\s+/.test(line)) {
      children.push(
        new Paragraph({
          children: inline(line.replace(/^\s*[-*+]\s+/, ""), { size: BODY, color: INK }),
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 20 },
          contextualSpacing: true,
        }),
      );
    } else if (afterName) {
      // Contact line: in the body (ATSs drop page headers), slightly smaller and grey.
      children.push(new Paragraph({ children: inline(line, { size: 18, color: GREY }), spacing: { after: 60 } }));
    } else {
      children.push(
        new Paragraph({
          children: inline(line, { size: kind === "letter" ? 22 : BODY, color: INK }),
          spacing: { after: kind === "letter" ? 160 : 40 },
          alignment: AlignmentType.LEFT,
        }),
      );
    }
  }

  const doc = new Document({
    creator: "Tailor",
    title: [name, kind === "letter" ? "Cover letter" : "Resume"].filter(Boolean).join(" — "),
    styles: {
      default: { document: { run: { font: FONT, size: BODY, color: INK } } },
      // Real heading styles (so parsers and Word's navigation pane see the structure), restyled to match the PDF.
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 40, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 30 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 18, bold: true, color: ACCENT }, paragraph: { spacing: { before: 150, after: 50 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: BODY, bold: true, color: INK }, paragraph: { spacing: { before: 110, after: 20 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 280, hanging: 200 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { size: PAGE, margin: MARGIN } }, children }],
  });
  return Packer.toBuffer(doc);
}
