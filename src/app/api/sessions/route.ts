import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  const sessions = db.prepare('SELECT * FROM user_sessions WHERE user_id = ? ORDER BY last_seen DESC').all(userId);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { action, sessionId } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    if (action === 'REVOKE_ONE') {
      db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND user_id = ?').run(now, sessionId, userId);
      logAuditEvent({
        userId,
        action: 'SESSION_REVOKED',
        entityType: 'user_sessions',
        entityId: sessionId,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'Session revoked' });
    }

    if (action === 'REVOKE_ALL_OTHERS') {
      db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND id != ?').run(now, userId, sessionId || 'current');
      logAuditEvent({
        userId,
        action: 'ALL_OTHER_SESSIONS_REVOKED',
        entityType: 'user_sessions',
        entityId: userId,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'All other sessions revoked' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
