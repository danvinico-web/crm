import { onLeadStatus } from "@/lib/events";
import { ensureDemoTicker } from "@/lib/demoTicker";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** SSE-канал real-time событий (изменения статусов лидов). Требует сессию. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  ensureDemoTicker();
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* поток закрыт */
        }
      };
      send({ type: "ready" });
      unsubscribe = onLeadStatus((e) => send(e));
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          /* поток закрыт */
        }
      }, 20_000);
    },
    cancel() {
      unsubscribe?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
