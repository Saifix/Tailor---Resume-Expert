export type DiffLine = { kind: "same" | "add" | "del"; text: string };

/** Minimal line diff (LCS). Resumes are small, so O(n·m) is fine. */
export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.replace(/\r\n/g, "\n").split("\n");
  const B = b.replace(/\r\n/g, "\n").split("\n");
  const n = A.length;
  const m = B.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i].trim() === B[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i].trim() === B[j].trim()) {
      out.push({ kind: "same", text: B[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "del", text: A[i++] });
    else out.push({ kind: "add", text: B[j++] });
  }
  while (i < n) out.push({ kind: "del", text: A[i++] });
  while (j < m) out.push({ kind: "add", text: B[j++] });
  return out;
}

/** Set of normalised lines in `b` that are new compared to `a` — used to highlight tailored bullets. */
export function changedLines(a: string, b: string): Set<string> {
  return new Set(
    diffLines(a, b)
      .filter((d) => d.kind === "add" && d.text.trim())
      .map((d) => norm(d.text)),
  );
}

export const norm = (s: string) => s.replace(/^[-*]\s+/, "").replace(/\s+/g, " ").trim();
