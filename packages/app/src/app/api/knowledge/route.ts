/**
 * Unified Knowledge / Search API Route
 *
 * Replaces:
 * - saas: PostgreSQL FTS (postgres-provider.ts)
 * - busibox: search-api (BusiboxKnowledgeProvider)
 *
 * Both now use: platform.search.search()
 */
import { NextRequest, NextResponse } from 'next/server';
import { initPlatform, getPlatformInstance } from '@/lib/platform';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  await initPlatform();
  const platform = getPlatformInstance();

  const user = await platform.auth.getCurrentUser(request as unknown as Request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
  };

  if (!body.query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const results = await platform.search.search({
    query: body.query,
    collections: body.collections,
    mode: body.mode ?? 'hybrid',
    limit: Math.min(body.limit ?? 10, 50),
  });

  return NextResponse.json({ results });
}
