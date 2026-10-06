import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

// POST /api/v1/inbox/:id/ignore - Dismiss notification
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.authenticated || !auth.user) return auth.response;

  const { id } = await params;
  const db = getDb();

  const notif = db.prepare(`SELECT * FROM inbox_notifications WHERE id = ?`).get(id) as {
    user_id: string;
    merchant: string;
    amount_minor: number;
  } | undefined;

  if (!notif) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  if (notif.user_id !== auth.user.id) {
    logAuditEvent({
      userId: auth.user.id,
      action: 'ACCESS_DENIED_IDOR',
      entityType: 'inbox_notifications',
      entityId: id,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare(`UPDATE inbox_notifications SET status = 'IGNORED' WHERE id = ?`).run(id);

  logAuditEvent({
    userId: auth.user.id,
    action: 'INBOX_NOTIFICATION_IGNORED',
    entityType: 'inbox_notifications',
    entityId: id,
    details: { merchant: notif.merchant, amount: notif.amount_minor },
  });

  return NextResponse.json({ success: true, notificationId: id, status: 'IGNORED' });
}
