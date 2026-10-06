import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import crypto from 'node:crypto';

// GET /api/v1/inbox/:id - Retrieve single notification
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { id } = await params;
  const db = getDb();

  const item = db.prepare(`
    SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM inbox_notifications i
    LEFT JOIN categories c ON i.suggested_category_id = c.id
    WHERE i.id = ? AND i.user_id = ?
  `).get(id, auth.session.userId);

  if (!item) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json({ notification: item });
}

// DELETE /api/v1/inbox/:id - Delete single notification
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { id } = await params;
  const db = getDb();

  // Check IDOR
  const existing = db.prepare(`SELECT * FROM inbox_notifications WHERE id = ?`).get(id) as { user_id: string } | undefined;
  if (!existing) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }
  if (existing.user_id !== auth.session.userId) {
    logAuditEvent({
      userId: auth.session.userId,
      action: 'ACCESS_DENIED_IDOR',
      entityType: 'inbox_notifications',
      entityId: id,
      details: { attempt: 'delete_another_user_notification' },
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare(`DELETE FROM inbox_notifications WHERE id = ?`).run(id);

  logAuditEvent({
    userId: auth.session.userId,
    action: 'INBOX_NOTIFICATION_DELETED',
    entityType: 'inbox_notifications',
    entityId: id,
  });

  return NextResponse.json({ success: true, deletedId: id });
}
