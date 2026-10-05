import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent, verifyAuditTrail } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action')?.trim() || '';
  const actorRole = searchParams.get('actor_role')?.trim() || '';
  const entityType = searchParams.get('entity_type')?.trim() || '';
  const userId = searchParams.get('user_id')?.trim() || '';
  const from = searchParams.get('from')?.trim() || '';
  const to = searchParams.get('to')?.trim() || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const db = getDb();
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (action) {
    conditions.push('a.action LIKE ?');
    params.push(`%${action}%`);
  }
  if (entityType) {
    conditions.push('a.entity_type = ?');
    params.push(entityType);
  }
  if (userId) {
    conditions.push('a.user_id = ?');
    params.push(userId);
  }
  if (actorRole === 'ADMIN') {
    conditions.push("(a.action LIKE 'ADMIN%' OR a.details LIKE '%\"actor_role\":\"ADMIN\"%')");
  }
  if (from) {
    conditions.push('substr(a.created_at, 1, 10) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('substr(a.created_at, 1, 10) <= ?');
    params.push(to);
  }

  const whereClause = conditions.join(' AND ');

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM audit_logs a WHERE ${whereClause}`).get(...params) as { count: number };
  const total = countRow.count;

  const logs = db.prepare(`
    SELECT 
      a.id,
      a.user_id,
      u.email as user_email,
      u.role as user_role,
      a.action,
      a.entity_type,
      a.entity_id,
      a.details,
      a.ip_address,
      a.prev_hash,
      a.hash,
      a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE ${whereClause}
    ORDER BY a.rowid DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Compute live cryptographic hash chain verification
  const verification = verifyAuditTrail();

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    cryptographicVerification: verification,
  });
}
