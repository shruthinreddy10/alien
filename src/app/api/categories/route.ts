import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { CategoryCreateSchema } from '@/lib/schemas';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  // Return all system categories plus user custom categories
  const categories = db.prepare(`
    SELECT id, name, icon, color, is_system, user_id, created_at
    FROM categories
    WHERE is_system = 1 OR user_id = ?
    ORDER BY is_system DESC, name ASC
  `).all(userId);

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
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
