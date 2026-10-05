import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from './security';
import { getDb } from './db';

export const COOKIE_NAME = 'fintrack_session';

export function getSession(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) {
    // Check Authorization header fallback (Bearer <token>)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return verifySessionToken(authHeader.substring(7));
    }
    return null;
  }
  return verifySessionToken(cookie.value);
}

export function requireAuth(req: NextRequest): { session: SessionPayload } | { errorResponse: NextResponse } {
  const session = getSession(req);
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Valid session required' },
        { status: 401 }
      ),
    };
  }
  return { session };
}

export function requireAdmin(req: NextRequest): { session: SessionPayload } | { errorResponse: NextResponse } {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) {
    return auth;
  }
  if (auth.session.role !== 'ADMIN') {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
