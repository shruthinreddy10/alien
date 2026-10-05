import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format')?.toLowerCase() || 'csv';

  const db = getDb();
  // Fetch transactions strictly scoped to userId
  const transactions = db.prepare(`
    SELECT 
      t.id,
      t.date,
      t.type,
      c.name as category,
      t.description,
      t.amount as amount_cents,
      t.payment_method,
      t.notes,
      t.created_at
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC
  `).all(userId) as Array<{
    id: string;
    date: string;
    type: string;
    category: string | null;
    description: string;
    amount_cents: number;
    payment_method: string;
    notes: string | null;
    created_at: string;
  }>;

  const timestamp = new Date().toISOString().slice(0, 10);
  const ip = getClientIp(req);

  if (format === 'json') {
    const budgets = db.prepare(`
      SELECT b.id, c.name as category, b.amount as limit_cents, b.period, b.created_at
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ?
    `).all(userId);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: userId,
        email: auth.session.email,
        name: auth.session.name,
      },
      transactionsCount: transactions.length,
      transactions: transactions.map((t) => ({
        ...t,
        amountFormatted: `$${(t.amount_cents / 100).toFixed(2)}`,
      })),
      budgets,
    };

    logAuditEvent({
      userId,
      action: 'DATA_EXPORT_JSON',
      entityType: 'export',
      details: { recordCount: transactions.length, format: 'json' },
      ipAddress: ip,
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="fintrack_export_${timestamp}.json"`,
      },
    });
  }

  // Format CSV
  const csvHeaders = ['Transaction ID', 'Date', 'Type', 'Category', 'Description', 'Amount (USD)', 'Amount (Cents)', 'Payment Method', 'Notes'];
  const csvRows = transactions.map((t) => [
    `"${t.id}"`,
    `"${t.date}"`,
    `"${t.type}"`,
    `"${t.category || 'Uncategorized'}"`,
    `"${t.description.replace(/"/g, '""')}"`,
    `"${(t.amount_cents / 100).toFixed(2)}"`,
    t.amount_cents,
    `"${t.payment_method}"`,
    `"${(t.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n');

  logAuditEvent({
    userId,
    action: 'DATA_EXPORT_CSV',
    entityType: 'export',
    details: { recordCount: transactions.length, format: 'csv' },
    ipAddress: ip,
  });

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fintrack_export_${timestamp}.csv"`,
    },
  });
}
