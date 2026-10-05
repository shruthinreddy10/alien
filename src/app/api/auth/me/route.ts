import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const db = getDb();
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(auth.session.userId) as {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
  } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if user has an encrypted AI API key configured
  const apiKeyRecord = db.prepare('SELECT provider, created_at FROM user_api_keys WHERE user_id = ?').get(user.id) as {
    provider: string;
    created_at: string;
  } | undefined;

  return NextResponse.json({
    user: {
      ...user,
      hasApiKey: !!apiKeyRecord,
      aiProvider: apiKeyRecord ? apiKeyRecord.provider : 'mock',
    },
  });
}
