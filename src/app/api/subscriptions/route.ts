import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  const subscriptions = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_charge_at ASC').all(userId);

  const totalMonthlyMinor = subscriptions.reduce((sum: number, s: any) => sum + s.amount_minor, 0);

  return NextResponse.json({
    subscriptions,
    totalMonthlyMinor,
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { id, action } = await req.json();
    const db = getDb();

    if (action === 'DISMISS') {
      db.prepare('UPDATE subscriptions SET dismissed = 1 WHERE id = ? AND user_id = ?').run(id, userId);
      logAuditEvent({
        userId,
        action: 'SUBSCRIPTION_DISMISS',
        entityType: 'subscriptions',
        entityId: id,
        details: { dismissed: true },
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'Subscription dismissed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
