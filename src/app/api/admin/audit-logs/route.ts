import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { verifyAuditTrail } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const db = getDb();
  const logs = db.prepare(`
    SELECT 
      a.id,
      a.user_id,
      u.email as user_email,
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
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all();

  const verification = verifyAuditTrail();

  return NextResponse.json({
    logs,
    cryptographicVerification: verification,
  });
}
