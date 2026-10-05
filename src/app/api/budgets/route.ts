import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { BudgetSchema } from '@/lib/schemas';
import { logAuditEvent } from '@/lib/security';
import { calculateBudgetStatus } from '@/lib/money';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();

  // Current month bounds (e.g. '2026-10-01' to '2026-10-31')
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMonthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  // Fetch all budgets for current user
  const budgets = db.prepare(`
    SELECT b.id, b.user_id, b.category_id, b.amount as limit_amount, b.period, b.created_at,
           c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ?
    ORDER BY b.category_id IS NULL DESC, b.amount DESC
  `).all(userId) as Array<{
    id: string;
    user_id: string;
    category_id: string | null;
    limit_amount: number;
    period: string;
    created_at: string;
    category_name: string | null;
    category_icon: string | null;
    category_color: string | null;
  }>;

  // Calculate actual spending for each budget
  const enrichedBudgets = budgets.map((b) => {
    let spentQuery: string;
    let queryParams: any[];

    if (b.category_id) {
      // Category-specific budget
      spentQuery = `
        SELECT COALESCE(SUM(amount), 0) as spent
        FROM transactions
        WHERE user_id = ? 
          AND category_id = ?
          AND type = 'EXPENSE'
          AND date >= ? AND date < ?
      `;
      queryParams = [userId, b.category_id, currentMonthStart, currentMonthEnd];
    } else {
      // Overall monthly budget
      spentQuery = `
        SELECT COALESCE(SUM(amount), 0) as spent
        FROM transactions
        WHERE user_id = ? 
          AND type = 'EXPENSE'
          AND date >= ? AND date < ?
      `;
      queryParams = [userId, currentMonthStart, currentMonthEnd];
    }

    const spentRow = db.prepare(spentQuery).get(...queryParams) as { spent: number };
    const spentCents = spentRow ? spentRow.spent : 0;
    const { status, percentage, remainingCents } = calculateBudgetStatus(spentCents, b.limit_amount);

    return {
      id: b.id,
      categoryId: b.category_id,
      categoryName: b.category_name || 'Overall Monthly Budget',
      categoryIcon: b.category_icon || 'PieChart',
      categoryColor: b.category_color || '#6366F1',
      limitAmount: b.limit_amount,
      spentAmount: spentCents,
      remainingAmount: remainingCents,
      percentage,
      status,
      period: b.period,
    };
  });

  return NextResponse.json({ budgets: enrichedBudgets });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const body = await req.json();
    const parsed = BudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { categoryId, amount, period } = parsed.data;
    const db = getDb();
    const now = new Date().toISOString();

    // Check if category exists if provided
    if (categoryId) {
      const category = db.prepare('SELECT id FROM categories WHERE id = ? AND (is_system = 1 OR user_id = ?)').get(categoryId, userId);
      if (!category) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
    }

    // Check existing budget for this user & category & period
    let existing;
    if (categoryId) {
      existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND category_id = ? AND period = ?').get(userId, categoryId, period) as { id: string } | undefined;
    } else {
      existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND category_id IS NULL AND period = ?').get(userId, period) as { id: string } | undefined;
    }

    let budgetId: string;
    if (existing) {
      budgetId = existing.id;
      db.prepare('UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(amount, now, budgetId, userId);
    } else {
      budgetId = `bdg_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(budgetId, userId, categoryId || null, amount, period, now, now);
    }

    logAuditEvent({
      userId,
      action: existing ? 'BUDGET_UPDATE' : 'BUDGET_CREATE',
      entityType: 'budgets',
      entityId: budgetId,
      details: { categoryId: categoryId || 'overall', amount, period },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      budget: {
        id: budgetId,
        userId,
        categoryId: categoryId || null,
        amount,
        period,
      },
      message: 'Budget saved successfully',
    });
  } catch (err: unknown) {
    console.error('Save budget error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
