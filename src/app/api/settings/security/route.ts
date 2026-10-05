import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent, verifyPassword } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();
  const user = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(userId) as any;

  return NextResponse.json({
    twoFactorEnabled: user ? user.two_factor_enabled === 1 : false,
    secret: 'JBSWY3DPEHPK3PXP', // Base32 demonstration secret
    recoveryCodes: [
      'A7B2-9F1C', 'E4D8-22B1', '9C3A-78E2', '11F5-89DC', '33B8-44A9',
      '55C2-77D1', '66E4-99F3', '88A1-11C2', '22D4-33B5', '44F6-55E7'
    ]
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { action, code, password } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    if (action === 'ENABLE_2FA') {
      if (!code || code.length < 6) {
        return NextResponse.json({ error: 'Please enter a 6-digit TOTP code' }, { status: 400 });
      }
      db.prepare('UPDATE users SET two_factor_enabled = 1, updated_at = ? WHERE id = ?').run(now, userId);
      logAuditEvent({
        userId,
        action: '2FA_ENABLED',
        entityType: 'users',
        entityId: userId,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: '2FA has been successfully enabled on your account!' });
    }

    if (action === 'DISABLE_2FA') {
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any;
      if (!password || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: 'Incorrect password. Cannot disable 2FA.' }, { status: 400 });
      }
      db.prepare('UPDATE users SET two_factor_enabled = 0, updated_at = ? WHERE id = ?').run(now, userId);
      logAuditEvent({
        userId,
        action: '2FA_DISABLED',
        entityType: 'users',
        entityId: userId,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: '2FA has been disabled.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
