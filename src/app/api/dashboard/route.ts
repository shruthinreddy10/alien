import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { calculateBudgetStatus } from '@/lib/money';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  const db = getDb();

  // 1. Overall Balance, Income, Expense
  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense,
      COUNT(*) as total_transactions
    FROM transactions
    WHERE user_id = ? AND deleted_at IS NULL
  `).get(userId) as { total_income: number; total_expense: number; total_transactions: number };

  const totalIncome = totals?.total_income ?? 0;
  const totalExpense = totals?.total_expense ?? 0;
  const totalBalance = totalIncome - totalExpense;
  const transactionCount = totals?.total_transactions ?? 0;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

  // 2. Spending by Category (Expenses only)
  const categorySpending = db.prepare(`
    SELECT 
      c.id,
      c.name,
      c.color,
      c.icon,
      SUM(t.amount) as total_amount,
      COUNT(t.id) as count
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'EXPENSE' AND t.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY total_amount DESC
  `).all(userId) as Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    total_amount: number;
    count: number;
  }>;

  // 3. Recent Transactions (Last 6)
  const recentTransactions = db.prepare(`
    SELECT 
      t.id,
      t.amount,
      t.type,
      t.description,
      t.date,
      t.payment_method,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      anom.id as anomaly_id,
      anom.rule as anomaly_rule,
      anom.level as anomaly_level
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN anomaly_alerts anom ON t.id = anom.transaction_id AND anom.dismissed_at IS NULL
    WHERE t.user_id = ? AND t.deleted_at IS NULL
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 6
  `).all(userId);

  // 4. Cash Flow by Month (Last 6 distinct months)
  const monthlyTrends = db.prepare(`
    SELECT 
      substr(date, 1, 7) as month,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) as expense
    FROM transactions
    WHERE user_id = ? AND deleted_at IS NULL
    GROUP BY month
    ORDER BY month ASC
    LIMIT 6
  `).all(userId) as Array<{
    month: string;
    income: number;
    expense: number;
  }>;

  // 5. Overall Monthly Budget Status
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMonthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const overallBudgetRow = db.prepare(`
    SELECT amount FROM budgets 
    WHERE user_id = ? AND category_id IS NULL AND period = 'MONTHLY'
  `).get(userId) as { amount: number } | undefined;

  const currentMonthSpentRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as spent
    FROM transactions
    WHERE user_id = ? AND type = 'EXPENSE' AND date >= ? AND date < ? AND deleted_at IS NULL
  `).get(userId, currentMonthStart, currentMonthEnd) as { spent: number };

  const overallLimit = overallBudgetRow ? overallBudgetRow.amount : 0;
  const currentMonthSpent = currentMonthSpentRow ? currentMonthSpentRow.spent : 0;
  const overallBudgetHealth = calculateBudgetStatus(currentMonthSpent, overallLimit);

  // 6. Top 3 Unacknowledged Flagged Transactions
  const flaggedTransactions = db.prepare(`
    SELECT 
      a.id,
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
      a.created_at,
      t.amount as transaction_amount,
      t.description as transaction_description,
      t.date as transaction_date,
      c.name as category_name
    FROM anomaly_alerts a
    LEFT JOIN transactions t ON a.transaction_id = t.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE a.user_id = ? AND a.acknowledged_at IS NULL AND a.dismissed_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 3
  `).all(userId);

  return NextResponse.json({
    kpis: {
      totalBalance,
      totalIncome,
      totalExpense,
      savingsRate,
      transactionCount,
    },
    categorySpending: categorySpending || [],
    recentTransactions: recentTransactions || [],
    monthlyTrends: monthlyTrends || [],
    flaggedTransactions: flaggedTransactions || [],
    overallBudget: {
      limit: overallLimit,
      spent: currentMonthSpent,
      ...overallBudgetHealth,
    },
  });
}
