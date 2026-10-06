import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import { detectAnomaliesForTransaction } from '@/lib/anomaly-detector';
import crypto from 'node:crypto';

// POST /api/v1/inbox/bulk-confirm - Confirm multiple notifications or all high confidence
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.authenticated || !auth.user) return auth.response;

  const db = getDb();
  let idsToConfirm: string[] = [];

  try {
    const body = await req.json();
    if (Array.isArray(body.ids)) {
      idsToConfirm = body.ids;
    } else if (body.onlyHighConfidence) {
      // Find all pending high confidence notifications
      const highRows = db.prepare(`
        SELECT id FROM inbox_notifications 
        WHERE user_id = ? AND status = 'PENDING' AND confidence = 'HIGH'
      `).all(auth.user.id) as { id: string }[];
      idsToConfirm = highRows.map(r => r.id);
    }
  } catch (_) {
    // If empty body, default to confirming all pending high confidence
    const highRows = db.prepare(`
      SELECT id FROM inbox_notifications 
      WHERE user_id = ? AND status = 'PENDING' AND confidence = 'HIGH'
    `).all(auth.user.id) as { id: string }[];
    idsToConfirm = highRows.map(r => r.id);
  }

  if (idsToConfirm.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: 'No eligible notifications to confirm' });
  }

  const now = new Date().toISOString();
  let confirmedCount = 0;

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const id of idsToConfirm) {
      const notif = db.prepare(`
        SELECT * FROM inbox_notifications 
        WHERE id = ? AND user_id = ? AND status = 'PENDING'
      `).get(id, auth.user.id) as {
        id: string;
        user_id: string;
        source: string;
        amount_minor: number;
        merchant: string;
        suggested_category_id: string | null;
        received_at: string;
      } | undefined;

      if (!notif) continue;

      const txId = `tx_${crypto.randomUUID()}`;
      const txDate = notif.received_at ? notif.received_at.split('T')[0] : now.split('T')[0];
      const categoryId = notif.suggested_category_id || 'cat_food';
      const paymentMethod = notif.source === 'UPI' ? 'UPI' : notif.source === 'CARD' ? 'Credit Card' : 'Net Banking';

      // Insert transaction
      db.prepare(`
        INSERT INTO transactions (
          id, user_id, category_id, amount, type, description, date,
          payment_method, notes, tags, receipt_key, is_recurring, recurrence_rule,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'EXPENSE', ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
      `).run(
        txId,
        auth.user.id,
        categoryId,
        notif.amount_minor,
        notif.merchant,
        txDate,
        paymentMethod,
        `Bulk-confirmed from ${notif.source} notification`,
        JSON.stringify(['inbox_confirmed', notif.source.toLowerCase()]),
        now,
        now
      );

      // Update notification
      db.prepare(`
        UPDATE inbox_notifications 
        SET status = 'CONFIRMED', confirmed_at = ?, transaction_id = ? 
        WHERE id = ?
      `).run(now, txId, id);

      confirmedCount++;

      try {
        detectAnomaliesForTransaction(txId);
      } catch (_) {}
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  logAuditEvent({
    userId: auth.user.id,
    action: 'INBOX_BULK_CONFIRMED',
    entityType: 'inbox_notifications',
    details: { count: confirmedCount },
  });

  return NextResponse.json({
    success: true,
    confirmedCount,
    message: `Successfully confirmed ${confirmedCount} notifications`,
  });
}
