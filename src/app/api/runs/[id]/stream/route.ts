import { getRun, subscribe, type RunEvent } from "@/lib/claude";

export async function GET(req: Request, ctx: RouteContext<"/api/runs/[id]/stream">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "Run not found (it may have finished a while ago)" }, { status: 404 });

  const enc = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: RunEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
          if (e.type === "status" && (e.status === "done" || e.status === "error" || e.status === "stopped")) {
            cleanup();
            controller.close();
          }
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        unsubscribe?.();
        if (ping) clearInterval(ping);
      };
      controller.enqueue(enc.encode(`event: meta\ndata: ${JSON.stringify({ id: run.id, kind: run.kind, ref: run.ref, startedAt: run.startedAt })}\n\n`));
      unsubscribe = subscribe(run, send);
      ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15_000);
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      unsubscribe?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
