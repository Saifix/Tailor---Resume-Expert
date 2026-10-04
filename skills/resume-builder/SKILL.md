---
name: resume-builder
description: Builds a first base resume (or academic CV) for someone who has none — from their own description of themselves plus any documents they attach (LinkedIn PDF, certificates, transcripts, portfolios, letters, screenshots). Truthful, ATS-safe, and asks questions to fill gaps.
---

# Resume builder

The person has **no CV yet** (or doesn't want to use their old one). You build their first base resume — the source of truth every later tailoring run starts from — so accuracy matters more than polish.

## Inputs (in `resumes/sources/<slug>/`)

- `about.md` — their own words: who they are, work history, studies, projects, achievements, skills. May be messy, dictated, or in another language.
- `intake.md` — name, contact details, links, target role(s), location, format and region preferences.
- Documents: PDFs (LinkedIn "Save to PDF" export, old CVs, transcripts, certificates, reference letters, performance reviews), images (photos or screenshots of certificates, portfolio pieces), `*.docx.md` (Word files Tailor converted), `.txt`/`.md` notes. Read **every** document.

## Step 1 — collect facts (write `extracted.md` in the same folder)

Before writing the resume, write `extracted.md`: a plain bullet list of every concrete fact you found in the **documents** (not about.md), grouped by document, copied exactly — job titles, employers, dates, grades, certificate names and IDs, numbers, tools, awards, quotes from references. Write `- (unreadable) <file>` for anything you couldn't read. This file is the audit trail: later checks only accept numbers that appear in the person's own words or here.

## Step 2 — choose the right shape for this person

- **Students / recent graduates:** Education near the top (degree, institution, dates, grade if strong, relevant modules), then Projects, Experience (including part-time, internships, volunteering, tutoring), Skills, Activities/Leadership.
- **Experienced professionals:** Summary → Experience (reverse-chronological) → Skills → Education → Certifications.
- **Career changers / returners:** hybrid — Summary → core Skills → dated Experience (keep an honest "Career break" line for gaps over ~3 months if they mention one). Never purely functional.
- **Freelance, informal or family-business work is real experience** — present it as a role with a sensible title (e.g. "Freelance Web Developer — Self-employed"), only if they described it.
- **Academic:** follow the academic-cv skill's section rules.
- Region: US resume (Letter, no photo/DOB) vs UK/EU CV (A4, no photo/DOB unless they ask for a German/French style).

## Step 3 — write the resume (`resumes/<file>.md`)

```markdown
# Full Name

Target or current title · City, Country · email · phone · linkedin/github/portfolio

## Summary
2–3 lines: who they are, years/level, the 1–2 strongest proof points — aimed at their target role.

## Experience
### Job Title — Organisation · Mon YYYY – Mon YYYY
- Verb + what they did + result (numbers only if they gave them)

## Projects
### Project name — one line on what it is · YYYY
- What they built/did and what came of it

## Skills
**Group:** comma-separated skills they actually have

## Education
### Degree — Institution · YYYY
```

Rules:
1. **Never invent.** No employers, titles, dates, grades, tools, numbers or responsibilities they didn't state or that aren't in a document. If something important is vague, write it plainly and **ask** (Step 4). Better a shorter true resume than an impressive false one.
2. **Turn their words into strong bullets** — action verb, what, result (XYZ) — without adding facts. "I handled the shop's Instagram and sales went up" → "Ran the shop's Instagram account; sales grew after launch" — not "grew sales 40%".
3. Translate to English if they wrote in another language (keep names, titles of qualifications and institutions accurate).
4. If dates are approximate, use the precision they gave ("2022 – 2023").
5. ATS-safe Markdown only: single column, standard headings, no tables/images/emojis/HTML. Contact details in the body.
6. 1 page if under ~5 years of experience, up to 2 pages otherwise (no limit for academic CVs).
7. Follow **human-voice** if asked: plain verbs, no "results-driven", "passionate", "proven track record".
8. Facts that are true but don't fit the resume (hobbies, constraints, salary hopes) stay out of it.

## Step 4 — `result.json` (same folder)

```json
{
  "name": "Full Name",
  "questions": [
    { "id": "shop-sales", "question": "You said sales went up after you took over the shop's Instagram — do you know roughly by how much, or over what period?", "why": "A number would make this your strongest bullet" }
  ],
  "suggestions": ["Add your GitHub link — the weather app you described is a good portfolio piece."]
}
```

- **questions** (2–4): the things that would most improve the resume — missing dates, a likely metric they know, an unclear role title, an undocumented skill they mentioned in passing, a missing contact detail, which roles they're targeting. One-sentence answerable questions; don't ask about things already answered.
- **suggestions** (1–3): things they can do themselves (get a LinkedIn PDF export, ask a former manager for a reference, a certification that fits their target role).

Their answers come back in a follow-up message (also saved to `resumes/facts.md`). Then update the resume, `extracted.md` if needed, and `result.json` (drop answered questions).

Tailor then checks: name + contact line, core sections, **no numbers that aren't in about.md / intake.md / extracted.md / facts**, length, formatting and voice — and sends you fixes if needed. Reply with one short line when done.
