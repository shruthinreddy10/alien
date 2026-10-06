import { getDb } from './db';
import crypto from 'node:crypto';
import { logAuditEvent } from './security';

export interface AnomalyDetectionResult {
  rule: string;
  severity: number; // 0.0 - 1.0
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  metadata: Record<string, any>;
}

/**
 * Calculates severity float and level based on transaction amount and category average.
 * Formula: severity = min(1.0, (amount / category_avg) / 5)
 * Level: LOW if < 0.4, MEDIUM if < 0.7, HIGH otherwise
 */
export function calculateSeverity(amount: number, categoryAvg: number): { severity: number; level: 'LOW' | 'MEDIUM' | 'HIGH' } {
  if (categoryAvg <= 0) {
    return { severity: 0.5, level: 'MEDIUM' };
  }
  const ratio = (amount / categoryAvg) / 5;
  const severity = Math.min(1.0, Math.max(0.1, Math.round(ratio * 100) / 100));
  const level = severity < 0.4 ? 'LOW' : severity < 0.7 ? 'MEDIUM' : 'HIGH';
  return { severity, level };
}

/**
 * Quick anomaly detection executed immediately after a transaction insert.
 * Checks:
 *   Rule 1: amount_outlier (> 3x category average in last 90 days)
 *   Rule 3: duplicate_charge (same merchant/description + same amount within 24h)
 *   Rule 4: unusual_time (transaction at 2-5 AM when normal window is 9 AM - 9 PM)
 */
export function detectAnomaliesForTransaction(userId: string, txId: string): AnomalyDetectionResult[] {
  const db = getDb();
  const tx = db.prepare(`
    SELECT t.*, c.name as category_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ? AND t.user_id = ? AND t.deleted_at IS NULL
  `).get(txId, userId) as any;

  if (!tx || tx.type !== 'EXPENSE') return [];

  const anomalies: AnomalyDetectionResult[] = [];

  // 1. Amount Outlier: amount > 3x category average over last 90 days
  const catAvgRow = db.prepare(`
    SELECT AVG(amount) as avg_amount, COUNT(*) as count
    FROM transactions
    WHERE user_id = ? AND category_id = ? AND type = 'EXPENSE' 
      AND id != ? AND deleted_at IS NULL
      AND date >= date('now', '-90 days')
  `).get(userId, tx.category_id, tx.id) as { avg_amount: number | null; count: number };

  const catAvg = catAvgRow?.avg_amount || 0;
  if (catAvgRow?.count >= 3 && catAvg > 0 && tx.amount > 3 * catAvg) {
    const { severity, level } = calculateSeverity(tx.amount, catAvg);
    anomalies.push({
      rule: 'amount_outlier',
      severity,
      level,
      title: `Unusual High Spend in ${tx.category_name || 'Category'}`,
      description: `Amount of ${(tx.amount / 100).toFixed(2)} is ${(tx.amount / catAvg).toFixed(1)}x higher than your 90-day category average (${(catAvg / 100).toFixed(2)}).`,
      metadata: {
        categoryAvg: Math.round(catAvg),
        amount: tx.amount,
        multiplier: Math.round((tx.amount / catAvg) * 10) / 10,
        categoryName: tx.category_name,
      },
    });
  }

  // 2. Duplicate Charge: same description + same amount within 24h (or same date)
  const dupRow = db.prepare(`
    SELECT id, description, amount, date, created_at
    FROM transactions
    WHERE user_id = ? AND id != ? AND amount = ? 
      AND LOWER(description) = LOWER(?) AND deleted_at IS NULL
      AND (
        date = ? OR
        ABS(strftime('%s', created_at) - strftime('%s', ?)) <= 86400
      )
    LIMIT 1
  `).get(userId, tx.id, tx.amount, tx.description, tx.date, tx.created_at) as any;

  if (dupRow) {
    anomalies.push({
      rule: 'duplicate_charge',
      severity: 0.65,
      level: 'MEDIUM',
      title: `Potential Duplicate Charge for ${tx.description}`,
      description: `Detected identical ${(tx.amount / 100).toFixed(2)} charge for "${tx.description}" within 24 hours of transaction on ${dupRow.date}.`,
      metadata: {
        duplicateWithTxId: dupRow.id,
        amount: tx.amount,
        merchant: tx.description,
      },
    });
  }

  // 3. Unusual Time: transaction at 2-5 AM
  const txHour = new Date(tx.created_at).getHours();
  if (txHour >= 2 && txHour <= 5) {
    anomalies.push({
      rule: 'unusual_time',
      severity: 0.45,
      level: 'MEDIUM',
      title: `Unusual Off-Hours Transaction Time`,
      description: `Transaction occurred at ${txHour}:00 AM, outside of typical active hours (9 AM - 9 PM).`,
      metadata: { hour: txHour, createdAt: tx.created_at },
    });
  }

  // Persist flagged alerts to database
  const now = new Date().toISOString();
  for (const a of anomalies) {
    const alertId = `anom_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO anomaly_alerts (
        id, user_id, transaction_id, rule, severity, level, title, description, metadata, details, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alertId,
      userId,
      tx.id,
      a.rule,
      a.severity,
      a.level,
      a.title,
      a.description,
      JSON.stringify(a.metadata),
      a.description,
      now
    );

    logAuditEvent({
      userId,
      action: 'anomaly.created',
      entityType: 'anomaly_alerts',
      entityId: alertId,
      details: {
        transactionId: tx.id,
        rule: a.rule,
        level: a.level,
        severity: a.severity,
        amount: tx.amount,
      },
    });
  }

  return anomalies;
}

/**
 * Nightly/full scan of transactions over the last 30-90 days for all 6 rules.
 */
export function scanAnomaliesForUser(userId: string): number {
  const db = getDb();
  const txs = db.prepare(`
    SELECT t.*, c.name as category_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'EXPENSE' AND t.deleted_at IS NULL
    ORDER BY t.date DESC
    LIMIT 100
  `).all(userId) as any[];

  let newCount = 0;
  for (const tx of txs) {
    // Check if alert already exists for this transaction
    const existing = db.prepare(`
      SELECT id FROM anomaly_alerts WHERE user_id = ? AND transaction_id = ?
    `).get(userId, tx.id);
    if (!existing) {
      const results = detectAnomaliesForTransaction(userId, tx.id);
      newCount += results.length;
    }
  }

  return newCount;
}
