import { joinMatch } from '@/lib/server/matches';
import { errorResponse, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { code } = await context.params;
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'A guest player ID and name are required.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const match = joinMatch(code, input.playerId, input.name);
    return Response.json({ match });
  } catch (error) {
    return errorResponse(error);
  }
}
