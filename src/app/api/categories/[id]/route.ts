import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  const db = getDb();
  const category = db.prepare(`
    SELECT id, user_id, name, icon, color, is_system, parent_id, created_at
    FROM categories
    WHERE id = ?
  `).get(id) as any;

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // IDOR check: if custom category, must belong to authenticated user
  if (category.is_system !== 1 && category.user_id !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Unauthorized category access' } },
      { status: 403 }
    );
  }

  // Count active transactions using this category
  const txCountRow = db.prepare(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL
  `).get(id, userId) as { count: number };

  // Check if category has an active budget
  const budget = db.prepare(`
    SELECT id, amount, period
    FROM budgets
    WHERE category_id = ? AND user_id = ?
  `).get(id, userId) as any;

  return NextResponse.json({
    category,
    transactionCount: txCountRow?.count || 0,
    budget: budget || null,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  const db = getDb();
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // System categories cannot be deleted
  if (category.is_system === 1) {
    return NextResponse.json(
      { error: 'System categories cannot be deleted' },
      { status: 400 }
    );
  }

  // Strict Row-Level IDOR Authorization: User cannot delete another user's category
  if (category.user_id !== userId) {
    logAuditEvent({
      userId,
      action: 'ACCESS_DENIED_IDOR_CATEGORY',
      entityType: 'categories',
      entityId: id,
      details: { attemptedOwner: category.user_id, reason: 'idor_attempt' },
      ipAddress: getClientIp(req),
    });
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to delete this category' } },
      { status: 403 }
    );
  }

  // Parse delete body
  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    // Body is optional if category has 0 transactions
  }

  const { action = 'uncategorized', reassign_to, delete_budget = false } = body;

  // Count and fetch transactions using this category
  const activeTxs = db.prepare(`
    SELECT id FROM transactions
    WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL
  `).all(id, userId) as Array<{ id: string }>;

  const txCount = activeTxs.length;
  const affectedTxIds = activeTxs.map((t) => t.id);

  // If transactions exist and no action was specified or invalid
  if (txCount > 0 && !['reassign', 'uncategorized', 'delete_all'].includes(action)) {
    return NextResponse.json(
      { error: 'Category has transactions. Please specify action: "reassign", "uncategorized", or "delete_all".' },
      { status: 400 }
    );
  }

  let reassignedCount = 0;
  let deletedCount = 0;
  let targetCategoryId: string | null = null;

  // Execute chosen reassignment or soft-delete action
  if (txCount > 0) {
    if (action === 'reassign') {
      if (!reassign_to) {
        return NextResponse.json({ error: 'reassign_to category ID is required for reassign action' }, { status: 400 });
      }
      // Verify target category exists and is system or owned by user
      const targetCat = db.prepare(`
        SELECT id FROM categories WHERE id = ? AND (is_system = 1 OR user_id = ?)
      `).get(reassign_to, userId);
      if (!targetCat) {
        return NextResponse.json({ error: 'Target reassign category does not exist' }, { status: 400 });
      }
      targetCategoryId = reassign_to;
      db.prepare(`
        UPDATE transactions SET category_id = ? WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL
      `).run(targetCategoryId, id, userId);
      reassignedCount = txCount;
    } else if (action === 'uncategorized') {
      // Ensure system uncategorized exists
      targetCategoryId = 'cat_uncategorized';
      db.prepare(`
        INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, is_system, created_at)
        VALUES ('cat_uncategorized', NULL, 'Uncategorized', 'HelpCircle', '#64748B', 1, ?)
      `).run(new Date().toISOString());

      db.prepare(`
        UPDATE transactions SET category_id = ? WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL
      `).run(targetCategoryId, id, userId);
      reassignedCount = txCount;
    } else if (action === 'delete_all') {
      // Soft-delete transactions with 24h grace
      const nowIso = new Date().toISOString();
      db.prepare(`
        UPDATE transactions SET deleted_at = ? WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL
      `).run(nowIso, id, userId);
      deletedCount = txCount;
    }
  }

  // Handle active budget
  const existingBudget = db.prepare('SELECT * FROM budgets WHERE category_id = ? AND user_id = ?').get(id, userId) as any;
  let budgetDeleted = false;
  if (existingBudget && delete_budget) {
    db.prepare('DELETE FROM budgets WHERE category_id = ? AND user_id = ?').run(id, userId);
    budgetDeleted = true;
  }

  // Save Undo snapshot into category_undo_sessions (valid for 30s)
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO category_undo_sessions (
      id, category_id, user_id, category_data, action, reassigned_to, affected_tx_ids, deleted_budget_data, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    id,
    userId,
    JSON.stringify(category),
    action,
    targetCategoryId,
    JSON.stringify(affectedTxIds),
    existingBudget && budgetDeleted ? JSON.stringify(existingBudget) : null,
    now
  );

  // Delete category row from categories table
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);

  // Mandatory Turn / Security Audit Logging: category.delete
  logAuditEvent({
    userId,
    action: 'category.delete',
    entityType: 'categories',
    entityId: id,
    details: {
      category_name: category.name,
      reassigned_to: targetCategoryId,
      transaction_count: txCount,
      reassigned_count: reassignedCount,
      deleted_count: deletedCount,
      budget_deleted: budgetDeleted,
      action,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    deleted: true,
    reassigned_count: reassignedCount,
    deleted_count: deletedCount,
    budget_deleted: budgetDeleted,
    undo_id: id,
    message: `${category.name} deleted.${reassignedCount > 0 ? ` ${reassignedCount} transactions reassigned.` : ''}`,
  });
}
