import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { calculateBudgetStatus } from '@/lib/money';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
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
    WHERE user_id = ?
  `).get(userId) as { total_income: number; total_expense: number; total_transactions: number };

  const totalIncome = totals.total_income;
  const totalExpense = totals.total_expense;
  const totalBalance = totalIncome - totalExpense;
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
    WHERE t.user_id = ? AND t.type = 'EXPENSE'
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

  // 3. Recent Transactions (Last 5)
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
      c.color as category_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 6
  `).all(userId);

  // 4. Cash Flow by Month (Last 6 distinct months)
  const monthlyTrends = db.prepare(`
    SELECT 
      substr(date, 1, 7) as month,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE user_id = ?
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
    WHERE user_id = ? AND type = 'EXPENSE' AND date >= ? AND date < ?
  `).get(userId, currentMonthStart, currentMonthEnd) as { spent: number };

  const overallLimit = overallBudgetRow ? overallBudgetRow.amount : 0;
  const currentMonthSpent = currentMonthSpentRow ? currentMonthSpentRow.spent : 0;
  const overallBudgetHealth = calculateBudgetStatus(currentMonthSpent, overallLimit);

  return NextResponse.json({
    kpis: {
      totalBalance,
      totalIncome,
      totalExpense,
      savingsRate,
      transactionCount: totals.total_transactions,
    },
    categorySpending,
    recentTransactions,
    monthlyTrends,
    overallBudget: {
      limit: overallLimit,
      spent: currentMonthSpent,
      ...overallBudgetHealth,
    },
  });
}
