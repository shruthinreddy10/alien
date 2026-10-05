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
  const goals = db.prepare('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { name, targetMinor, currentMinor, deadline } = await req.json();
    if (!name || !targetMinor) {
      return NextResponse.json({ error: 'Name and target amount are required' }, { status: 400 });
    }

    const id = `goal_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(`
      INSERT INTO savings_goals (id, user_id, name, target_minor, current_minor, deadline, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, name.trim(), parseInt(targetMinor), parseInt(currentMinor || 0), deadline || null, now);

    logAuditEvent({
      userId,
      action: 'SAVINGS_GOAL_CREATE',
      entityType: 'savings_goals',
      entityId: id,
      details: { name, targetMinor },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ message: 'Goal created successfully', goalId: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create goal' }, { status: 500 });
  }
}
