// ========================================================
// Common Utility Functions
// Location: src/lib/utils.ts
// ========================================================

import { UserRole } from '../types';

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatWeight(grams: number | null | undefined): string {
  if (grams === null || grams === undefined || isNaN(grams)) return '0.000 g';
  return `${grams.toFixed(3)} g`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'Super Admin':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'Shop Owner':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'Staff':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}
