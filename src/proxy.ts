import { NextResponse, type NextRequest } from "next/server";

/**
 * Tailor drives your Claude Code and reads your files, so only the app itself may talk to it:
 * - Host must be localhost (blocks DNS-rebinding attacks from random websites).
 * - State-changing API calls must come from the same origin (blocks cross-site POSTs).
 */
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL.has(host)) return new NextResponse("Tailor only answers on localhost.", { status: 403 });

  if (req.method !== "GET" && req.method !== "HEAD" && req.nextUrl.pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
      } catch {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
