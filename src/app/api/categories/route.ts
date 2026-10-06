import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { CategoryCreateSchema } from '@/lib/schemas';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  // Return all system categories plus user custom categories with transaction count and active budget
  const categories = db.prepare(`
    SELECT 
      c.id, c.name, c.icon, c.color, c.is_system, c.user_id, c.created_at,
      COUNT(t.id) as transaction_count,
      b.id as budget_id,
      b.amount as budget_amount
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id AND t.user_id = ? AND t.deleted_at IS NULL
    LEFT JOIN budgets b ON c.id = b.category_id AND b.user_id = ?
    WHERE c.is_system = 1 OR c.user_id = ?
    GROUP BY c.id
    ORDER BY c.is_system DESC, c.name ASC
  `).all(userId, userId, userId);

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const body = await req.json();
    const parsed = CategoryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, icon, color } = parsed.data;
    const catId = `cat_custom_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(`
      INSERT INTO categories (id, user_id, name, icon, color, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(catId, userId, name.trim(), icon, color, now);

    logAuditEvent({
      userId,
      action: 'CATEGORY_CREATE',
      entityType: 'categories',
      entityId: catId,
      details: { name: name.trim(), icon, color },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(
      {
        category: {
          id: catId,
          userId,
          name: name.trim(),
          icon,
          color,
          isSystem: false,
          createdAt: now,
        },
        message: 'Category created successfully',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Create category error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
