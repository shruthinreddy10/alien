import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  const rules = db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color 
    FROM recurring_rules r
    JOIN categories c ON r.category_id = c.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { merchant, amountMinor, categoryId, cadence, nextRunAt } = await req.json();
    if (!merchant || !amountMinor || !categoryId) {
      return NextResponse.json({ error: 'Merchant, amount, and category are required' }, { status: 400 });
    }

    const id = `rec_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(`
      INSERT INTO recurring_rules (id, user_id, merchant, amount_minor, category_id, cadence, next_run_at, paused, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, userId, merchant.trim(), parseInt(amountMinor), categoryId, cadence || 'MONTHLY', nextRunAt || now.slice(0, 10), now);

    logAuditEvent({
      userId,
      action: 'RECURRING_RULE_CREATE',
      entityType: 'recurring_rules',
      entityId: id,
      details: { merchant, amountMinor, cadence },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ message: 'Recurring transaction rule created', ruleId: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create recurring rule' }, { status: 500 });
  }
}
