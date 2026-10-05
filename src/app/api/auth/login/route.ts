import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createSessionToken, logAuditEvent } from '@/lib/security';
import { LoginSchema } from '@/lib/schemas';
import { COOKIE_NAME, getClientIp } from '@/lib/auth-helper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, password_hash, role FROM users WHERE email = ?').get(email.toLowerCase()) as {
      id: string;
      email: string;
      name: string;
      password_hash: string;
      role: 'USER' | 'ADMIN';
    } | undefined;

    const ip = getClientIp(req);

    if (!user || !verifyPassword(password, user.password_hash)) {
      logAuditEvent({
        userId: user ? user.id : null,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'auth',
        details: { email, reason: 'Invalid credentials' },
        ipAddress: ip,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    logAuditEvent({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      details: { role: user.role },
      ipAddress: ip,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: 'Login successful',
    });

    // Set secure httpOnly cookie
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return res;
  } catch (err: unknown) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
