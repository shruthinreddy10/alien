import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';
import { scanAnomaliesForUser } from '@/lib/anomaly-detector';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status')?.toLowerCase() || 'all'; // 'all' | 'unacknowledged' | 'acknowledged' | 'dismissed'
  const severity = searchParams.get('severity')?.toLowerCase() || 'all'; // 'all' | 'high' | 'medium' | 'low'
  const rule = searchParams.get('rule')?.trim() || '';
  const startDate = searchParams.get('startDate')?.trim() || '';
  const endDate = searchParams.get('endDate')?.trim() || '';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;

  const db = getDb();

  const conditions: string[] = ['a.user_id = ?'];
  const params: any[] = [userId];

  if (status === 'unacknowledged') {
    conditions.push('a.acknowledged_at IS NULL AND a.dismissed_at IS NULL');
  } else if (status === 'acknowledged') {
    conditions.push('a.acknowledged_at IS NOT NULL');
  } else if (status === 'dismissed') {
    conditions.push('a.dismissed_at IS NOT NULL');
  }

  if (severity && severity !== 'all') {
    conditions.push('(LOWER(a.severity) = ? OR LOWER(COALESCE(a.level, "")) = ?)');
    params.push(severity, severity);
  }

  if (rule && rule !== 'all') {
    conditions.push('a.rule = ?');
    params.push(rule);
  }

  if (startDate) {
    conditions.push('substr(a.created_at, 1, 10) >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('substr(a.created_at, 1, 10) <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.join(' AND ');
  const limitClause = limit ? `LIMIT ${limit}` : '';

  const alerts = db.prepare(`
    SELECT 
      a.id,
      a.user_id,
      a.transaction_id,
      a.rule,
      a.severity,
      COALESCE(a.level, 
        CASE 
          WHEN a.severity >= 0.7 OR a.severity = 'high' THEN 'HIGH'
          WHEN a.severity >= 0.4 OR a.severity = 'medium' THEN 'MEDIUM'
          ELSE 'LOW'
        END
      ) as level,
      COALESCE(a.title, a.rule) as title,
      COALESCE(a.description, a.details) as description,
      a.metadata,
      a.details,
      a.acknowledged_at,
      a.dismissed_at,
      a.created_at,
      t.amount as transaction_amount,
      t.description as transaction_description,
      t.date as transaction_date,
      t.category_id as transaction_category_id,
      c.name as category_name,
      c.color as category_color
    FROM anomaly_alerts a
    LEFT JOIN transactions t ON a.transaction_id = t.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE ${whereClause}
    ORDER BY a.created_at DESC
    ${limitClause}
  `).all(...params);

  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const { id, action } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    if (action === 'SCAN') {
      const scannedCount = scanAnomaliesForUser(userId);
      return NextResponse.json({ message: 'Anomaly scan completed', newAnomalies: scannedCount });
    }

    if (action === 'ACKNOWLEDGE') {
      const alert = db.prepare('SELECT id FROM anomaly_alerts WHERE id = ? AND user_id = ?').get(id, userId);
      if (!alert) {
        return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
      }

      db.prepare('UPDATE anomaly_alerts SET acknowledged_at = ? WHERE id = ? AND user_id = ?').run(now, id, userId);
      logAuditEvent({
        userId,
        action: 'anomaly.acknowledged',
        entityType: 'anomaly_alerts',
        entityId: id,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'Alert acknowledged' });
    }

    if (action === 'DISMISS' || action === 'MARK_AS_NORMAL') {
      const alert = db.prepare('SELECT id FROM anomaly_alerts WHERE id = ? AND user_id = ?').get(id, userId);
      if (!alert) {
        return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
      }

      db.prepare('UPDATE anomaly_alerts SET dismissed_at = ? WHERE id = ? AND user_id = ?').run(now, id, userId);
      logAuditEvent({
        userId,
        action: 'anomaly.dismissed',
        entityType: 'anomaly_alerts',
        entityId: id,
        details: { action: 'MARK_AS_NORMAL' },
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ message: 'Alert marked as normal / dismissed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
