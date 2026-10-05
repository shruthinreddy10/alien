import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  const messages = db.prepare(`
    SELECT id, role, content, tool_calls, created_at
    FROM ai_messages
    WHERE user_id = ?
    ORDER BY created_at ASC
    LIMIT 100
  `).all(userId) as Array<{
    id: string;
    role: string;
    content: string;
    tool_calls: string | null;
    created_at: string;
  }>;

  const formatted = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : null,
    createdAt: m.created_at,
  }));

  return NextResponse.json({ messages: formatted });
}
