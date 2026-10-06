/**
 * Utility functions for exact integer minor unit arithmetic (paise)
 * Never stores or operates on raw floats in the database or financial ledger.
 *
 * 1.1 NUMBER FORMATTING:
 * Uses Indian numbering system ('en-IN') throughout:
 *   ₹1,45,000.00
 *   ₹12,34,567.89
 *   ₹500.00
 *   ₹0.50
 * Always prefix with ₹ (no space).
 */

export function formatINR(minorUnits: number): string {
  if (minorUnits === null || minorUnits === undefined || isNaN(minorUnits)) {
    return '₹0.00';
  }
  const isNegative = minorUnits < 0;
  const absUnits = Math.abs(minorUnits);
  const rupees = absUnits / 100;

  // en-IN Intl formatter formats with Indian lakh/crore digit grouping
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedRupees = formatter.format(rupees);
  return `${isNegative ? '-' : ''}₹${formattedRupees}`;
}

// formatCents alias for backward compatibility across all modules
export function formatCents(minorUnits: number, _currency: string = 'INR'): string {
  return formatINR(minorUnits);
}

export function parseToCents(amountStr: string | number): number {
  if (typeof amountStr === 'number') {
    return Math.round(amountStr * 100);
  }
  const cleanStr = amountStr.replace(/[^0-9.-]/g, '');
  const parsedFloat = parseFloat(cleanStr);
  if (isNaN(parsedFloat)) return 0;
  return Math.round(parsedFloat * 100);
}

// Alias for parseToINR
export function parseToPaise(amountStr: string | number): number {
  return parseToCents(amountStr);
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
