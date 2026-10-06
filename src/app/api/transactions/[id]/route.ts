import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { TransactionUpdateSchema } from '@/lib/schemas';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  const db = getDb();
  // IDOR Protection: Query strictly scopes by both id and userId
  const tx = db.prepare(`
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ? AND t.user_id = ?
  `).get(id, userId);

  if (!tx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  return NextResponse.json({ transaction: tx });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = TransactionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getDb();
    // Verify existing record belongs to current user
    const existing = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

    const updates: string[] = ['updated_at = ?'];
    const now = new Date().toISOString();
    const values: any[] = [now];

    const data = parsed.data;
    if (data.categoryId !== undefined) {
      updates.push('category_id = ?');
      values.push(data.categoryId);
    }
    if (data.amount !== undefined) {
      updates.push('amount = ?');
      values.push(data.amount);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description.trim());
    }
    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }
    if (data.paymentMethod !== undefined) {
      updates.push('payment_method = ?');
      values.push(data.paymentMethod);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }
    if (data.attachmentUrl !== undefined || (body as any).attachmentUrl !== undefined || (body as any).attachment_url !== undefined) {
      const attUrl = data.attachmentUrl !== undefined ? data.attachmentUrl : ((body as any).attachmentUrl ?? (body as any).attachment_url);
      updates.push('attachment_url = ?', 'attachmentUrl = ?');
      values.push(attUrl, attUrl);
    }

    values.push(id, userId);
    db.prepare(`
      UPDATE transactions 
      SET ${updates.join(', ')} 
      WHERE id = ? AND user_id = ?
    `).run(...values);

    logAuditEvent({
      userId,
      action: 'TRANSACTION_UPDATE',
      entityType: 'transactions',
      entityId: id,
      details: data,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(id, userId);

    return NextResponse.json({ transaction: updated, message: 'Transaction updated successfully' });
  } catch (err: unknown) {
    console.error('Update transaction error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  const db = getDb();
  // Enforce Row-Level Authorization: delete only if id and user_id match
  const result = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
  }

  logAuditEvent({
    userId,
    action: 'TRANSACTION_DELETE',
    entityType: 'transactions',
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ message: 'Transaction deleted successfully' });
}
