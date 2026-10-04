---
name: application-answers
description: Answers the extra questions on a job application form (motivation, behavioural, short factual, yes/no) — truthful, within each word/character limit, in the candidate's own voice — and flags anything only the candidate can answer.
---

# Application form answers

Application forms ask their own questions on top of the CV: "Why do you want to work here?", "Describe a time you…", "What are your salary expectations?", "Are you authorised to work in the UK?". The user pastes them; you answer every one so they can copy-paste.

## Inputs

- `<job folder>/form-questions.md` — the pasted questions (possibly several batches, possibly messy: numbered, with limits like "(max 500 characters)", options lists, or copied form HTML/text).
- The job description, the tailored resume (or base resume), `resumes/facts.md`, the candidate's sources (if given), this job's `extras/` (referral, motivation, projects) and company research (if given).
- An existing `<job folder>/form-answers.json` — keep those answers unless the user asks to change them; answer new questions.

## How to answer — by question type

| Type | Examples | How |
|---|---|---|
| **Motivation / why us** | Why this company/role? What interests you? | 80–150 words unless a limit is given. One specific, true reason tied to *this* company (product, mission, a detail from the JD or research, a referral from extras) + one proof point that shows fit. No flattery. |
| **Behavioural / competency** | Tell us about a time you… · Describe a challenge… | STAR, compressed: situation (1 sentence), task, what *you* did (most of it), result (numbers only if in the sources). 150–250 words unless limited. Pick the most relevant real story from the resume/facts/extras. |
| **Experience check** | How many years of X? Have you used Y? | One or two sentences, exact and honest. "About 3 years (2022–present)" — computed from resume dates. If they don't have it, say so plainly and mention the closest real experience. |
| **Short factual / logistics** | Notice period · Start date · Salary expectations · Visa / right to work · Relocation · Hybrid days · References | Only from sources. If not stated anywhere, **don't guess** — put a placeholder like `[your notice period]` in the answer and set `needsInput` to a short question ("What's your notice period?"). |
| **Yes/No or choice** | Willing to travel? (Yes/No) · Pick one | Choose only if the sources support it; add a short clarifying phrase if allowed. Otherwise `needsInput`. |
| **Sensitive / legal** | Demographics, disability, criminal record, EEO surveys | Never answer for them. Answer: "To be completed by you" and set `needsInput`. |
| **Open "anything else?"** | Additional information | 2–3 sentences of something genuinely useful not covered elsewhere (a referral, relevant portfolio, availability) — or "Nothing further — thank you." |

## Rules

1. **Truth only.** Every fact, number, employer, tool and story must come from the inputs. If a strong answer needs a detail you don't have, write the best honest answer and add a `needsInput` question for that detail.
2. **Respect limits.** If a question states a limit (characters or words), stay under ~95% of it. Put the parsed limit in `limit`. Characters include spaces.
3. **Consistency.** Dates, titles and numbers must match the resume exactly; don't contradict the cover letter.
4. **Human voice:** first person, plain words, contractions fine, specific details, no "I am passionate about", "leverage", "proven track record", "I am confident that". Follow the human-voice skill if asked.
5. **Mirror the question's wording** in your first sentence so screeners see a direct answer.
6. Plain text only (no Markdown inside answers) — form fields don't render it. Paragraph breaks are fine.
7. **The answer is pasted straight into the form — write only what the employer should read.** Never put notes to the candidate inside an answer ("I don't have exact numbers, so…", "You may want to add…", "Note:"). Anything you want to tell or ask the candidate goes in `needsInput`.

## Output

`<job folder>/form-answers.json` — valid JSON:

```json
{
  "items": [
    {
      "id": "q1",
      "question": "Why do you want to join Daraz? (max 600 characters)",
      "answer": "I want to work on 11.11 …",
      "limit": { "n": 600, "unit": "characters" }
    },
    {
      "id": "q2",
      "question": "What is your notice period?",
      "answer": "[your notice period]",
      "needsInput": "What's your notice period at your current role?"
    }
  ]
}
```

Keep the questions' original order and wording (clean up numbering/markup). Also write `<job folder>/form-answers.md` — each question as a heading followed by its answer — for easy reading.

Tailor checks every answer (limits, no new numbers, AI-sounding phrases, nothing left empty) and may send you fixes. When the user supplies missing details, replace the placeholders and clear `needsInput`. Reply with one short line.
