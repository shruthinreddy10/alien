import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;
  const { id } = await params;

  const db = getDb();
  const res = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(id, userId);

  if (res.changes === 0) {
    return NextResponse.json({ error: 'Budget not found or access denied' }, { status: 404 });
  }

  logAuditEvent({
    userId,
    action: 'BUDGET_DELETE',
    entityType: 'budgets',
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ message: 'Budget deleted successfully' });
}
