import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  const db = getDb();
  const undoSession = db.prepare(`
    SELECT * FROM category_undo_sessions
    WHERE category_id = ? AND user_id = ?
  `).get(id, userId) as any;

  if (!undoSession) {
    return NextResponse.json(
      { error: 'Undo session not found or category already restored.' },
      { status: 404 }
    );
  }

  // Check 30-second window
  const createdAtMs = new Date(undoSession.created_at).getTime();
  const nowMs = Date.now();
  const elapsedSeconds = (nowMs - createdAtMs) / 1000;

  if (elapsedSeconds > 30) {
    return NextResponse.json(
      { error: 'Undo window of 30 seconds has expired.' },
      { status: 400 }
    );
  }

  const category = JSON.parse(undoSession.category_data);
  const affectedTxIds = JSON.parse(undoSession.affected_tx_ids || '[]');
  const budgetData = undoSession.deleted_budget_data ? JSON.parse(undoSession.deleted_budget_data) : null;

  // 1. Restore Category into categories table
  db.prepare(`
    INSERT OR REPLACE INTO categories (id, user_id, name, icon, color, is_system, parent_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category.id,
    category.user_id,
    category.name,
    category.icon,
    category.color,
    category.is_system || 0,
    category.parent_id || null,
    category.created_at
  );

  // 2. Reassign transactions back or restore soft-deleted transactions
  if (affectedTxIds.length > 0) {
    if (undoSession.action === 'reassign' || undoSession.action === 'uncategorized') {
      for (const txId of affectedTxIds) {
        db.prepare('UPDATE transactions SET category_id = ? WHERE id = ? AND user_id = ?').run(category.id, txId, userId);
      }
    } else if (undoSession.action === 'delete_all') {
      for (const txId of affectedTxIds) {
        db.prepare('UPDATE transactions SET deleted_at = NULL WHERE id = ? AND user_id = ?').run(txId, userId);
      }
    }
  }

  // 3. Restore budget if it was deleted
  if (budgetData) {
    db.prepare(`
      INSERT OR REPLACE INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      budgetData.id,
      budgetData.user_id,
      budgetData.category_id,
      budgetData.amount,
      budgetData.period,
      budgetData.created_at,
      budgetData.updated_at
    );
  }

  // 4. Delete the undo session record
  db.prepare('DELETE FROM category_undo_sessions WHERE id = ?').run(undoSession.id);

  // 5. Audit log category.restore
  logAuditEvent({
    userId,
    action: 'category.restore',
    entityType: 'categories',
    entityId: category.id,
    details: {
      category_name: category.name,
      restored_tx_count: affectedTxIds.length,
      budget_restored: !!budgetData,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    restored: true,
    message: `Restored "${category.name}" and reassigned ${affectedTxIds.length} transactions back.`,
  });
}
