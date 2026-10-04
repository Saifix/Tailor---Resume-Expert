# Tailor

**Every application, made to measure.** A local job-hunt studio that drives *your own* Claude Code. Paste a job description and get a tailored resume, track every application in a dashboard, and draft LinkedIn messages you copy and send yourself.

- **Local-first.** A Next.js app bound to `127.0.0.1`. Your CVs, job folders and drafts are plain files in `~/Tailor`.
- **No API key.** Each action runs `claude -p` headlessly with the Claude Code login already on your machine.
- **Skill-based.** The tailoring rules live in editable `SKILL.md` files in `~/Tailor/.claude/skills/`.
- **Checks its own work.** After every draft, Tailor checks the result itself and Claude fixes what fails (see below).
- **Asks before guessing.** Claude asks about real gaps instead of inventing experience. Your answers become reusable facts.
- **Paste anything.** Company, title and location are detected from the pasted job description. A link alone is enough: Tailor fetches the posting.
- **Researches online.** Claude looks up the company and finds current learning links and interview-prep reading for your gaps, all cited.
- **Resumes, academic CVs and cover letters**, written in plain, human language. Stock AI phrasing is caught and rewritten automatically.
- **Fully configurable Claude Code**: model, effort, fallback model, web access, standing instructions, and whether to load your own `~/.claude` settings.
- **Voice dictation** into any text field, using the browser's built-in speech recognition. The mic appears on focus or hover.
- **No CV yet?** "Build my first resume": describe yourself (type or dictate, any language) and attach anything you have, such as a LinkedIn PDF, certificates, transcripts, screenshots or old CVs.
  - Claude records the facts it finds in your documents in `extracted.md`.
  - It builds a truthful first resume, self-checks it, and asks you questions to improve it.
- **Application form questions.** Paste the form's own questions ("Why us? (max 600 characters)", "Describe a time…", notice period, salary) when applying or later on the job page's **Form answers** tab.
  - Claude answers each one within its limit and in your voice, using only your real details.
  - Answers that need something only you know are marked for your input instead of guessed.
  - Your replies are saved to `facts.md` for future forms.
- **Extra context when applying.** Add an optional note (a referral, why this company, projects not on your CV) and documents to any application. Claude treats them as true for that job only.

Design: [Figma: brand book, components & screens](https://www.figma.com/design/Dl9gT4Gizx3chdIiN393oV)

## Run it

You need Node 20.9+ and [Claude Code](https://claude.com/claude-code), installed and signed in (run `claude` once).

```bash
npm install
npm run dev            # → http://127.0.0.1:4317
```

On first launch Tailor:
1. creates `~/Tailor`,
2. installs its skills,
3. checks that `claude` is on your PATH (see the Welcome screen).

### From the terminal

```bash
npm run tailor -- ./jd.md --company Vercel --role "Senior Frontend Engineer"
pbpaste | npm run tailor -- - --company Linear        # JD from stdin
```

The CLI talks to the running app and streams each step, check and question. You can also run `cd ~/Tailor && claude` and use the skills directly.

## File formats

| Direction | Formats |
|---|---|
| **Upload a CV** | PDF · Word (`.docx`, converted locally with mammoth) · photo or scan (PNG/JPG/WebP, read by Claude) · Markdown · text |
| **Download** | Resume and cover letter as **PDF** (rendered by your installed Chrome or Edge) or **Word `.docx`** (ATS-friendly layout) · or print from the browser |

Old `.doc` files aren't supported; save them as `.docx` or PDF first.

## Settings → Claude Code

| Setting | What it does |
|---|---|
| Model | Default, Fable, Opus, Sonnet, Haiku or a custom model ID (`--model`). Can be overridden per run on New tailoring. |
| Effort | Low to Max (`--effort`). Can be overridden per run. |
| Fallback model | Used when the main model is overloaded (`--fallback-model`). |
| Search the web | Adds `WebSearch` and `WebFetch`. Enables job links, company research and learning links. |
| Write like a person | Applies the `human-voice` skill and the "sounds human" checks. |
| Use my Claude Code settings | Also loads `~/.claude` settings, hooks and CLAUDE.md (`--setting-sources user,project,local`). |
| Always tell Claude… | Standing instructions (`--append-system-prompt`). |
| Voice dictation language | Speech recognition language for the mic button (`Ctrl+Shift+Space`). |

**Dictation** uses the browser's Web Speech API. It's free with nothing to install, but audio is processed by Google (Chrome) or Microsoft (Edge). Firefox doesn't support it.

## How a tailoring run works

1. **Draft.** Claude follows the `resume-tailor` skill. It reads the JD, your base resume and `resumes/facts.md`, rewrites the resume, then does its own fact-check and self-review.
2. **Self-check.** Tailor renders `resume.md` to a real A4 PDF and checks:
   - page count (1 page with the "One page" option, otherwise 2),
   - every section kept,
   - name and contact line unchanged,
   - **no numbers that aren't in your resume or facts**,
   - ATS-safe formatting,
   - a valid score.
3. **Fix.** Failed checks go back to Claude **in the same conversation**, up to 2 rounds, then everything is re-checked.
4. **Ask.** Claude asks up to 3 questions about must-haves your resume doesn't show, plus 1–3 suggestions.
   - Your answers are saved to `resumes/facts.md` and Claude revises right away.
   - Future runs reuse your answers as true facts.
5. **Follow up anytime.** Use "Ask Claude to change something…" on the result or job page. Outreach drafts have the same box ("Shorter", "Mention my open-source work", …).

Under the hood, `src/lib/claude.ts` spawns:

```
claude -p --output-format stream-json --verbose \
  --tools Read,Write,Edit,Glob,Grep,Skill --permission-mode acceptEdits --permission-prompts none \
  --strict-mcp-config --setting-sources project,local [--resume <session>] [--model …]
```

The run is set up like this:
- The working directory is `~/Tailor`.
- The prompt goes over stdin.
- There's no shell and no web access.

Steps, checks and questions stream to the browser over server-sent events (`/api/runs/:id/stream`).

## What's in `~/Tailor`

```
~/Tailor
├─ resumes/                 base resumes (Markdown), your source of truth
│  ├─ facts.md              answers you gave Claude (reused as true facts)
│  ├─ original/             uploaded PDF / Word / images
│  └─ sources/<you>/        "build my first resume": about.md, intake.md, your documents, extracted.md
├─ jobs/<date>_<company>_<role>/
│  ├─ job-description.md
│  ├─ resume.md             tailored resume (download as PDF or Word)
│  ├─ match-report.md       covered / surfaced / gaps + interview prep
│  ├─ cover-letter.md       if enabled
│  ├─ result.json           match score, keywords, questions (written by the skill)
│  ├─ meta.json             status, timeline, reminders, quality checks
│  ├─ extras/               optional context for this application (note + documents)
│  ├─ form-questions.md     questions pasted from the application form
│  ├─ form-answers.json/.md answers (copy into the form)
│  └─ notes.md
├─ outreach/<name>.md       LinkedIn drafts
├─ .claude/skills/          resume-tailor, academic-cv, cover-letter, human-voice, job-research,
│                           resume-builder, application-answers, ats-keywords, impact-bullets,
│                           outreach-writer, resume-import
└─ tailor.json              settings (name, model, disabled skills)
```

Bundled skills update automatically when the app updates, unless you've edited them. Your edits always win.

## Security notes

- The server listens on `127.0.0.1` only.
- `src/proxy.ts` rejects non-localhost `Host` headers (DNS rebinding) and cross-origin `POST`/`PATCH` requests.
- Claude can only use file tools inside `~/Tailor`.
- Tailor never sends messages for you; outreach is copy and paste.

## Develop

```bash
npm run typecheck && npm run lint
TAILOR_HOME=./.data-test npm run dev     # use a throwaway data folder
```

Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4 (tokens mirror the Figma variables), Motion, lucide-react, mammoth, docx, playwright-core.

## Research behind the skills

The skills are based on current recruiter, ATS-vendor, career-centre and AI-detection research, with sources listed in:
- [`docs/research/resume-and-cover-letters.md`](docs/research/resume-and-cover-letters.md)
- [`docs/research/academic-cv-and-human-voice.md`](docs/research/academic-cv-and-human-voice.md)
