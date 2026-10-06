import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { verifyPassword, logAuditEvent } from '@/lib/security';
import crypto from 'node:crypto';

// Luhn or simple brand detector
function detectBrand(panClean: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'RUPAY' {
  if (panClean.startsWith('4')) return 'VISA';
  if (panClean.startsWith('5') || (parseInt(panClean.slice(0, 2), 10) >= 51 && parseInt(panClean.slice(0, 2), 10) <= 55)) return 'MASTERCARD';
  if (panClean.startsWith('34') || panClean.startsWith('37')) return 'AMEX';
  if (panClean.startsWith('60') || panClean.startsWith('65') || panClean.startsWith('81') || panClean.startsWith('82') || panClean.startsWith('508')) return 'RUPAY';
  return 'VISA';
}

// GET /api/v1/cards - List authenticated user's demo cards (masked)
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const db = getDb();
  const cards = db.prepare(`
    SELECT id, brand, last4, holder_name, expiry_month, expiry_year, nickname, is_active, created_at, last_used_at
    FROM demo_cards
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(auth.session.userId) as any[];

  return NextResponse.json({ cards });
}

// POST /api/v1/cards - Add a demo card with password confirmation
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const { cardNumber, holderName, expiry, cvv, nickname, password } = body;

    // 1. Validate required fields
    if (!cardNumber || !holderName || !expiry || !cvv || !nickname || !password) {
      return NextResponse.json(
        { error: 'All fields are required including password confirmation.' },
        { status: 400 }
      );
    }

    // 2. Strict Re-authentication: Confirm user's password before issuing card token
    const db = getDb();
    const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(auth.session.userId) as { password_hash: string } | undefined;
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      logAuditEvent({
        userId: auth.session.userId,
        action: 'CARD_ADD_FAILED_AUTH',
        entityType: 'demo_card',
        details: { reason: 'invalid_password_confirmation' },
        ipAddress: getClientIp(req),
      });
      return NextResponse.json(
        { error: 'Invalid password. Re-authentication required to add demo payment cards.' },
        { status: 401 }
      );
    }

    // 3. Clean PAN & extract safe attributes (PCI DSS: NEVER store full PAN or CVV)
    const panClean = String(cardNumber).replace(/\s+/g, '').replace(/-/g, '');
    if (panClean.length < 13 || panClean.length > 19) {
      return NextResponse.json(
        { error: 'Invalid card number length.' },
        { status: 400 }
      );
    }

    const last4 = panClean.slice(-4);
    const brand = detectBrand(panClean);

    // Parse expiry MM/YY
    const [expMonthStr, expYearStr] = String(expiry).split('/');
    const expiryMonth = parseInt(expMonthStr, 10);
    let expiryYear = parseInt(expYearStr, 10);
    if (!expiryMonth || expiryMonth < 1 || expiryMonth > 12) {
      return NextResponse.json({ error: 'Invalid expiry month (1-12).' }, { status: 400 });
    }
    if (expiryYear < 100) expiryYear += 2000;

    // 4. Generate unique mock token (e.g. card_tok_4821)
    const token = `card_tok_${last4}_${crypto.randomBytes(4).toString('hex')}`;
    const cardId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 5. Insert card record (PAN and CVV dropped from memory, NEVER stored)
    db.prepare(`
      INSERT INTO demo_cards (
        id, user_id, token, brand, last4, holder_name, expiry_month, expiry_year, nickname, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      cardId,
      auth.session.userId,
      token,
      brand,
      last4,
      holderName.trim(),
      expiryMonth,
      expiryYear,
      nickname.trim(),
      now
    );

    // 6. Tamper-evident audit log: card.added with masked number only
    logAuditEvent({
      userId: auth.session.userId,
      action: 'CARD_ADDED',
      entityType: 'demo_card',
      entityId: cardId,
      details: {
        brand,
        last4,
        nickname: nickname.trim(),
        holderName: holderName.trim(),
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      card: {
        id: cardId,
        brand,
        last4,
        holder_name: holderName.trim(),
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        nickname: nickname.trim(),
        token,
        is_active: 1,
        created_at: now,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error('Error adding card:', err);
    return NextResponse.json({ error: 'Internal server error adding demo card.' }, { status: 500 });
  }
}
