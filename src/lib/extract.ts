import { quickAsk } from "./claude";
import { getClaudeConfig } from "./store";

export type Extracted = { company: string; role: string; location: string; jd?: string };
export type ExtractResult = Extracted | { error: string; status: number };

function parseJson(text: string): Record<string, string> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Pull company / job title / location out of a pasted job description — or, with only a link,
 * fetch the posting first (needs web access). Uses a fast model with no file tools.
 */
export async function extractJob(input: { jd?: string; url?: string }): Promise<ExtractResult> {
  const { jd, url } = input;
  const cfg = await getClaudeConfig();
  const wantJd = !(jd && jd.trim().length >= 40);
  const shape = `{"company": "...", "role": "...", "location": "..."${wantJd ? `, "jd": "the job description copied VERBATIM — every responsibility, requirement and nice-to-have exactly as written (not summarised), without site navigation, cookie banners or 'similar jobs'"` : ""}}`;

  let prompt: string;
  let tools: string[] = [];
  if (!wantJd) {
    prompt = `Extract the hiring company, the exact job title and the location from this job posting.\nRespond with ONLY a JSON object, no prose: ${shape}\nUse "" for anything not stated. Don't guess.\n\n<posting>\n${jd!.slice(0, 20_000)}\n</posting>`;
  } else if (url) {
    if (!cfg.web) return { error: "Turn on web access in Settings to fetch job links — or paste the description.", status: 400 };
    tools = ["WebFetch"];
    prompt = `Fetch this job posting with WebFetch: ${url}\nIn your WebFetch prompt, ask for the company, job title, location and the COMPLETE job description text verbatim (all sections, all bullet points, word for word — no summary).\nThen respond with ONLY a JSON object, no prose: ${shape}\nUse "" for anything not stated. If the page isn't a job posting or can't be read, return {"error": "short reason"}.`;
  } else {
    return { error: "Paste a job description or a link", status: 400 };
  }

  const res = await quickAsk(prompt, { model: "haiku", effort: "low", tools });
  const out = parseJson(res.text);
  if (!res.ok || !out) return { error: res.error || "Couldn't read that posting", status: 502 };
  if (out.error) return { error: out.error, status: 422 };
  return { company: (out.company ?? "").trim(), role: (out.role ?? "").trim(), location: (out.location ?? "").trim(), jd: out.jd?.trim() || undefined };
}
