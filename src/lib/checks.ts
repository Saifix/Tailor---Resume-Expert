// Deterministic quality checks for a tailored resume. Pure functions, no imports — easy to test.

export type CheckResult = { id: string; label: string; ok: boolean; detail?: string; blocking?: boolean };

export type CheckInput = {
  base: string; // base resume markdown
  tailored: string; // tailored resume markdown
  facts?: string; // extra facts the user told Tailor (resumes/facts.md)
  pageLimit: number;
  pages: number | null; // rendered PDF page count, null when no browser is available
  result: unknown; // parsed result.json (or null)
  humanVoice?: boolean;
};

// ───────────────────────── Human voice ─────────────────────────

/**
 * Phrases and tics that make writing read as machine-generated (compiled from editors, recruiters and
 * AI-detection vendors). Matching is case-insensitive on word boundaries.
 */
export const AI_PHRASES = [
  "delve", "delving", "tapestry", "testament to", "a testament", "in today's fast-paced", "fast-paced world", "ever-evolving", "ever-changing landscape",
  "navigate the complexities", "navigating the complexities", "in the realm of", "realm of", "embark on", "embarking on", "journey", "unlock the potential",
  "unlocking", "harness the power", "leverage my", "leveraging my", "synergy", "synergies", "seamlessly", "seamless", "cutting-edge", "game-changer",
  "paradigm", "holistic", "robust", "pivotal", "multifaceted", "meticulous", "meticulously", "underscore", "underscores", "showcasing", "showcase my",
  "i am excited to apply", "i am thrilled", "i am writing to express", "i am writing to apply", "passionate about", "deeply passionate", "resonates with me",
  "aligns perfectly", "perfectly aligns", "uniquely positioned", "proven track record", "results-driven", "dynamic team", "fostering", "foster a culture",
  "furthermore", "moreover", "additionally,", "in conclusion", "it is worth noting", "it's worth noting", "plays a crucial role", "crucial role",
  "vibrant", "bustling", "elevate", "empower", "spearheaded", "thank you for considering my application",
  "unwavering", "garner", "bolster", "intricate", "interplay", "evolving landscape", "serves as a", "stands as a", "valuable insights",
  "i hope this message finds you well", "i hope this finds you well", "ideal candidate", "dream company", "i am confident that my",
  "thank you for your time and consideration",
];

export function aiTells(text: string): string[] {
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = AI_PHRASES.filter((p) => new RegExp(`(^|[^a-z])${escape(p)}([^a-z]|$)`).test(lower));
  const wordCount = Math.max(1, text.split(/\s+/).length);
  const emDashes = (text.match(/—/g) ?? []).length;
  if (emDashes / wordCount > 1 / 60 && emDashes >= 3) found.push(`${emDashes} em dashes`);
  if (/\bnot only\b[^.]{1,80}\bbut also\b/i.test(text)) found.push("“not only … but also”");
  return found;
}

/** Checks for a cover letter (letter = cover-letter.md, sources = resume + facts + JD + research notes). */
export function runLetterChecks(i: { letter: string; sources: string; name?: string; academic?: boolean; humanVoice?: boolean }): CheckResult[] {
  const checks: CheckResult[] = [];
  const body = i.letter.replace(/^#.*$/m, "");
  const wc = words(body);
  const [min, max] = i.academic ? [500, 1100] : [220, 420];
  checks.push({ id: "length", label: i.academic ? "Academic letter length" : "Short enough to be read", ok: wc >= min && wc <= max, detail: `${wc} words (aim for ${min}–${max})`, blocking: true });
  const known = new Set(numbers(`\n\n${i.sources}`));
  const invented = [...new Set(numbers(`\n\n${body}`).filter((n) => !known.has(n)))];
  checks.push({ id: "numbers", label: "No new numbers or claims", ok: invented.length === 0, detail: invented.length ? `Not in your resume, facts or the job post: ${invented.join(", ")}` : undefined, blocking: true });
  const tells = aiTells(body);
  if (i.humanVoice !== false)
    checks.push({ id: "voice", label: "Sounds like you, not AI", ok: tells.length === 0, detail: tells.length ? `Rewrite: ${tells.slice(0, 8).join(", ")}` : "No stock AI phrases", blocking: true });
  const paras = body.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const signed = !!i.name && paras.slice(-3).some((l) => l.replace(/[*_]/g, "").includes(i.name!.split(" ")[0]));
  checks.push({ id: "signoff", label: "Greeting and sign-off", ok: /^(dear|hello|hi)\b/i.test(paras[0] ?? "") && signed, detail: signed ? undefined : "Start with a greeting and end with your name", blocking: true });
  checks.push({ id: "ats", label: "Plain formatting", ok: !/<[a-z][^>]*>|^\s*\|.*\|\s*$|!\[/im.test(body), blocking: true });
  return checks;
}

const lines = (s: string) => s.replace(/\r\n/g, "\n").split("\n");
const words = (s: string) =>
  s
    .replace(/[#*_`>|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

export function sections(md: string): string[] {
  return lines(md)
    .filter((l) => /^##\s+/.test(l) && !/^###/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim().toLowerCase());
}

/** Bullets under each `###` entry (roles, projects…), in document order. */
export function roleBullets(md: string): { role: string; bullets: number }[] {
  const out: { role: string; bullets: number }[] = [];
  let cur: { role: string; bullets: number } | null = null;
  for (const l of lines(md)) {
    if (/^###\s+/.test(l)) {
      cur = { role: l.replace(/^###\s+/, "").trim(), bullets: 0 };
      out.push(cur);
    } else if (/^#{1,2}\s+/.test(l)) cur = null;
    else if (cur && /^\s*[-*+]\s+/.test(l)) cur.bullets++;
  }
  return out;
}

/** "Title — Company · dates" → "title — company" so the same role matches across base and tailored. */
const roleKey = (role: string) => role.split(" · ")[0].replace(/[*_]/g, "").trim().toLowerCase();

/** Numbers that matter for honesty: 4.1, 2, 420, 35, 2016 … (ignores identity block). */
export function numbers(md: string): string[] {
  const body = lines(md).slice(2).join("\n");
  const out: string[] = [];
  for (const m of body.matchAll(/(?<![\w.])(\d+(?:[.,]\d+)?)/g)) out.push(m[1].replace(",", "."));
  return out;
}

export function runChecks(i: CheckInput): CheckResult[] {
  const checks: CheckResult[] = [];
  const wc = words(i.tailored);

  // 1. Page length (academic CVs have no page limit)
  if (i.pageLimit <= 0) {
    checks.push({ id: "pages", label: "Length", ok: true, detail: `Academic CV — no page limit${i.pages != null ? ` · ${i.pages} pages` : ""} (${wc} words)`, blocking: false });
  } else if (i.pages != null) {
    checks.push({
      id: "pages",
      label: i.pageLimit === 1 ? "Fits on one page" : `Fits on ${i.pageLimit} pages`,
      ok: i.pages <= i.pageLimit,
      detail: `Renders to ${i.pages} page${i.pages === 1 ? "" : "s"} on A4 (${wc} words)`,
      blocking: true,
    });
  } else {
    const max = i.pageLimit * 650;
    checks.push({
      id: "pages",
      label: i.pageLimit === 1 ? "Fits on one page" : `Fits on ${i.pageLimit} pages`,
      ok: wc <= max,
      detail: `${wc} words (estimated — no browser available to render a PDF)`,
      blocking: true,
    });
  }

  // 2. Sections kept
  const baseSecs = sections(i.base);
  const newSecs = new Set(sections(i.tailored));
  const missing = baseSecs.filter((s) => !newSecs.has(s));
  checks.push({
    id: "sections",
    label: "All sections kept",
    ok: missing.length === 0,
    detail: missing.length ? `Missing: ${missing.join(", ")}` : `${baseSecs.length} sections`,
    blocking: true,
  });

  // 3. Identity block unchanged
  const id = (md: string) => lines(md).filter((l) => l.trim()).slice(0, 2).map((l) => l.trim());
  const [bn, bc] = id(i.base);
  const [tn, tc] = id(i.tailored);
  const identityOk = bn === tn && bc === tc;
  checks.push({
    id: "identity",
    label: "Name & contact line unchanged",
    ok: identityOk,
    detail: identityOk ? undefined : `Expected:\n${bn}\n${bc}`,
    blocking: true,
  });

  // 4. No numbers that aren't in the base resume or the user's facts
  const known = new Set(numbers(`\n\n${i.base}\n${i.facts ?? ""}`));
  const invented = [...new Set(numbers(i.tailored).filter((n) => !known.has(n)))];
  checks.push({
    id: "numbers",
    label: "No new numbers or metrics",
    ok: invented.length === 0,
    detail: invented.length ? `Not in your base resume: ${invented.join(", ")}` : "Every number traces back to your resume",
    blocking: true,
  });

  // 5. ATS-safe formatting
  const ats: string[] = [];
  if (/^\s*\|.*\|\s*$/m.test(i.tailored)) ats.push("table");
  if (/<[a-z][^>]*>/i.test(i.tailored)) ats.push("HTML");
  if (/!\[/.test(i.tailored)) ats.push("image");
  if (/\p{Extended_Pictographic}/u.test(i.tailored)) ats.push("emoji");
  checks.push({ id: "ats", label: "ATS-safe formatting", ok: ats.length === 0, detail: ats.length ? `Found: ${ats.join(", ")}` : undefined, blocking: true });

  // 6. result.json is valid
  const r = i.result as { matchBefore?: unknown; matchAfter?: unknown; keywords?: { have?: unknown; added?: unknown; missing?: unknown } } | null;
  const resultOk =
    !!r &&
    Number.isFinite(Number(r.matchBefore)) &&
    Number.isFinite(Number(r.matchAfter)) &&
    Array.isArray(r.keywords?.have) &&
    Array.isArray(r.keywords?.added) &&
    Array.isArray(r.keywords?.missing);
  checks.push({ id: "result", label: "Match score saved", ok: resultOk, detail: resultOk ? undefined : "result.json is missing or invalid", blocking: true });

  // 7. Sounds like a person wrote it (advice only for resumes — blocking for letters/messages)
  if (i.humanVoice !== false) {
    const tells = aiTells(i.tailored);
    checks.push({ id: "voice", label: "Sounds human", ok: tells.length === 0, detail: tells.length ? `AI-sounding: ${tells.slice(0, 6).join(", ")}` : undefined, blocking: false });
  }

  // 8. Bullet length (advice only)
  const long = lines(i.tailored).filter((l) => /^\s*[-*]\s/.test(l) && words(l) > 34).length;
  checks.push({ id: "bullets", label: "Bullets are skimmable", ok: long === 0, detail: long ? `${long} bullet${long > 1 ? "s" : ""} over ~2 lines` : undefined, blocking: false });

  // 9. No role left with a single bullet — it reads as an afterthought. Only when the base resume
  //    (or the facts, for roles that aren't in the base) gives Claude more to work with.
  const baseCounts = new Map(roleBullets(i.base).map((r) => [roleKey(r.role), r.bullets]));
  const lonely = roleBullets(i.tailored)
    .filter((r) => r.bullets === 1 && (baseCounts.get(roleKey(r.role)) ?? 2) >= 2)
    .map((r) => r.role.split(" · ")[0].replace(/[*_]/g, ""));
  checks.push({
    id: "roles",
    label: "No role with a lone bullet",
    ok: lonely.length === 0,
    detail: lonely.length ? `Only one bullet under: ${lonely.join("; ")}` : undefined,
    blocking: true,
  });

  return checks;
}

/** Checks for a first resume built from the user's description + documents (sources = everything they gave us). */
export function runBuildChecks(i: { resume: string; sources: string; academic?: boolean; humanVoice?: boolean }): CheckResult[] {
  const checks: CheckResult[] = [];
  const ls = lines(i.resume).filter((l) => l.trim());
  const nameOk = /^#\s+\S/.test(ls[0] ?? "");
  const contactOk = /@|\+?\d[\d\s()-]{7,}|linkedin|github|https?:\/\//i.test(ls[1] ?? "");
  checks.push({ id: "identity", label: "Name & contact line", ok: nameOk && contactOk, detail: nameOk && contactOk ? undefined : "Start with “# Full Name” and a contact line (email, phone or a profile link)", blocking: true });

  const secs = sections(i.resume);
  const has = (re: RegExp) => secs.some((s) => re.test(s));
  const missing = [
    !has(/experience|employment|work|projects|volunteer|research/) && "Experience or Projects",
    !has(/skills|expertise|tools/) && "Skills",
  ].filter(Boolean) as string[];
  checks.push({ id: "sections", label: "Core sections present", ok: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(", ")}` : `${secs.length} sections`, blocking: true });
  if (!has(/education|qualifications|training|courses/)) checks.push({ id: "education", label: "Education", ok: false, detail: "No education section — fine if you have none, otherwise add it", blocking: false });

  const known = new Set(numbers(`\n\n${i.sources}`));
  const invented = [...new Set(numbers(i.resume).filter((n) => !known.has(n)))];
  checks.push({ id: "numbers", label: "Only facts you gave", ok: invented.length === 0, detail: invented.length ? `Not in your description or documents: ${invented.join(", ")}` : "Every number comes from what you told Claude", blocking: true });

  const wc = words(i.resume);
  if (!i.academic) checks.push({ id: "length", label: "Two pages or less", ok: wc <= 1100, detail: `${wc} words`, blocking: true });

  const ats: string[] = [];
  if (/^\s*\|.*\|\s*$/m.test(i.resume)) ats.push("table");
  if (/<[a-z][^>]*>/i.test(i.resume)) ats.push("HTML");
  if (/!\[/.test(i.resume)) ats.push("image");
  if (/\p{Extended_Pictographic}/u.test(i.resume)) ats.push("emoji");
  checks.push({ id: "ats", label: "ATS-safe formatting", ok: ats.length === 0, detail: ats.length ? `Found: ${ats.join(", ")}` : undefined, blocking: true });

  if (i.humanVoice !== false) {
    const tells = aiTells(i.resume);
    checks.push({ id: "voice", label: "Sounds human", ok: tells.length === 0, detail: tells.length ? `AI-sounding: ${tells.slice(0, 6).join(", ")}` : undefined, blocking: false });
  }
  return checks;
}

// ───────────────────────── Application form answers ─────────────────────────

type AnswerItem = { id: string; question: string; answer: string; limit?: { n: number; unit: "characters" | "words" }; needsInput?: string };

/** "(max 500 characters)", "in 150 words or less", "Limit: 1,000 chars" → { n, unit } */
export function parseLimit(question: string): AnswerItem["limit"] {
  const m = /(\d[\d,]*)\s*(characters?|chars?|words?)\b/i.exec(question);
  if (!m) return undefined;
  return { n: Number(m[1].replace(/,/g, "")), unit: /^w/i.test(m[2]) ? "words" : "characters" };
}

export function answerLength(answer: string, unit: "characters" | "words") {
  return unit === "words" ? answer.split(/\s+/).filter(Boolean).length : answer.length;
}

export function runAnswerChecks(i: { items: AnswerItem[]; questionsText: string; sources: string; humanVoice?: boolean }): CheckResult[] {
  const checks: CheckResult[] = [];
  const label = (it: AnswerItem, idx: number) => `Q${idx + 1}`;

  // Every pasted question answered (or flagged as needing the user's input)
  const unanswered = i.items.filter((it) => !it.answer.trim() && !it.needsInput);
  checks.push({ id: "complete", label: "Every question answered", ok: unanswered.length === 0 && i.items.length > 0, detail: i.items.length ? (unanswered.length ? `Empty: ${unanswered.map((it) => it.question.slice(0, 40)).join("; ")}` : `${i.items.length} answers`) : "No answers written", blocking: true });

  // Word / character limits (Claude's parse, or ours from the question text)
  const over = i.items
    .map((it, idx) => {
      const lim = it.limit ?? parseLimit(it.question);
      if (!lim) return null;
      const len = answerLength(it.answer, lim.unit);
      return len > lim.n ? `${label(it, idx)}: ${len}/${lim.n} ${lim.unit}` : null;
    })
    .filter(Boolean) as string[];
  checks.push({ id: "limits", label: "Within each limit", ok: over.length === 0, detail: over.length ? over.join(" · ") : undefined, blocking: true });

  // No numbers the candidate never gave us
  const known = new Set(numbers(`\n\n${i.sources}\n${i.questionsText}`));
  const invented = [...new Set(i.items.flatMap((it) => numbers(`\n\n${it.answer}`)).filter((n) => !known.has(n)))];
  checks.push({ id: "numbers", label: "No new numbers or claims", ok: invented.length === 0, detail: invented.length ? `Not in your resume, facts or the job post: ${invented.join(", ")}` : undefined, blocking: true });

  // Sounds like a person
  if (i.humanVoice !== false) {
    const tells = i.items.flatMap((it, idx) => aiTells(it.answer).map((t) => `${label(it, idx)} “${t}”`));
    checks.push({ id: "voice", label: "Sounds like you, not AI", ok: tells.length === 0, detail: tells.length ? tells.slice(0, 8).join(", ") : undefined, blocking: true });
  }
  return checks;
}

export function issuesForClaude(checks: CheckResult[]): string {
  return checks
    .filter((c) => !c.ok && c.blocking)
    .map((c) => {
      switch (c.id) {
        case "pages":
          return `- Length: ${c.detail}. It must fit the page limit — tighten older roles, merge or cut the least relevant bullets, shorten the summary. Do not remove sections.`;
        case "sections":
          return `- ${c.detail}. Every section of the base resume must stay (shorten it instead).`;
        case "identity":
          return `- The name and contact line must be exactly as in the base resume.\n${c.detail}`;
        case "numbers":
          return `- ${c.detail}. Remove or rephrase anything not stated in the base resume or resumes/facts.md. Never invent metrics.`;
        case "ats":
          return `- Formatting: ${c.detail ?? "use plain text"}. Use plain Markdown headings and bullets only.`;
        case "voice":
          return `- Voice: ${c.detail}. Rewrite those parts the way the candidate would actually say them — plain words, specific details, varied sentence length (see the human-voice skill).`;
        case "length":
          return `- Length: ${c.detail}. Cut filler and generic sentences first; keep the specific proof.`;
        case "signoff":
          return `- ${c.detail}.`;
        case "education":
          return `- ${c.detail}.`;
        case "limits":
          return `- Over the limit: ${c.detail}. Shorten those answers to stay under ~95% of the limit — cut filler, keep the specific proof.`;
        case "complete":
          return `- ${c.detail}. Answer every question, or mark it "needsInput" if only the candidate knows the answer.`;
        case "result":
          return `- result.json is missing or invalid — rewrite it with the exact shape from the skill.`;
        case "roles":
          return `- ${c.detail}. A role with one bullet looks like an afterthought. Give each of those roles 2–3 bullets from the base resume or facts (shorten other bullets or the Skills section to make room), or — only for an old or unrelated role — fold it into a single line with no bullets.`;
        default:
          return `- ${c.label}: ${c.detail ?? "failed"}`;
      }
    })
    .join("\n");
}
