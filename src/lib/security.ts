import crypto from 'node:crypto';
import { getDb } from './db';

// Master key for AES-256-GCM (32 bytes = 256 bits)
const MASTER_KEY_ENV = process.env.ENCRYPTION_MASTER_KEY || 'fintrack_master_secure_key_2026_buildsecure_32b!';
const MASTER_KEY = crypto.createHash('sha256').update(MASTER_KEY_ENV).digest(); // Exactly 32 bytes

const SESSION_SECRET_ENV = process.env.SESSION_SECRET || 'fintrack_session_secret_buildsecure_24hr_secret_key!';
const SESSION_SECRET = crypto.createHash('sha256').update(SESSION_SECRET_ENV).digest();

// ============================================================================
// 1. PASSWORD HASHING (Salted Scrypt + Constant-Time Comparison)
// ============================================================================

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, keyHex] = combinedHash.split(':');
    if (!salt || !keyHex) return false;
    const key = Buffer.from(keyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(key, derivedKey);
  } catch {
    return false;
  }
}

// ============================================================================
// 2. AES-256-GCM ENCRYPTED KEY VAULT
// ============================================================================

export interface EncryptedKeyPayload {
  keyCiphertext: string;
  iv: string;
  authTag: string;
}

export function encryptApiKey(plainKey: string): EncryptedKeyPayload {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  
  let ciphertext = cipher.update(plainKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    keyCiphertext: ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptApiKey(payload: EncryptedKeyPayload): string {
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.keyCiphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============================================================================
// 3. TAMPER-EVIDENT HASH-CHAINED AUDIT LOG
// ============================================================================

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000_GENESIS_BUILD_SECURE_24';

export interface AuditEventParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

export function logAuditEvent(params: AuditEventParams): { id: string; hash: string } {
  const db = getDb();
  
  // Find the most recent audit entry to link the hash chain
  const lastEntry = db.prepare('SELECT id, hash FROM audit_logs ORDER BY rowid DESC LIMIT 1').get() as { id: string; hash: string } | undefined;
  const prevHash = lastEntry ? lastEntry.hash : GENESIS_HASH;

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const detailsStr = typeof params.details === 'string' ? params.details : JSON.stringify(params.details || {});

  // Cryptographic hash chaining: SHA-256(prevHash + timestamp + userId + action + entityType + entityId + details)
  const hash = crypto.createHash('sha256')
    .update(`${prevHash}|${createdAt}|${params.userId || 'ANONYMOUS'}|${params.action}|${params.entityType}|${params.entityId || ''}|${detailsStr}`)
    .digest('hex');

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.userId || null,
    params.action,
    params.entityType,
    params.entityId || null,
    detailsStr,
    params.ipAddress || null,
    prevHash,
    hash,
    createdAt
  );

  return { id, hash };
}

export function verifyAuditTrail(): { isValid: boolean; totalEntries: number; brokenAtId?: string } {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY rowid ASC').all() as Array<{
    id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: string | null;
    prev_hash: string;
    hash: string;
    created_at: string;
  }>;

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    if (entry.prev_hash !== expectedPrevHash) {
      return { isValid: false, totalEntries: logs.length, brokenAtId: entry.id };
    }

    const recomputedHash = crypto.createHash('sha256')
      .update(`${entry.prev_hash}|${entry.created_at}|${entry.user_id || 'ANONYMOUS'}|${entry.action}|${entry.entity_type}|${entry.entity_id || ''}|${entry.details || '{}'}`)
      .digest('hex');

    if (recomputedHash !== entry.hash) {
      return { isValid: false, totalEntries: logs.length, brokenAtId: entry.id };
    }

    expectedPrevHash = entry.hash;
  }

  return { isValid: true, totalEntries: logs.length };
}

// ============================================================================
// 4. SESSION TOKEN GENERATION & SIGNING (HMAC-SHA256)
// ============================================================================

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  exp: number; // Expiration timestamp in seconds
}

export function createSessionToken(user: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' }): string {
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() / 1000 > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
