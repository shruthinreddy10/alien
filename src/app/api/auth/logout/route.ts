import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSession, getClientIp } from '@/lib/auth-helper';
import { logAuditEvent } from '@/lib/security';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (session) {
    logAuditEvent({
      userId: session.userId,
      action: 'AUTH_LOGOUT',
      entityType: 'auth',
      ipAddress: getClientIp(req),
    });
  }

  const res = NextResponse.json({ message: 'Logged out successfully' });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
