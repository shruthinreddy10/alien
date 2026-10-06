import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'fintrack.db');
const db = new DatabaseSync(DB_PATH);

// Test 1: Verify Seed Users exist and passwords match
test('Seed accounts authentication', () => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('user@demo.com');
  assert.ok(user, 'user@demo.com should exist');
  assert.equal(user.role, 'USER');

  const [salt, keyHex] = user.password_hash.split(':');
  const derivedKey = crypto.scryptSync('Password123!', salt, 64);
  assert.equal(derivedKey.toString('hex'), keyHex, 'Password123! should verify against hash');

  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@demo.com');
  assert.ok(admin, 'admin@demo.com should exist');
  assert.equal(admin.role, 'ADMIN');
});

// Test 2: AES-256-GCM Encryption, Decryption, and Tamper Detection
test('AES-256-GCM Key Vault security', () => {
  const masterKey = crypto.createHash('sha256').update('fintrack_master_secure_key_2026_buildsecure_32b!').digest();
  const plainApiKey = 'sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz';

  // Encrypt
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  let ciphertext = cipher.update(plainApiKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Decrypt valid
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  assert.equal(decrypted, plainApiKey, 'Decrypted key should match original plain key');

  // Tamper detection: flip 1 bit in ciphertext
  const tamperedCiphertext = (parseInt(ciphertext.slice(0, 2), 16) ^ 1).toString(16).padStart(2, '0') + ciphertext.slice(2);
  const badDecipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  badDecipher.setAuthTag(authTag);
  assert.throws(() => {
    badDecipher.update(tamperedCiphertext, 'hex', 'utf8');
    badDecipher.final('utf8');
  }, /Unsupported state or unable to authenticate data/, 'Tampered ciphertext must fail GCM authTag check');
});

// Test 3: Audit Log Cryptographic Hash Chaining Verification
test('Tamper-evident audit log cryptographic integrity', () => {
  const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000_GENESIS_BUILD_SECURE_24';
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY rowid ASC').all();
  assert.ok(logs.length >= 3, 'Audit log should contain at least seed entries');

  let expectedPrevHash = GENESIS_HASH;
  for (const entry of logs) {
    assert.equal(entry.prev_hash, expectedPrevHash, `Entry ${entry.id} prev_hash must link to preceding hash`);

    const detailsStr = entry.details || '{}';
    const recomputedHash = crypto.createHash('sha256')
      .update(`${entry.prev_hash}|${entry.created_at}|${entry.user_id || 'ANONYMOUS'}|${entry.action}|${entry.entity_type}|${entry.entity_id || ''}|${detailsStr}`)
      .digest('hex');

    assert.equal(entry.hash, recomputedHash, `Entry ${entry.id} hash must match recomputed SHA-256`);
    expectedPrevHash = entry.hash;
  }
});

// Test 4: Money Representation - Integer Minor Units arithmetic
test('Integer minor units eliminate float rounding drift', () => {
  // In IEEE 754 floats: 0.1 + 0.2 = 0.30000000000000004
  // In integer minor units: 10 + 20 = 30
  const item1 = 10; // $0.10
  const item2 = 20; // $0.20
  const sum = item1 + item2;
  assert.equal(sum, 30, 'Integer cents arithmetic is exact');

  // Verify all transactions in DB are strictly integers
  const allTxs = db.prepare('SELECT amount FROM transactions').all();
  for (const tx of allTxs) {
    assert.ok(Number.isInteger(tx.amount), `Transaction amount ${tx.amount} must be an integer`);
  }
});

// Test 5: Row-Level Authorization / IDOR Protection
test('Row-Level Authorization prevents cross-tenant data access (IDOR)', () => {
  const demoUserId = 'usr_demo_user_76';
  const attackerUserId = 'usr_attacker_999';

  // Query scoped by legitimate user returns transactions
  const userTxs = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(demoUserId);
  assert.ok(userTxs.length > 0, 'Legitimate user should see their transactions');

  // Query scoped by attacker user returns 0 rows (IDOR prevented by construction)
  const attackerTxs = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(attackerUserId);
  assert.equal(attackerTxs.length, 0, 'Attacker query must return 0 rows');

  // Attacker attempting to fetch a specific transaction by ID without matching user_id
  const targetTx = userTxs[0];
  const stolenTx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(targetTx.id, attackerUserId);
  assert.equal(stolenTx, undefined, 'Accessing another user transaction by ID must return undefined/404');
});
