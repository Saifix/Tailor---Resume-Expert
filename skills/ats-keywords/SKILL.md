---
name: ats-keywords
description: Pulls must-have and nice-to-have keywords from a job description and scores how well a resume covers them.
---

# ATS keywords

Used by `resume-tailor` to make keyword extraction and scoring consistent.

## Extract

From the job description, list each keyword **exactly as written in the JD** (keep capitalisation, e.g. "Next.js", "CI/CD", "stakeholder management").

- **Must-have**: appears under requirements / "you have" / "required", or is repeated 2+ times, or is a stated years-of-experience requirement.
- **Nice-to-have**: "bonus", "plus", "preferred", or mentioned once in passing.
- Include: languages, frameworks, platforms, domains (payments, B2B SaaS), methods (A/B testing), seniority signals (mentoring, led, owned), and role-critical soft skills.
- Skip: generic filler ("passionate", "fast-paced", "team player") unless it is the core of the role.
- Merge synonyms into one keyword using the JD's wording (JS / JavaScript → whichever the JD uses).

Aim for 10–20 keywords total.

## Score coverage (0–100)

For each keyword, evidence in the resume is:
- **strong** (1.0): used in a bullet that shows doing the thing, ideally with an outcome,
- **weak** (0.5): only listed under Skills,
- **none** (0).

`score = 70 × (avg evidence over must-haves) + 30 × (avg evidence over nice-to-haves)`, rounded to an integer. If there are no nice-to-haves, use must-haves for 100%.

## Classify for result.json

- `have` — strong or weak evidence in the base resume as written.
- `added` — real evidence existed but used different wording/was buried; after tailoring it is surfaced with the JD's wording.
- `missing` — no honest evidence anywhere. Never add these to the resume.
