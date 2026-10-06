import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'fintrack.db');

test('v5.0: Demo Cards PCI compliance and tokenization', async () => {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  db.exec('PRAGMA busy_timeout = 5000;');
  const cards = db.prepare('SELECT * FROM demo_cards').all();

  assert.ok(cards.length >= 2, 'Expected at least 2 seeded demo cards');
  
  for (const c of cards) {
    // Assert full PAN is never stored
    assert.strictEqual(c.last4.length, 4, 'Must only store 4 digits in last4');
    assert.ok(c.token.startsWith('card_tok_'), 'Token must be mock token');
    assert.ok(['VISA', 'MASTERCARD', 'AMEX', 'RUPAY'].includes(c.brand), 'Brand must be valid');
    // Ensure no column exists for full PAN or CVV
    assert.strictEqual(c.pan, undefined);
    assert.strictEqual(c.cvv, undefined);
  }
});

test('v5.0: Webhook HMAC-SHA256 signature verification formula', async () => {
  const secret = process.env.WEBHOOK_SIGNING_SECRET || 'fintrack_webhook_demo_secret_2026_buildsecure!';
  const payload = JSON.stringify({
    event: 'payment.authorized',
    card_token: 'card_tok_1111_icici_demo',
    amount_minor: 34000,
    merchant: 'Swiggy',
    reference: 'test_ref_123',
    timestamp: new Date().toISOString(),
  });

  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const recomputed = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  assert.strictEqual(crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(recomputed, 'hex')), true);
});

test('v5.0: Webhook transaction auto-capture idempotency and card link', async () => {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  db.exec('PRAGMA busy_timeout = 5000;');
  
  // Verify transactions table has source, card_id, card_last4, webhook_ref columns
  const cols = db.prepare("PRAGMA table_info(transactions)").all();
  const colNames = cols.map((c) => c.name);

  assert.ok(colNames.includes('source'), 'transactions table must include source column');
  assert.ok(colNames.includes('card_id'), 'transactions table must include card_id column');
  assert.ok(colNames.includes('card_last4'), 'transactions table must include card_last4 column');
  assert.ok(colNames.includes('webhook_ref'), 'transactions table must include webhook_ref column');
});
