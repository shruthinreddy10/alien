import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import { detectAnomaliesForTransaction } from '@/lib/anomaly-detector';
import crypto from 'node:crypto';

// POST /api/v1/inbox/:id/confirm - Convert inbox notification to real transaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { id } = await params;
  const db = getDb();

  const notif = db.prepare(`SELECT * FROM inbox_notifications WHERE id = ?`).get(id) as {
    id: string;
    user_id: string;
    source: string;
    amount_minor: number;
    merchant: string;
    raw_payload: string;
    suggested_category_id: string | null;
    status: string;
    received_at: string;
  } | undefined;

  if (!notif) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  // IDOR protection
  if (notif.user_id !== auth.session.userId) {
    logAuditEvent({
      userId: auth.session.userId,
      action: 'ACCESS_DENIED_IDOR',
      entityType: 'inbox_notifications',
      entityId: id,
      details: { attempt: 'confirm_another_user_notification' },
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse custom overrides from body if user chose to edit before confirming
  let customCategoryId = notif.suggested_category_id || 'cat_misc';
  let customMerchant = notif.merchant;
  let customNotes: string | null = null;
  let customPaymentMethod = notif.source === 'UPI' ? 'UPI' : notif.source === 'CARD' ? 'Credit Card' : 'Net Banking';

  try {
    const body = await req.json();
    if (body.categoryId) customCategoryId = body.categoryId;
    if (body.merchant) customMerchant = body.merchant;
    if (body.notes) customNotes = body.notes;
    if (body.paymentMethod) customPaymentMethod = body.paymentMethod;
  } catch (_) {
    // Body is optional
  }

  const txId = `tx_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const txDate = notif.received_at ? notif.received_at.split('T')[0] : now.split('T')[0];

  // Atomic database transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Create real transaction in ledger
    db.prepare(`
      INSERT INTO transactions (
        id, user_id, category_id, amount, type, description, date,
        payment_method, notes, tags, receipt_key, is_recurring, recurrence_rule,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'EXPENSE', ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
    `).run(
      txId,
      auth.session.userId,
      customCategoryId,
      notif.amount_minor,
      customMerchant,
      txDate,
      customPaymentMethod,
      customNotes || `Auto-confirmed from ${notif.source} notification`,
      JSON.stringify(['inbox_confirmed', notif.source.toLowerCase()]),
      now,
      now
    );

    // 2. Mark notification as CONFIRMED
    db.prepare(`
      UPDATE inbox_notifications
      SET status = 'CONFIRMED', confirmed_at = ?, transaction_id = ?
      WHERE id = ?
    `).run(now, txId, id);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // 3. Run anomaly detection check
  try {
    detectAnomaliesForTransaction(auth.session.userId, txId);
  } catch (_) {}

  // 4. Audit log
  logAuditEvent({
    userId: auth.session.userId,
    action: 'INBOX_NOTIFICATION_CONFIRMED',
    entityType: 'inbox_notifications',
    entityId: id,
    details: {
      transactionId: txId,
      amount: notif.amount_minor,
      merchant: customMerchant,
      category: customCategoryId,
      source: notif.source,
    },
  });

  const createdTx = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(txId);

  return NextResponse.json({
    success: true,
    notificationId: id,
    transaction: createdTx,
  });
}
