import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import { autoCategorize } from '../route';
import crypto from 'node:crypto';

// Simulation pool of realistic Indian financial events
const SIMULATION_POOL = [
  {
    source: 'UPI',
    merchant: 'Swiggy',
    amountMin: 18000,
    amountMax: 54000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'UPI_DEBIT',
      amount: amt,
      merchant: 'Swiggy',
      account: 'HDFC Bank ****4821',
      ref: `UPI/${Math.floor(1000 + Math.random() * 9000)}/${id.slice(-6)}`,
    }),
  },
  {
    source: 'UPI',
    merchant: 'Zomato',
    amountMin: 22000,
    amountMax: 68000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'UPI_DEBIT',
      amount: amt,
      merchant: 'Zomato',
      account: 'ICICI Bank ****9022',
      ref: `UPI/${Math.floor(1000 + Math.random() * 9000)}/${id.slice(-6)}`,
    }),
  },
  {
    source: 'UPI',
    merchant: 'Blinkit',
    amountMin: 35000,
    amountMax: 120000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'UPI_DEBIT',
      amount: amt,
      merchant: 'Blinkit',
      account: 'SBI ****1190',
      ref: `UPI/${Math.floor(1000 + Math.random() * 9000)}/${id.slice(-6)}`,
    }),
  },
  {
    source: 'UPI',
    merchant: 'Uber India',
    amountMin: 8500,
    amountMax: 42000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'UPI_DEBIT',
      amount: amt,
      merchant: 'Uber India',
      account: 'HDFC Bank ****4821',
      ref: `UPI/${Math.floor(1000 + Math.random() * 9000)}/${id.slice(-6)}`,
    }),
  },
  {
    source: 'CARD',
    merchant: 'Amazon.in',
    amountMin: 49900,
    amountMax: 349900,
    rawTemplate: (amt: number, id: string) => ({
      type: 'CARD_SWIPE',
      amount: amt,
      merchant: 'Amazon.in',
      card: 'Amazon Pay ICICI CC ****7712',
      location: 'Online Ingress',
      ref: `AUTH_${id.slice(-8)}`,
    }),
  },
  {
    source: 'CARD',
    merchant: 'BigBasket',
    amountMin: 145000,
    amountMax: 320000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'CARD_SWIPE',
      amount: amt,
      merchant: 'BigBasket',
      card: 'HDFC Regalia CC ****3309',
      location: 'Bangalore, IN',
      ref: `AUTH_${id.slice(-8)}`,
    }),
  },
  {
    source: 'CARD',
    merchant: 'Starbucks India',
    amountMin: 34000,
    amountMax: 95000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'CARD_SWIPE',
      amount: amt,
      merchant: 'Starbucks India',
      card: 'ICICI Coral CC ****9022',
      location: 'Hyderabad, IN',
      ref: `AUTH_${id.slice(-8)}`,
    }),
  },
  {
    source: 'EMAIL',
    merchant: 'BookMyShow',
    amountMin: 45000,
    amountMax: 110000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'EMAIL_RECEIPT',
      amount: amt,
      merchant: 'BookMyShow',
      subject: 'Your movie ticket confirmation - BMS78912',
      parsedOrderId: `BMS_${id.slice(-6)}`,
    }),
  },
  {
    source: 'EMAIL',
    merchant: 'IRCTC Train Ticket',
    amountMin: 68000,
    amountMax: 245000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'EMAIL_RECEIPT',
      amount: amt,
      merchant: 'IRCTC Train Ticket',
      subject: 'Electronic Reservation Slip (ERS) - PNR 421980312',
      parsedOrderId: `PNR_${Math.floor(100000000 + Math.random() * 900000000)}`,
    }),
  },
  {
    source: 'UPI',
    merchant: 'Local Chai Tapri',
    amountMin: 2000,
    amountMax: 6000,
    rawTemplate: (amt: number, id: string) => ({
      type: 'UPI_DEBIT',
      amount: amt,
      merchant: 'Local Chai Tapri',
      account: 'HDFC Bank ****4821',
      ref: `UPI/${Math.floor(1000 + Math.random() * 9000)}/${id.slice(-6)}`,
    }),
  },
];

// POST /api/v1/inbox/simulate - Generates a new live simulated notification
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const db = getDb();
  const pick = SIMULATION_POOL[Math.floor(Math.random() * SIMULATION_POOL.length)];
  const amountMinor = Math.floor(pick.amountMin + Math.random() * (pick.amountMax - pick.amountMin));
  const id = `inbox_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const { categoryId, confidence } = autoCategorize(pick.merchant, db, auth.session.userId);
  const rawPayload = JSON.stringify(pick.rawTemplate(amountMinor, id));

  db.prepare(`
    INSERT INTO inbox_notifications (
      id, user_id, source, amount_minor, merchant, raw_payload,
      suggested_category_id, confidence, status, received_at,
      confirmed_at, transaction_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, NULL, NULL, ?)
  `).run(
    id,
    auth.session.userId,
    pick.source,
    amountMinor,
    pick.merchant,
    rawPayload,
    categoryId,
    confidence,
    now,
    now
  );

  logAuditEvent({
    userId: auth.session.userId,
    action: 'INBOX_NOTIFICATION_SIMULATED',
    entityType: 'inbox_notifications',
    entityId: id,
    details: {
      source: pick.source,
      merchant: pick.merchant,
      amount: amountMinor,
      confidence,
    },
  });

  const createdNotification = db.prepare(`
    SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM inbox_notifications i
    LEFT JOIN categories c ON i.suggested_category_id = c.id
    WHERE i.id = ?
  `).get(id);

  return NextResponse.json({
    success: true,
    notification: createdNotification,
    message: `New ${pick.source} notification received for ${pick.merchant}`,
  });
}
