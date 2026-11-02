import { MatchError } from './matches';

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new MatchError('Request body must be valid JSON.', 400);
    }
    throw error;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof MatchError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('Unexpected Match API error:', error);
  return Response.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
}
