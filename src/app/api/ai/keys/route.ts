import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { AiKeySaveSchema } from '@/lib/schemas';
import { encryptApiKey, logAuditEvent } from '@/lib/security';

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const body = await req.json();
    const parsed = AiKeySaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { provider, apiKey } = parsed.data;

    // Encrypt at rest using AES-256-GCM
    const encrypted = encryptApiKey(apiKey);
    const db = getDb();
    const now = new Date().toISOString();
    const id = `key_${crypto.randomUUID()}`;

    // Upsert into user_api_keys
    db.prepare(`
      INSERT INTO user_api_keys (id, user_id, provider, key_ciphertext, iv, auth_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        key_ciphertext = excluded.key_ciphertext,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        updated_at = excluded.updated_at
    `).run(id, userId, provider, encrypted.keyCiphertext, encrypted.iv, encrypted.authTag, now, now);

    logAuditEvent({
      userId,
      action: 'AI_KEY_STORED_ENCRYPTED',
      entityType: 'user_api_keys',
      details: { provider, cipherMode: 'AES-256-GCM' },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      message: `API key for ${provider} encrypted and securely stored.`,
      provider,
      hasKey: true,
    });
  } catch (err: unknown) {
    console.error('Store AI key error:', err);
    return NextResponse.json({ error: 'Failed to encrypt and store key' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || 'openai';

  const db = getDb();
  db.prepare('DELETE FROM user_api_keys WHERE user_id = ? AND provider = ?').run(userId, provider);

  logAuditEvent({
    userId,
    action: 'AI_KEY_REMOVED',
    entityType: 'user_api_keys',
    details: { provider },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ message: `API key for ${provider} removed successfully.` });
}
