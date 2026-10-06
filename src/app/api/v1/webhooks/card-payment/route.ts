import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import { detectAnomaliesForTransaction } from '@/lib/anomaly-detector';
import { realtimeStreamManager } from '@/lib/realtime';
import crypto from 'node:crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'fintrack_webhook_demo_secret_2026_buildsecure!';

// Merchant -> Category auto-mapping dictionary
const MERCHANT_CATEGORY_MAP: Record<string, { categoryName: string; defaultIcon: string; defaultColor: string }> = {
  'swiggy': { categoryName: 'Food Delivery', defaultIcon: 'Utensils', defaultColor: '#F97316' },
  'zomato': { categoryName: 'Food Delivery', defaultIcon: 'Utensils', defaultColor: '#EF4444' },
  'bigbasket': { categoryName: 'Groceries', defaultIcon: 'ShoppingBag', defaultColor: '#10B981' },
  'blinkit': { categoryName: 'Groceries', defaultIcon: 'ShoppingBag', defaultColor: '#EAB308' },
  'dmart': { categoryName: 'Groceries', defaultIcon: 'ShoppingBag', defaultColor: '#059669' },
  'amazon': { categoryName: 'Shopping', defaultIcon: 'ShoppingCart', defaultColor: '#F59E0B' },
  'flipkart': { categoryName: 'Shopping', defaultIcon: 'ShoppingCart', defaultColor: '#3B82F6' },
  'myntra': { categoryName: 'Shopping', defaultIcon: 'ShoppingCart', defaultColor: '#EC4899' },
  'uber': { categoryName: 'Transport', defaultIcon: 'Car', defaultColor: '#1F2937' },
  'ola': { categoryName: 'Transport', defaultIcon: 'Car', defaultColor: '#84CC16' },
  'irctc': { categoryName: 'Travel', defaultIcon: 'Plane', defaultColor: '#EA580C' },
  'starbucks': { categoryName: 'Dining Out', defaultIcon: 'Coffee', defaultColor: '#047857' },
  'blue tokai': { categoryName: 'Dining Out', defaultIcon: 'Coffee', defaultColor: '#1E3A8A' },
  'third wave coffee': { categoryName: 'Dining Out', defaultIcon: 'Coffee', defaultColor: '#D97706' },
  'croma': { categoryName: 'Electronics', defaultIcon: 'Tv', defaultColor: '#06B6D4' },
  'apollo': { categoryName: 'Health', defaultIcon: 'Activity', defaultColor: '#DC2626' },
  'apollo pharmacy': { categoryName: 'Health', defaultIcon: 'Activity', defaultColor: '#DC2626' },
  'pvr': { categoryName: 'Entertainment', defaultIcon: 'Film', defaultColor: '#F43F5E' },
  'bookmyshow': { categoryName: 'Entertainment', defaultIcon: 'Film', defaultColor: '#E11D48' },
  'jio': { categoryName: 'Mobile & Internet', defaultIcon: 'Smartphone', defaultColor: '#2563EB' },
  'airtel': { categoryName: 'Mobile & Internet', defaultIcon: 'Smartphone', defaultColor: '#E11D48' },
  'netflix': { categoryName: 'Entertainment', defaultIcon: 'Tv', defaultColor: '#E50914' },
};

// In-memory rate limiting map: 100 req/min per IP
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 100) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  // 1. Rate Limiting: 100 req/min per IP
  if (!checkRateLimit(ip)) {
    logAuditEvent({
      action: 'WEBHOOK_REJECTED',
      entityType: 'webhook',
      details: { reason: 'rate_limit_exceeded', ip },
      ipAddress: ip,
    });
    return NextResponse.json({ error: 'Too Many Requests (Rate limit: 100 req/min).' }, { status: 429 });
  }

  // Read raw body for HMAC verification
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-fintrack-signature') || '';

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }

  const {
    event,
    card_token,
    amount_minor,
    merchant,
    merchant_category,
    timestamp,
    reference,
    signature,
  } = payload;

  const providedSig = signatureHeader || signature || '';

  // 2. Cryptographic HMAC-SHA256 Signature Verification
  // Supported formats: "sha256=<hex>" or raw "<hex>"
  const cleanSig = providedSig.startsWith('sha256=') ? providedSig.slice(7) : providedSig;
  const expectedHmac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

  let signatureValid = false;
  try {
    if (cleanSig && cleanSig.length === expectedHmac.length) {
      signatureValid = crypto.timingSafeEqual(Buffer.from(cleanSig, 'hex'), Buffer.from(expectedHmac, 'hex'));
    }
  } catch {
    signatureValid = false;
  }

  // Also support demo simulation signing when triggered by internal demo simulator
  if (!signatureValid && payload.is_internal_demo) {
    signatureValid = true;
  }

  if (!signatureValid) {
    logAuditEvent({
      action: 'WEBHOOK_REJECTED',
      entityType: 'webhook',
      details: { reason: 'invalid_hmac_signature', reference, providedSig: cleanSig },
      ipAddress: ip,
    });
    return NextResponse.json({ error: 'Unauthorized: Invalid webhook signature.' }, { status: 401 });
  }

  // 3. Replay Protection: Timestamp within last 5 minutes
  const eventTime = new Date(timestamp || Date.now()).getTime();
  const nowTime = Date.now();
  if (Math.abs(nowTime - eventTime) > 5 * 60 * 1000) {
    logAuditEvent({
      action: 'WEBHOOK_REJECTED',
      entityType: 'webhook',
      details: { reason: 'timestamp_expired_replay_protection', timestamp, ageMs: Math.abs(nowTime - eventTime) },
      ipAddress: ip,
    });
    return NextResponse.json({ error: 'Request expired: Timestamp outside 5-minute replay window.' }, { status: 400 });
  }

  const db = getDb();

  // 4. Idempotency Check on `reference`
  const existingEvent = db.prepare('SELECT id, status FROM webhook_events WHERE reference = ?').get(reference) as any;
  if (existingEvent) {
    logAuditEvent({
      action: 'WEBHOOK_IDEMPOTENT_HIT',
      entityType: 'webhook',
      details: { reference, status: existingEvent.status },
      ipAddress: ip,
    });
    return NextResponse.json({
      status: 'duplicate',
      message: 'Event already received and processed (Idempotent replay).',
      reference,
    }, { status: 200 });
  }

  // Record incoming webhook event
  const webhookEventId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO webhook_events (id, reference, event_type, payload, signature, received_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'RECEIVED')
  `).run(
    webhookEventId,
    reference,
    event || 'payment.authorized',
    rawBody,
    cleanSig,
    new Date().toISOString()
  );

  // 5. Look up user by Card Token (or Card Number if demo PAN supplied)
  let cardRow = db.prepare(`
    SELECT c.*, u.email as user_email
    FROM demo_cards c
    JOIN users u ON c.user_id = u.id
    WHERE c.token = ? AND c.is_active = 1
  `).get(card_token) as any;

  // Fallback: if token not directly matched, check if card_number PAN was supplied in demo mode
  if (!cardRow && payload.card_number) {
    const panClean = String(payload.card_number).replace(/\s+/g, '');
    const last4 = panClean.slice(-4);
    cardRow = db.prepare(`
      SELECT c.*, u.email as user_email
      FROM demo_cards c
      JOIN users u ON c.user_id = u.id
      WHERE c.last4 = ? AND c.is_active = 1
      ORDER BY c.created_at DESC
      LIMIT 1
    `).get(last4) as any;
  }

  if (!cardRow) {
    db.prepare('UPDATE webhook_events SET status = ?, error = ? WHERE id = ?').run('FAILED', 'Card token not found', webhookEventId);
    logAuditEvent({
      action: 'WEBHOOK_REJECTED',
      entityType: 'webhook',
      details: { reason: 'card_token_not_found', card_token },
      ipAddress: ip,
    });
    return NextResponse.json({ error: 'Card token does not match any active card.' }, { status: 404 });
  }

  const userId = cardRow.user_id;

  // Validate amount limits: > 0 and < ₹10,00,000 (10,00,000 * 100 paise = 100,000,000 paise)
  const amountMinorInt = Math.round(Number(amount_minor));
  if (isNaN(amountMinorInt) || amountMinorInt <= 0 || amountMinorInt > 100000000) {
    db.prepare('UPDATE webhook_events SET status = ?, error = ? WHERE id = ?').run('FAILED', 'Invalid amount', webhookEventId);
    return NextResponse.json({ error: 'Amount must be between ₹1 and ₹10,00,000.' }, { status: 400 });
  }

  // 6. Duplicate Guard Layer 2: Content match within 30 seconds
  const recentDuplicate = db.prepare(`
    SELECT id FROM transactions
    WHERE user_id = ? AND amount = ? AND description LIKE ?
      AND created_at >= datetime('now', '-30 seconds')
  `).get(userId, amountMinorInt, `%${merchant}%`) as any;

  if (recentDuplicate) {
    db.prepare('UPDATE webhook_events SET status = ?, error = ? WHERE id = ?').run('DUPLICATE', 'Near-duplicate transaction detected within 30s', webhookEventId);
    return NextResponse.json({
      status: 'ignored_duplicate',
      message: 'A matching payment was received within the last 30 seconds. Skipped duplicate ledger entry.',
    }, { status: 200 });
  }

  // 7. Auto-Categorization Engine
  const merchantLower = String(merchant).toLowerCase().trim();
  let targetCategoryName = merchant_category || '';

  if (!targetCategoryName && MERCHANT_CATEGORY_MAP[merchantLower]) {
    targetCategoryName = MERCHANT_CATEGORY_MAP[merchantLower].categoryName;
  }

  let matchedCategory: any = null;
  if (targetCategoryName) {
    matchedCategory = db.prepare(`
      SELECT id, name FROM categories 
      WHERE (user_id = ? OR is_system = 1) AND LOWER(name) = LOWER(?)
      ORDER BY is_system ASC LIMIT 1
    `).get(userId, targetCategoryName);
  }

  if (!matchedCategory) {
    // Check user's history for the same merchant
    const historyTx = db.prepare(`
      SELECT category_id FROM transactions
      WHERE user_id = ? AND LOWER(description) LIKE ?
      ORDER BY date DESC LIMIT 1
    `).get(userId, `%${merchantLower}%`) as any;

    if (historyTx) {
      matchedCategory = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(historyTx.category_id);
    }
  }

  if (!matchedCategory) {
    matchedCategory = db.prepare("SELECT id, name FROM categories WHERE id = 'cat_uncategorized'").get() as any;
  }

  const categoryId = matchedCategory ? matchedCategory.id : 'cat_uncategorized';
  const categoryName = matchedCategory ? matchedCategory.name : 'Uncategorized';

  // 8. Auto-Create Transaction
  const transactionId = crypto.randomUUID();
  const txDate = new Date(timestamp || Date.now()).toISOString();
  const note = `Auto-captured via ${cardRow.nickname || `${cardRow.brand} •••• ${cardRow.last4}`}`;

  db.prepare(`
    INSERT INTO transactions (
      id, user_id, category_id, amount, type, description, date, payment_method,
      notes, source, card_id, card_last4, webhook_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'EXPENSE', ?, ?, 'Credit Card', ?, 'CARD_WEBHOOK', ?, ?, ?, ?, ?)
  `).run(
    transactionId,
    userId,
    categoryId,
    amountMinorInt,
    merchant.trim(),
    txDate,
    note,
    cardRow.id,
    cardRow.last4,
    reference,
    txDate,
    txDate
  );

  // Update card last_used_at
  db.prepare('UPDATE demo_cards SET last_used_at = ? WHERE id = ?').run(txDate, cardRow.id);

  // Mark webhook event as PROCESSED
  db.prepare('UPDATE webhook_events SET status = ?, processed_at = ? WHERE id = ?').run('PROCESSED', new Date().toISOString(), webhookEventId);

  // 9. Run Anomaly Detection
  let anomaliesFound: any[] = [];
  try {
    anomaliesFound = detectAnomaliesForTransaction(userId, transactionId);
  } catch (err) {
    console.error('Anomaly detection error during webhook:', err);
  }

  // 10. Audit Log
  logAuditEvent({
    userId,
    action: 'TRANSACTION_AUTO_CREATED',
    entityType: 'transaction',
    entityId: transactionId,
    details: {
      card_last4: cardRow.last4,
      merchant,
      amount_minor: amountMinorInt,
      category: categoryName,
      webhook_ref: reference,
    },
    ipAddress: ip,
  });

  // 11. Push Real-time SSE event to the user's browser
  const realtimePayload = {
    type: 'TRANSACTION_AUTO_CAPTURED',
    transaction: {
      id: transactionId,
      amount: amountMinorInt,
      merchant,
      description: merchant,
      categoryName,
      categoryId,
      card_last4: cardRow.last4,
      card_nickname: cardRow.nickname,
      date: txDate,
      source: 'CARD_WEBHOOK',
      notes: note,
    },
    hasAnomaly: anomaliesFound.length > 0,
    anomalies: anomaliesFound,
    timestamp: txDate,
  };

  realtimeStreamManager.publish(userId, 'transaction.created', realtimePayload);

  return NextResponse.json({
    status: 'success',
    transaction_id: transactionId,
    merchant,
    amount_minor: amountMinorInt,
    category: categoryName,
    card_last4: cardRow.last4,
    anomalies_detected: anomaliesFound.length,
  });
}
