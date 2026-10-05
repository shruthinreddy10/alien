import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { TransactionCreateSchema } from '@/lib/schemas';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const categoryId = searchParams.get('category')?.trim() || '';
  const type = searchParams.get('type')?.trim() || ''; // 'INCOME' | 'EXPENSE'
  const startDate = searchParams.get('startDate')?.trim() || '';
  const endDate = searchParams.get('endDate')?.trim() || '';
  const minAmount = searchParams.get('minAmount') ? parseInt(searchParams.get('minAmount')!) : null;
  const maxAmount = searchParams.get('maxAmount') ? parseInt(searchParams.get('maxAmount')!) : null;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const db = getDb();

  // Strict Row-Level Authorization: user_id is MANDATORY in all query branches
  const conditions: string[] = ['t.user_id = ?'];
  const params: any[] = [userId];

  if (search) {
    conditions.push('(t.description LIKE ? OR t.notes LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    conditions.push('t.category_id = ?');
    params.push(categoryId);
  }
  if (type === 'INCOME' || type === 'EXPENSE') {
    conditions.push('t.type = ?');
    params.push(type);
  }
  if (startDate) {
    conditions.push('t.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('t.date <= ?');
    params.push(endDate);
  }
  if (minAmount !== null && !isNaN(minAmount)) {
    conditions.push('t.amount >= ?');
    params.push(minAmount);
  }
  if (maxAmount !== null && !isNaN(maxAmount)) {
    conditions.push('t.amount <= ?');
    params.push(maxAmount);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countRow = db.prepare(`
    SELECT COUNT(*) as count 
    FROM transactions t 
    WHERE ${whereClause}
  `).get(...params) as { count: number };
  const total = countRow.count;

  // Get paginated rows with category joins
  const queryParams = [...params, limit, offset];
  const transactions = db.prepare(`
    SELECT 
      t.id,
      t.user_id,
      t.category_id,
      t.amount,
      t.type,
      t.description,
      t.date,
      t.payment_method,
      t.notes,
      t.created_at,
      t.updated_at,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE ${whereClause}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams);

  // Compute summary totals for current user filter
  const summaryRow = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense
    FROM transactions t
    WHERE ${whereClause}
  `).get(...params) as { total_income: number; total_expense: number };

  const totalIncome = summaryRow.total_income;
  const totalExpense = summaryRow.total_expense;
  const netBalance = totalIncome - totalExpense;

  return NextResponse.json({
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalIncome,
      totalExpense,
      netBalance,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const body = await req.json();
    const parsed = TransactionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { categoryId, amount, type, description, date, paymentMethod, notes } = parsed.data;
    const db = getDb();

    // Verify category exists and belongs to system OR current user
    const category = db.prepare(`
      SELECT id FROM categories 
      WHERE id = ? AND (is_system = 1 OR user_id = ?)
    `).get(categoryId, userId);

    if (!category) {
      return NextResponse.json({ error: 'Invalid category selected' }, { status: 400 });
    }

    const txId = `tx_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO transactions (id, user_id, category_id, amount, type, description, date, payment_method, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(txId, userId, categoryId, amount, type, description.trim(), date, paymentMethod, notes || null, now, now);

    logAuditEvent({
      userId,
      action: 'TRANSACTION_CREATE',
      entityType: 'transactions',
      entityId: txId,
      details: { amount, type, description, categoryId, date },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(
      {
        transaction: {
          id: txId,
          userId,
          categoryId,
          amount,
          type,
          description: description.trim(),
          date,
          paymentMethod,
          notes,
          createdAt: now,
        },
        message: 'Transaction created successfully',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Create transaction error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
