import {
  connectPlayerToMatch,
  getMatchForPlayer,
  MatchError,
  subscribeToMatch,
  type PublicMatch,
} from '@/lib/server/matches';
import { errorResponse } from '@/lib/server/http';

export const runtime = 'nodejs';

const encoder = new TextEncoder();

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { code } = await context.params;
    const playerId = new URL(request.url).searchParams.get('playerId');
    if (!playerId) {
      throw new MatchError('A guest player ID is required.', 400);
    }
    const releasePresence = connectPlayerToMatch(code, playerId);
    let initialMatch: PublicMatch;
    try {
      initialMatch = getMatchForPlayer(code, playerId);
    } catch (error) {
      releasePresence();
      throw error;
    }
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const unsubscribe = subscribeToMatch(code, playerId, (match) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(match)}\n\n`));
          } catch {
            cleanup();
          }
        });

        const finish = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          releasePresence();
          request.signal.removeEventListener('abort', finish);
          try {
            controller.close();
          } catch {
            // The client may have already cancelled the stream.
          }
        };
        cleanup = finish;

        const heartbeat = setInterval(() => {
          if (closed) return;
          try {
            getMatchForPlayer(code, playerId);
            controller.enqueue(encoder.encode(': keep-alive\n\n'));
          } catch (error) {
            if (!(error instanceof MatchError)) {
              console.error('Unexpected Match event stream error:', error);
            }
            try {
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
                error: error instanceof Error ? error.message : 'Match connection failed.',
              })}\n\n`));
            } catch {
              // The client may have already cancelled the stream.
            }
            finish();
          }
        }, 1000);

        request.signal.addEventListener('abort', finish, { once: true });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMatch)}\n\n`));
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
