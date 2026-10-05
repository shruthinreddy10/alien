import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const db = getDb();
  // Admin sees metadata and transaction counts, but NEVER raw transactions or financial line items!
  const users = db.prepare(`
    SELECT 
      u.id,
      u.email,
      u.name,
      u.role,
      u.created_at,
      COUNT(t.id) as transaction_count
    FROM users u
    LEFT JOIN transactions t ON u.id = t.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  return NextResponse.json({ users });
}
