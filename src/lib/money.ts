/**
 * Utility functions for exact integer minor unit arithmetic (cents / paise)
 * Never stores or operates on raw floats in the database or financial ledger.
 */

export function formatCents(cents: number, currency: string = 'USD'): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainingCents = absCents % 100;
  const formatted = `${isNegative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${remainingCents.toString().padStart(2, '0')}`;
  return formatted;
}

export function parseToCents(amountStr: string | number): number {
  if (typeof amountStr === 'number') {
    // If integer, return as is; if float, round cleanly to 2 decimal places
    return Math.round(amountStr * 100);
  }
  const cleanStr = amountStr.replace(/[^0-9.-]/g, '');
  const parsedFloat = parseFloat(cleanStr);
  if (isNaN(parsedFloat)) return 0;
  return Math.round(parsedFloat * 100);
}

export type BudgetHealthStatus = 'Healthy' | 'Warning' | 'Exceeded';

export function calculateBudgetStatus(spentCents: number, limitCents: number): {
  status: BudgetHealthStatus;
  percentage: number;
  remainingCents: number;
} {
  if (limitCents <= 0) {
    return { status: 'Healthy', percentage: 0, remainingCents: 0 };
  }
  const percentage = Math.round((spentCents / limitCents) * 100);
  const remainingCents = limitCents - spentCents;

  let status: BudgetHealthStatus = 'Healthy';
  if (percentage >= 100) {
    status = 'Exceeded';
  } else if (percentage >= 80) {
    status = 'Warning';
  }

  return { status, percentage, remainingCents };
}
