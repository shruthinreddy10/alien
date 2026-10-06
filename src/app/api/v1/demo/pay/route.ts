import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import crypto from 'node:crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'fintrack_webhook_demo_secret_2026_buildsecure!';

// POST /api/v1/demo/pay - Simulates an in-app payment and dispatches the signed webhook
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const { card_id, merchant, amount_minor, merchant_category } = body;

    if (!card_id || !merchant || !amount_minor) {
      return NextResponse.json({ error: 'card_id, merchant, and amount_minor are required.' }, { status: 400 });
    }

    const db = getDb();
    const card = db.prepare('SELECT * FROM demo_cards WHERE id = ? AND user_id = ?').get(card_id, auth.session.userId) as any;

    if (!card) {
      return NextResponse.json({ error: 'Card not found or access denied (IDOR protection).' }, { status: 404 });
    }

    // Build signed webhook payload
    const ref = `pay_demo_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();
    const payloadObj = {
      event: 'payment.authorized',
      card_token: card.token,
      amount_minor: Math.round(Number(amount_minor)),
      currency: 'INR',
      merchant: merchant.trim(),
      merchant_category: merchant_category || undefined,
      timestamp,
      reference: ref,
      is_internal_demo: true,
    };

    const rawPayload = JSON.stringify(payloadObj);
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawPayload).digest('hex');

    // Internal invocation of webhook handler
    const origin = req.nextUrl.origin || 'http://localhost:3000';
    const webhookRes = await fetch(`${origin}/api/v1/webhooks/card-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FinTrack-Signature': `sha256=${signature}`,
      },
      body: rawPayload,
    });

    const resJson = await webhookRes.json();

    if (!webhookRes.ok) {
      return NextResponse.json({ error: resJson.error || 'Failed to process payment via webhook.' }, { status: webhookRes.status });
    }

    return NextResponse.json({
      success: true,
      webhook_ref: ref,
      status: 'accepted',
      result: resJson,
    });
  } catch (err: any) {
    console.error('Error simulating demo payment:', err);
    return NextResponse.json({ error: 'Internal server error simulating demo payment.' }, { status: 500 });
  }
}
