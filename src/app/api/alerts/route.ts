import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  const alerts = db.prepare('SELECT * FROM anomaly_alerts WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { id, action } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    if (action === 'ACKNOWLEDGE') {
      db.prepare('UPDATE anomaly_alerts SET acknowledged_at = ? WHERE id = ? AND user_id = ?').run(now, id, userId);
      logAuditEvent({
        userId,
        action: 'ANOMALY_ACKNOWLEDGE',
        entityType: 'anomaly_alerts',
        entityId: id,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'Alert acknowledged' });
    }

    if (action === 'DISMISS') {
      db.prepare('UPDATE anomaly_alerts SET dismissed_at = ? WHERE id = ? AND user_id = ?').run(now, id, userId);
      logAuditEvent({
        userId,
        action: 'ANOMALY_DISMISS',
        entityType: 'anomaly_alerts',
        entityId: id,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'Alert dismissed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
