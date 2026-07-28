// ========================================================
// SuvarnaLoan ERP - Human-Readable Sequential ID Engine
// Location: src/lib/idGenerator.ts
// Formats: shop-00001, cust-000001, loan-000001, item-000001...
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

/**
 * Generates next sequential Shop ID: shop-00001, shop-00002...
 * Strictly 1+ increment of previous shop count/ID in database.
 * If shop table has 0 records, first shop is shop-00001. No random numbers allowed!
 */
export async function generateNextShopId(): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('shops').select('id');
      if (!error && data) {
        let maxSeq = 0;
        data.forEach((s) => {
          if (s.id && /^shop-0{3,}\d+$/i.test(s.id)) {
            const num = parseInt(s.id.replace(/^shop-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        });
        const nextNum = Math.max(data.length, maxSeq) + 1;
        return formatHumanId('shop', nextNum, 5); // e.g. shop-00001, shop-00002...
      }
    } catch (err) {
      console.warn('generateNextShopId DB error:', err);
    }
  }

  let localCount = 0;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('sl_shops');
      if (raw) {
        const localShops = JSON.parse(raw);
        if (Array.isArray(localShops)) localCount = localShops.length;
      }
    } catch {}
  }

  return formatHumanId('shop', localCount + 1, 5);
}

/**
 * Generates next sequential Customer ID: cust-000001, cust-000002...
 */
export async function generateNextCustomerId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('customers').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((c) => {
          if (c.id && /^cust-\d+$/i.test(c.id)) {
            const num = parseInt(c.id.replace(/^cust-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('cust', maxSeq + 1, 6); // cust-000001
      }
    } catch (err) {
      console.warn('generateNextCustomerId DB error:', err);
    }
  }
  return formatHumanId('cust', (Date.now() % 900000) + 100000, 6);
}

/**
 * Generates next sequential Loan ID: loan-000001, loan-000002...
 */
export async function generateNextLoanId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('loans').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((l) => {
          if (l.id && /^loan-\d+$/i.test(l.id)) {
            const num = parseInt(l.id.replace(/^loan-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('loan', maxSeq + 1, 6); // loan-000001
      }
    } catch (err) {
      console.warn('generateNextLoanId DB error:', err);
    }
  }
  return formatHumanId('loan', (Date.now() % 900000) + 100000, 6);
}

/**
 * Generates next sequential Gold Item ID: item-000001, item-000002...
 */
export async function generateNextGoldItemId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('gold_items').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((g) => {
          if (g.id && /^item-\d+$/i.test(g.id)) {
            const num = parseInt(g.id.replace(/^item-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('item', maxSeq + 1, 6); // item-000001
      }
    } catch (err) {
      console.warn('generateNextGoldItemId DB error:', err);
    }
  }
  return formatHumanId('item', (Date.now() % 900000) + 100000, 6);
}

/**
 * Generates next sequential Payment ID: pmt-000001, pmt-000002...
 */
export async function generateNextPaymentId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('payments').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((p) => {
          if (p.id && /^pmt-\d+$/i.test(p.id)) {
            const num = parseInt(p.id.replace(/^pmt-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('pmt', maxSeq + 1, 6); // pmt-000001
      }
    } catch (err) {
      console.warn('generateNextPaymentId DB error:', err);
    }
  }
  return formatHumanId('pmt', (Date.now() % 900000) + 100000, 6);
}

/**
 * Generates next sequential Branch ID: br-00001, br-00002...
 */
export async function generateNextBranchId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('branches').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((b) => {
          if (b.id && /^br-\d+$/i.test(b.id)) {
            const num = parseInt(b.id.replace(/^br-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('br', maxSeq + 1, 5); // br-00001
      }
    } catch (err) {
      console.warn('generateNextBranchId DB error:', err);
    }
  }
  return formatHumanId('br', (Date.now() % 90000) + 10000, 5);
}

/**
 * Generates next sequential Document ID: doc-000001, doc-000002...
 */
export async function generateNextDocumentId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('customer_documents').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((d) => {
          if (d.id && /^doc-\d+$/i.test(d.id)) {
            const num = parseInt(d.id.replace(/^doc-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('doc', maxSeq + 1, 6); // doc-000001
      }
    } catch (err) {
      console.warn('generateNextDocumentId DB error:', err);
    }
  }
  return formatHumanId('doc', (Date.now() % 900000) + 100000, 6);
}

/**
 * Generates next sequential User / Employee ID: user-000001, user-000002...
 */
export async function generateNextUserId(shopId?: string): Promise<string> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('users').select('id');

      if (!error && data) {
        let maxSeq = 0;
        data.forEach((u) => {
          if (u.id && /^usr-\d+$/i.test(u.id)) {
            const num = parseInt(u.id.replace(/^usr-/i, ''), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
        return formatHumanId('usr', maxSeq + 1, 6); // usr-000001
      }
    } catch (err) {
      console.warn('generateNextUserId DB error:', err);
    }
  }
  return formatHumanId('usr', (Date.now() % 900000) + 100000, 6);
}
