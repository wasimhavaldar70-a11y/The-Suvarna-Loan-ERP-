// ========================================================
// SuvarnaLoan ERP - Human-Readable Sequential ID Engine
// Location: src/lib/idGenerator.ts
// Formats: shop-00001, cust-000001, loan-000001, item-000001, pmt-000001...
// ========================================================

import { supabase, isRealSupabase } from './supabase/client';

/**
 * Formats a numeric count into a clean, human-readable ID with padded zeros.
 * Prefix examples: 'shop' -> 'shop-00001', 'cust' -> 'cust-000001'
 */
export function formatHumanId(prefix: string, number: number, padding: number = 6): string {
  const cleanPrefix = prefix.trim().toLowerCase();
  const paddedNum = String(number).padStart(padding, '0');
  return `${cleanPrefix}-${paddedNum}`;
}

function getLocalItems<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`sl_${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function getNextSequentialId(
  table: string,
  localKey: string,
  prefix: string,
  padding: number = 6
): Promise<string> {
  let maxSeq = 0;
  const prefixPattern = new RegExp(`^${prefix}[-_]?(\\d+)$`, 'i');

  // 1. Scan Cloud Supabase Table
  if (isRealSupabase && supabase) {
    try {
      const { data } = await supabase.from(table).select('id');
      if (data && Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row?.id) {
            const strId = String(row.id);
            const match = strId.match(prefixPattern);
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            } else if (/^\d+$/.test(strId)) {
              const num = parseInt(strId, 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          }
        });
      }
    } catch (err) {
      console.warn(`getNextSequentialId DB warning for ${table}:`, err);
    }
  }

  // 2. Scan LocalStorage Cache
  const localItems = getLocalItems<any>(localKey);
  localItems.forEach((row: any) => {
    if (row?.id) {
      const strId = String(row.id);
      const match = strId.match(prefixPattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      } else if (/^\d+$/.test(strId)) {
        const num = parseInt(strId, 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return formatHumanId(prefix, nextSeq, padding);
}

/**
 * Generates next sequential Shop ID: shop-00001, shop-00002...
 */
export async function generateNextShopId(): Promise<string> {
  return getNextSequentialId('shops', 'shops', 'shop', 5);
}

/**
 * Generates next sequential Customer ID: cust-000001, cust-000002...
 */
export async function generateNextCustomerId(shopId?: string): Promise<string> {
  return getNextSequentialId('customers', 'customers', 'cust', 6);
}

/**
 * Generates next sequential Loan ID: loan-000001, loan-000002...
 */
export async function generateNextLoanId(shopId?: string): Promise<string> {
  return getNextSequentialId('loans', 'loans', 'loan', 6);
}

/**
 * Generates next sequential Gold Item ID: item-000001, item-000002...
 */
export async function generateNextGoldItemId(shopId?: string): Promise<string> {
  return getNextSequentialId('gold_items', 'gold_items', 'item', 6);
}

/**
 * Generates next sequential Payment ID: pmt-000001, pmt-000002...
 */
export async function generateNextPaymentId(shopId?: string): Promise<string> {
  return getNextSequentialId('payments', 'payments', 'pmt', 6);
}

/**
 * Generates next sequential Branch ID: br-00001, br-00002...
 */
export async function generateNextBranchId(shopId?: string): Promise<string> {
  return getNextSequentialId('branches', 'branches', 'br', 5);
}

/**
 * Generates next sequential Document ID: doc-000001, doc-000002...
 */
export async function generateNextDocumentId(shopId?: string): Promise<string> {
  return getNextSequentialId('customer_documents', 'documents', 'doc', 6);
}

/**
 * Generates next sequential User / Employee ID: user-000001, user-000002...
 */
export async function generateNextUserId(shopId?: string): Promise<string> {
  return getNextSequentialId('users', 'users', 'usr', 6);
}
