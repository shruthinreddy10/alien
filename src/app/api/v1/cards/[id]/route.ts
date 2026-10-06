import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

// GET /api/v1/cards/:id - Retrieve masked demo card
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { id } = await params;
  const db = getDb();
  const card = db.prepare(`
    SELECT id, brand, last4, holder_name, expiry_month, expiry_year, nickname, is_active, created_at, last_used_at, token
    FROM demo_cards
    WHERE id = ? AND user_id = ?
  `).get(id, auth.session.userId) as any;

  if (!card) {
    return NextResponse.json({ error: 'Card not found or access denied.' }, { status: 404 });
  }

  return NextResponse.json({ card });
}

// PATCH /api/v1/cards/:id - Update nickname
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { id } = await params;
  const db = getDb();
  const existing = db.prepare('SELECT id, last4 FROM demo_cards WHERE id = ? AND user_id = ?').get(id, auth.session.userId) as any;

  if (!existing) {
    return NextResponse.json({ error: 'Card not found or access denied.' }, { status: 404 });
  }

  const body = await req.json();
  const { nickname } = body;
  if (!nickname || typeof nickname !== 'string') {
    return NextResponse.json({ error: 'Valid nickname is required.' }, { status: 400 });
  }

  db.prepare('UPDATE demo_cards SET nickname = ? WHERE id = ?').run(nickname.trim(), id);

  logAuditEvent({
    userId: auth.session.userId,
    action: 'CARD_UPDATED',
    entityType: 'demo_card',
    entityId: id,
    details: { last4: existing.last4, nickname: nickname.trim() },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/v1/cards/:id - Delete demo card & immediately invalidate token
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { id } = await params;
  const db = getDb();
  const existing = db.prepare('SELECT id, last4, brand FROM demo_cards WHERE id = ? AND user_id = ?').get(id, auth.session.userId) as any;

  if (!existing) {
    return NextResponse.json({ error: 'Card not found or access denied.' }, { status: 404 });
  }

  // Atomically delete card & wipe token
  db.prepare('DELETE FROM demo_cards WHERE id = ? AND user_id = ?').run(id, auth.session.userId);

  logAuditEvent({
    userId: auth.session.userId,
    action: 'CARD_DELETED',
    entityType: 'demo_card',
    entityId: id,
    details: { last4: existing.last4, brand: existing.brand },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true, message: 'Card removed and token destroyed.' });
}
