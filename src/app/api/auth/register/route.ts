import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { hashPassword, createSessionToken, logAuditEvent } from '@/lib/security';
import { RegisterSchema } from '@/lib/schemas';
import { COOKIE_NAME, getClientIp } from '@/lib/auth-helper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered. Please log in.' },
        { status: 409 }
      );
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'USER', ?, ?)
    `).run(userId, cleanEmail, name.trim(), passwordHash, now, now);

    const ip = getClientIp(req);
    logAuditEvent({
      userId,
      action: 'AUTH_REGISTER',
      entityType: 'users',
      entityId: userId,
      details: { email: cleanEmail, name },
      ipAddress: ip,
    });

    const token = createSessionToken({
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      role: 'USER',
    });

    const res = NextResponse.json({
      user: {
        id: userId,
        email: cleanEmail,
        name: name.trim(),
        role: 'USER',
      },
      message: 'Account created successfully',
    });

    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err: unknown) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
