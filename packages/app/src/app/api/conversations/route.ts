/**
 * Unified Conversations API Route
 *
 * Replaces:
 * - saas: Drizzle ORM → PostgreSQL
 * - busibox: data-api client → data-api service
 *
 * Both now use: platform.data.query/insert/update/delete
 */
import { NextRequest, NextResponse } from 'next/server';
import { initPlatform, getPlatformInstance } from '@/lib/platform';
import type { CollectionSchema } from '@jazzmind/busibox-app/platform/interfaces';

export const runtime = 'nodejs';

const CONVERSATIONS_SCHEMA: CollectionSchema = {
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true },
    { name: 'user_id', type: 'text' },
    { name: 'title', type: 'text', nullable: true },
    { name: 'advisor_key', type: 'text', nullable: true },
    { name: 'created_at', type: 'timestamp' },
    { name: 'updated_at', type: 'timestamp' },
  ],
  indexes: [
    { fields: ['user_id'] },
    { fields: ['updated_at'] },
  ],
};

export async function GET(request: NextRequest) {
  await initPlatform();
  const platform = getPlatformInstance();

  const user = await platform.auth.getCurrentUser(request as unknown as Request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await platform.data.ensureCollection('conversations', CONVERSATIONS_SCHEMA);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);
  const offset = Number(searchParams.get('offset') ?? '0');

  const result = await platform.data.query<Record<string, unknown>>('conversations', {
    filters: [{ field: 'user_id', op: 'eq', value: user.id }],
    sort: [{ field: 'updated_at', direction: 'desc' }],
    limit,
    offset,
  });

  return NextResponse.json({ conversations: result.records, total: result.total });
}

export async function POST(request: NextRequest) {
  await initPlatform();
  const platform = getPlatformInstance();

  const user = await platform.auth.getCurrentUser(request as unknown as Request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await platform.data.ensureCollection('conversations', CONVERSATIONS_SCHEMA);

  const body = await request.json() as { title?: string; advisorKey?: string };
  const now = new Date().toISOString();

  const ids = await platform.data.insert('conversations', [{
    user_id: user.id,
    title: body.title ?? null,
    advisor_key: body.advisorKey ?? null,
    created_at: now,
    updated_at: now,
  }]);

  const conversation = await platform.data.get('conversations', ids[0]);
  return NextResponse.json({ conversation }, { status: 201 });
}
