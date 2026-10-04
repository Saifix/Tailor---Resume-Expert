---
name: job-research
description: Use web search to research the hiring company and find current, high-quality learning resources for the candidate's gaps and interview prep — returned as cited links in result.json, never mixed into the candidate's experience.
---

# Job research (web)

Only when web access is ON (WebSearch / WebFetch available). Keep it focused: **4–8 searches total**, then stop.

## 1. The company (2–4 links)

Find things that help the candidate *tailor and talk about the job*:
- what the team/product in the JD actually does, recent launches or announcements (prefer the last 12 months),
- engineering/design blog posts, talks or docs related to the JD's main tech or problem,
- stated values or hiring principles, if the company publishes them.

Prefer first-party sources (company site, blog, docs, newsroom, the hiring manager's own posts) and reputable press. Skip aggregator spam, SEO listicles and paywalled pages you can't read.

## 2. Learning links for the gaps (1–2 per gap, max 6)

For each *missing* must-have keyword, find the best **current** resource to close or credibly discuss the gap:
- official docs / guides (e.g. web.dev for Core Web Vitals, MDN, framework docs),
- a well-regarded free course or tutorial, or a small project idea with a guide,
- prefer material updated in the last ~2 years; check the page date when visible.

## 3. Interview prep (1–3 links, optional)

E.g. the company's own interview guide, engineering ladder or a respected write-up of their process.

## Rules

- **Read before you cite.** Only include a URL you actually opened or saw in results with a clear title. Never invent URLs, titles or dates.
- **Research is for the candidate, not the resume.** Never write web findings into `resume.md` as the candidate's experience. The cover letter may reference a real company detail you found.
- Summaries are one short line in plain language (follow human-voice if enabled).
- If the web is unhelpful, return fewer links — empty arrays are fine.

## Output — add to result.json

```json
"research": {
  "company": [
    { "title": "Vercel — Fluid compute announcement", "url": "https://vercel.com/blog/…", "note": "New default runtime; matches the JD's Edge/serverless focus" }
  ],
  "learn": [
    { "topic": "Core Web Vitals", "title": "web.dev — Optimize INP", "url": "https://web.dev/articles/optimize-inp", "kind": "docs", "note": "Official guide, updated 2025" }
  ],
  "interview": [
    { "title": "How we hire engineers", "url": "https://…", "note": "Their own process write-up" }
  ]
}
```

`kind` is one of: course, docs, article, video, project, book.
