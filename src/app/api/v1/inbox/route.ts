import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import crypto from 'node:crypto';

// Category mapping dictionary for Auto-categorization engine
const MERCHANT_CATEGORY_MAP: Record<string, { categoryId: string; confidence: 'HIGH' | 'MED' | 'LOW' }> = {
  'swiggy': { categoryId: 'cat_food', confidence: 'HIGH' },
  'zomato': { categoryId: 'cat_food', confidence: 'HIGH' },
  'starbucks': { categoryId: 'cat_custom_coffee', confidence: 'HIGH' },
  'third wave coffee': { categoryId: 'cat_custom_coffee', confidence: 'HIGH' },
  'blue tokai': { categoryId: 'cat_custom_coffee', confidence: 'HIGH' },
  'bigbasket': { categoryId: 'cat_groceries', confidence: 'HIGH' },
  'blinkit': { categoryId: 'cat_groceries', confidence: 'HIGH' },
  'dmart': { categoryId: 'cat_groceries', confidence: 'HIGH' },
  'uber': { categoryId: 'cat_transport', confidence: 'HIGH' },
  'ola': { categoryId: 'cat_transport', confidence: 'HIGH' },
  'irctc': { categoryId: 'cat_transport', confidence: 'HIGH' },
  'jio': { categoryId: 'cat_utilities', confidence: 'HIGH' },
  'airtel': { categoryId: 'cat_utilities', confidence: 'HIGH' },
  'amazon': { categoryId: 'cat_shopping', confidence: 'HIGH' },
  'flipkart': { categoryId: 'cat_shopping', confidence: 'HIGH' },
  'myntra': { categoryId: 'cat_shopping', confidence: 'HIGH' },
  'croma': { categoryId: 'cat_shopping', confidence: 'MED' },
  'apollo pharmacy': { categoryId: 'cat_health', confidence: 'HIGH' },
  'bookmyshow': { categoryId: 'cat_entertainment', confidence: 'HIGH' },
  'pvr': { categoryId: 'cat_entertainment', confidence: 'HIGH' },
  'netflix': { categoryId: 'cat_subscriptions', confidence: 'HIGH' },
  'chai': { categoryId: 'cat_food', confidence: 'MED' },
};

export function autoCategorize(merchant: string, db: ReturnType<typeof getDb>, userId: string): {
  categoryId: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
} {
  const norm = merchant.trim().toLowerCase();

  // 1. Check historical transactions of this user for this merchant
  const prevTx = db.prepare(`
    SELECT category_id, COUNT(*) as cnt 
    FROM transactions 
    WHERE user_id = ? AND LOWER(description) LIKE ? AND deleted_at IS NULL
    GROUP BY category_id 
    ORDER BY cnt DESC LIMIT 1
  `).get(userId, `%${norm}%`) as { category_id: string; cnt: number } | undefined;

  if (prevTx) {
    const confidence = prevTx.cnt >= 10 ? 'HIGH' : prevTx.cnt >= 3 ? 'MED' : 'LOW';
    return { categoryId: prevTx.category_id, confidence };
  }

  // 2. Rule-based lookup
  for (const [key, mapping] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (norm.includes(key)) {
      return { categoryId: mapping.categoryId, confidence: mapping.confidence };
    }
  }

  // 3. Fallback
  return { categoryId: 'cat_misc', confidence: 'LOW' };
}

// GET /api/v1/inbox - List inbox notifications with source and status filters
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PENDING';
  const source = searchParams.get('source'); // 'ALL' or 'UPI', 'CARD', 'EMAIL'

  let query = `
    SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM inbox_notifications i
    LEFT JOIN categories c ON i.suggested_category_id = c.id
    WHERE i.user_id = ?
  `;
  const params: (string | number)[] = [auth.session.userId];

  if (status !== 'ALL') {
    query += ` AND i.status = ?`;
    params.push(status);
  }

  if (source && source !== 'ALL') {
    query += ` AND i.source = ?`;
    params.push(source.toUpperCase());
  }

  query += ` ORDER BY i.received_at DESC`;

  const notifications = db.prepare(query).all(...params);

  // Also return pending counts
  const pendingCounts = db.prepare(`
    SELECT 
      COUNT(*) as total_pending,
      SUM(CASE WHEN source = 'UPI' THEN 1 ELSE 0 END) as upi_count,
      SUM(CASE WHEN source = 'CARD' THEN 1 ELSE 0 END) as card_count,
      SUM(CASE WHEN source = 'EMAIL' THEN 1 ELSE 0 END) as email_count,
      SUM(CASE WHEN confidence = 'HIGH' THEN 1 ELSE 0 END) as high_conf_count
    FROM inbox_notifications
    WHERE user_id = ? AND status = 'PENDING'
  `).get(auth.session.userId) as Record<string, number>;

  return NextResponse.json({
    notifications,
    counts: {
      totalPending: pendingCounts?.total_pending || 0,
      upi: pendingCounts?.upi_count || 0,
      card: pendingCounts?.card_count || 0,
      email: pendingCounts?.email_count || 0,
      highConfidence: pendingCounts?.high_conf_count || 0,
    },
  });
}
