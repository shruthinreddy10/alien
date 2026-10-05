import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from './security';
import { logAuditEvent } from './security';

export const COOKIE_NAME = 'fintrack_session';

export function getSession(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) {
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
        { error: { code: 'UNAUTHORIZED', message: 'Valid session required' } },
        { status: 401 }
      ),
    };
  }
  return { session };
}

// requireUser: strictly role === 'USER'. Rejects ADMIN with 403 and logs role_mismatch audit event
export function requireUser(req: NextRequest): { session: SessionPayload } | { errorResponse: NextResponse } {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) {
    return auth;
  }
  if (auth.session.role !== 'USER') {
    logAuditEvent({
      userId: auth.session.userId,
      action: 'ACCESS_DENIED_ROLE_MISMATCH',
      entityType: 'api',
      details: {
        path: req.nextUrl?.pathname || req.url,
        method: req.method,
        actor_role: auth.session.role,
        required_role: 'USER',
        reason: 'role_mismatch',
      },
      ipAddress: getClientIp(req),
    });
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied: personal finance operations are restricted to USER accounts. Admin role cannot access or mutate financial data.' } },
        { status: 403 }
      ),
    };
  }
  return auth;
}

// requireAdmin: strictly role === 'ADMIN'. Rejects USER with 403 and logs role_mismatch audit event
export function requireAdmin(req: NextRequest): { session: SessionPayload } | { errorResponse: NextResponse } {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) {
    return auth;
  }
  if (auth.session.role !== 'ADMIN') {
    logAuditEvent({
      userId: auth.session.userId,
      action: 'ADMIN_ACCESS_DENIED',
      entityType: 'admin_api',
      details: {
        path: req.nextUrl?.pathname || req.url,
        method: req.method,
        actor_role: auth.session.role,
        required_role: 'ADMIN',
        reason: 'role_mismatch',
      },
      ipAddress: getClientIp(req),
    });
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden: Administrator privileges required' } },
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
