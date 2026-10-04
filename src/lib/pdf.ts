import { chromium, type Browser } from "playwright-core";

/**
 * Real PDFs (and page counts for the self-check) via the Chrome/Edge already installed on this machine.
 * Uses playwright-core, which downloads nothing. Set TAILOR_BROWSER to a Chromium executable to override.
 */
const g = globalThis as unknown as { __tailorBrowser?: Promise<Browser | null>; __tailorBrowserIdle?: ReturnType<typeof setTimeout> };

async function launch(): Promise<Browser | null> {
  const attempts: Parameters<typeof chromium.launch>[0][] = process.env.TAILOR_BROWSER
    ? [{ executablePath: process.env.TAILOR_BROWSER }]
    : [{ channel: "chrome" }, { channel: "msedge" }, { channel: "chromium" }];
  for (const opts of attempts) {
    try {
      return await chromium.launch({ ...opts, headless: true });
    } catch {
      // try the next browser
    }
  }
  return null;
}

async function browser(): Promise<Browser | null> {
  g.__tailorBrowser ??= launch();
  const b = await g.__tailorBrowser;
  if (b && !b.isConnected()) {
    g.__tailorBrowser = launch();
    return g.__tailorBrowser;
  }
  if (!b) g.__tailorBrowser = undefined; // retry next time (maybe a browser gets installed)
  // Close after a minute of inactivity so we don't keep Chrome running in the background.
  if (g.__tailorBrowserIdle) clearTimeout(g.__tailorBrowserIdle);
  g.__tailorBrowserIdle = setTimeout(async () => {
    const cur = await g.__tailorBrowser;
    g.__tailorBrowser = undefined;
    await cur?.close().catch(() => {});
  }, 60_000);
  g.__tailorBrowserIdle.unref?.();
  return b;
}

export async function renderPdf(url: string): Promise<Buffer | null> {
  const b = await browser();
  if (!b) return null;
  const page = await b.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close().catch(() => {});
  }
}

/** Chromium writes one `/Type /Page` object per page. */
export function countPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}
