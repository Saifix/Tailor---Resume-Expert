---
name: resume-import
description: Converts an uploaded CV (PDF, Word, scanned image, text) into a clean, structured Markdown base resume in resumes/.
---

# Resume import

Turn the uploaded file in `resumes/original/` into a clean Markdown base resume.

1. Read the original file with the Read tool:
   - **PDF** and **images** (`.png`, `.jpg`, `.webp` — e.g. a photo or scan of a CV): read them directly; for images, transcribe the text carefully.
   - **`*.docx.md`**: a Word file Tailor already converted to rough Markdown — clean it up into the structure below.
   If the file is unreadable or isn't a CV, say so in one line and stop without writing anything.
2. Write the target file you were given (e.g. `resumes/master.md`) using exactly this structure:

```markdown
# Full Name

Title · City, Country · email · phone · linkedin/github/site

## Summary
2–4 lines, as written in the original.

## Experience

### Job Title — Company · Mon YYYY – Mon YYYY
- Bullet as written
- …

## Projects
### Name — one-line description
- …

## Skills
Comma-separated, grouped on lines if the original groups them (e.g. **Languages:** …)

## Education
### Degree — School · YYYY
```

Rules:
- **Preserve every fact, number and date exactly.** Do not improve, rewrite or tailor anything — this is the source of truth that later tailoring draws from. Fix only obvious extraction artefacts (broken hyphenation, page headers/footers, stray bullets).
- Omit sections that don't exist in the original; keep extra sections (Certifications, Publications, Languages, Volunteering) as `##` sections.
- Keep it ATS-safe: no tables, HTML, images or emojis.

Reply with one line: the name, number of roles, and word count.
