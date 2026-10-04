/** Optional skills the user can toggle per tailoring run (besides resume-tailor itself). Safe to import in client code. */
export const TAILOR_OPTIONS = [
  { id: "ats-keywords", label: "ATS keywords", default: true },
  { id: "impact-bullets", label: "Impact bullets (XYZ)", default: true },
  { id: "one-page", label: "One page", default: true },
  { id: "match-report", label: "Match report", default: true },
  { id: "cover-letter", label: "Cover letter", default: false },
] as const;

export const TONES = ["Warm", "Direct", "Brief", "Formal"] as const;
export const FORMATS = ["Connection note", "Message", "Email"] as const;
