// ========================================================
// SuvarnaLoan ERP - Supabase Cloud & Local DB Adapter
// Location: src/lib/supabase/supabaseDb.ts
// ========================================================

import { createClient } from '@supabase/supabase-js';
import { supabase, isRealSupabase, getSessionUser, setSessionUser, getAccessToken } from './client';
import { 
  Shop, 
  User, 
  Branch, 
  Employee, 
  Customer, 
  GoldItem, 
  Valuation, 
  Loan, 
  LoanStatus,
  LoanDisbursement,
  Invoice, 
  Payment, 
  Notification, 
  AuditLog, 
  DashboardMetrics 
} from '../../types';
import { calculateGoldValuation, calculateLoanFinancials, calculateDisbursementFinancials } from '../goldValuationEngine';
import { uploadToSupabaseStorage, deleteCustomerFiles, getSignedDocumentUrl, sanitizeStoragePathOrUpload, isBase64DataUrl } from '../storageHelper';
import { generateNextCustomerId, generateNextGoldItemId, generateNextLoanId, generateNextPaymentId, formatHumanId } from '../idGenerator';
import { logAuditEvent } from '../auditLog';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = (supabaseUrl && supabaseSecretKey && !supabaseSecretKey.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function getDbClient() {
  if (!isRealSupabase) return null;
  if (typeof window !== 'undefined') {
    return supabase;
  }
  return supabaseAdmin || supabase;
}

const processedRequestUuidSet = new Set<string>();
const broadcastChannel = (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('suvarnaloan-sync') : null;

const dbQueryCache = new Map<string, { data: any; expiresAt: number }>();
const DEFAULT_CACHE_TTL = 30000; // 30 Seconds safe cache TTL

export const clearDbCache = (table?: string) => {
  if (!table) {
    dbQueryCache.clear();
    return;
  }
  for (const key of dbQueryCache.keys()) {
    if (key.includes(table)) {
      dbQueryCache.delete(key);
    }
  }
  // Invalidate dependent cached tables
  if (table === 'loans' || table === 'payments' || table === 'gold_items' || table === 'customers' || table === 'loan_disbursements') {
    for (const key of dbQueryCache.keys()) {
      if (key.includes('dashboard_metrics') || key.includes('disbursements')) {
        dbQueryCache.delete(key);
      }
    }
  }
  if (table === 'customers' || table === 'gold_items' || table === 'payments' || table === 'loan_disbursements') {
    for (const key of dbQueryCache.keys()) {
      if (key.includes('loans')) {
        dbQueryCache.delete(key);
      }
    }
  }
};

export const broadcastDbUpdate = (type: string) => {
  clearDbCache(type);
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'DB_UPDATE', table: type, timestamp: Date.now() });
  }
};

// Empty production defaults
const DEFAULT_CUSTOMERS: Customer[] = [];
const DEFAULT_GOLD_ITEMS: GoldItem[] = [];
const DEFAULT_LOANS: Loan[] = [];
const DEFAULT_DISBURSEMENTS: LoanDisbursement[] = [];
const DEFAULT_PAYMENTS: Payment[] = [];

// Tenant-Scoped LocalStorage Helper (CRIT-01 Remediation)
function getStorageKey(key: string, shopId?: string): string {
  const activeSession = getSessionUser();
  const effectiveShopId = shopId || activeSession?.shop?.id || activeSession?.user?.shop_id || 'shared';
  return `sl_${effectiveShopId}_${key}`;
}

function getStorageItem<T>(key: string, defaultVal: T, shopId?: string): T {
  if (typeof window === 'undefined') return defaultVal;
  const storageKey = getStorageKey(key, shopId);
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    localStorage.setItem(storageKey, JSON.stringify(defaultVal));
    return defaultVal;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setStorageItem<T>(key: string, val: T, shopId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = getStorageKey(key, shopId);
    localStorage.setItem(storageKey, JSON.stringify(val));
  } catch (err: any) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.number === -2147024882 || String(err).includes('quota'))) {
      try {
        // Clean up redundant cache keys
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('sl_cache_') || k.includes('_reports') || k.includes('_logs')) {
            localStorage.removeItem(k);
          }
        });
        const storageKey = getStorageKey(key, shopId);
        localStorage.setItem(storageKey, JSON.stringify(val));
      } catch {
        // Silently continue in memory if local storage is strictly full
      }
    }
  }
}

const FALLBACK_CUSTOMERS = [
  { full_name: 'Snehal Patil', mobile_number: '9876543210' },
  { full_name: 'Ramesh Gaikwad', mobile_number: '9822012345' },
  { full_name: 'Mahesh Patil', mobile_number: '9423098765' },
  { full_name: 'Suhani Havaldar', mobile_number: '7058536371' },
  { full_name: 'Ramesh Shah', mobile_number: '9850123456' },
  { full_name: 'Priya Sharma', mobile_number: '9764123456' },
  { full_name: 'Vijay Deshmukh', mobile_number: '9923123456' },
];

function resolveLoanCustomer(loan: any, customersList: Customer[], index: number): Customer {
  // 1. Direct DB Joined Customer from Supabase (Highest Priority for Multi-Device Consistency)
  let directCust = Array.isArray(loan.customer) ? loan.customer[0] : loan.customer;
  if (directCust && directCust.full_name && directCust.full_name.trim() !== '' && directCust.full_name.trim() !== 'Customer') {
    return directCust as Customer;
  }

  // 2. Normalized Customer ID Matching (Supports cust-000001, cust-1, etc.)
  const targetId = String(loan.customer_id || '').trim().toLowerCase();
  const normalizedTargetId = targetId.replace(/^(cust)[-_]?0*/i, '$1-');

  const matched = customersList.find(c => {
    if (!c || !c.id) return false;
    const cid = String(c.id).trim().toLowerCase();
    const normalizedCid = cid.replace(/^(cust)[-_]?0*/i, '$1-');
    return cid === targetId || normalizedCid === normalizedTargetId;
  });

  if (matched && matched.full_name) {
    return matched;
  }

  // 3. Deterministic Placeholder (NEVER use modulo index fallbacks that vary by device)
  return {
    id: loan.customer_id || `cust-unknown`,
    shop_id: loan.shop_id || '',
    full_name: loan.customer_name || 'Customer Record Unlinked',
    mobile_number: loan.customer_mobile || 'N/A',
    status: 'Active',
    created_at: new Date().toISOString(),
  } as Customer;
}

// Database Service API
export const db = {
  // ── Shop API ──────────────────────────────────────────────
  async getShop(shopId: string): Promise<Shop | null> {
    if (!shopId) return null;

    // 1. Direct Supabase query (works for both authenticated Shop Owners & Super Admins under RLS)
    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { data, error } = await client.from('shops').select('*').eq('id', shopId).single();
          if (!error && data) {
            const effectiveStatus = data.is_active !== undefined && data.is_active !== null ? data.is_active : true;
            return { ...data, is_active: effectiveStatus } as Shop;
          }
        }
      } catch (err) {
        console.warn('getShop direct Supabase exception:', err);
      }
    }

    // 2. Admin API route fallback (Super Admin only)
    if (typeof window !== 'undefined') {
      try {
        const accessToken = await getAccessToken();
        const res = await fetch('/api/admin/shops', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body.shops)) {
            const found = body.shops.find((s: any) => s.id === shopId);
            if (found) return found as Shop;
          }
        }
      } catch (err) {
        console.warn('getShop API fetch warning:', err);
      }
    }

    const localShops = getStorageItem<Shop[]>('shops', []);
    const localMatch = localShops.find(s => s.id === shopId);
    return localMatch || null;
  },

  async getShopByEmail(email: string): Promise<{ user: User; shop: Shop } | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (isRealSupabase) {
      const client = getDbClient();
      if (client) {
        // 1. Check shops table by owner email FIRST
        try {
          const { data: shopsData, error: shopErr } = await client.from('shops').select('*').ilike('email', cleanEmail).limit(1);
          if (!shopErr && shopsData && shopsData.length > 0) {
            const shop = shopsData[0] as Shop;
            const user: User = {
              id: `usr-${shop.id}`,
              shop_id: shop.id,
              name: `${shop.owner_name} (Owner)`,
              role: 'Shop Owner',
              email: cleanEmail,
              created_at: shop.created_at,
            };
            return { user, shop };
          }
        } catch (err) {
          console.warn('getShopByEmail shops table query warning:', err);
        }

        // 2. Fallback: Check users table
        try {
          const { data: usersData, error: userErr } = await client.from('users').select('*').ilike('email', cleanEmail).limit(1);
          if (!userErr && usersData && usersData.length > 0 && usersData[0].shop_id) {
            const { data: shopData } = await client.from('shops').select('*').eq('id', usersData[0].shop_id).limit(1);
            if (shopData && shopData.length > 0) {
              return { user: usersData[0] as User, shop: shopData[0] as Shop };
            }
          }
        } catch (err) {
          console.warn('getShopByEmail users table query warning:', err);
        }
      }
    }

    // Fallback to local storage shops
    const shops = getStorageItem<Shop[]>('shops', []);
    const matchedShop = shops.find(s => s.email?.toLowerCase() === cleanEmail);
    if (matchedShop) {
      const user: User = {
        id: `usr-${matchedShop.id}`,
        shop_id: matchedShop.id,
        name: `${matchedShop.owner_name} (Owner)`,
        role: 'Shop Owner',
        email: cleanEmail,
        created_at: matchedShop.created_at,
      };
      return { user, shop: matchedShop };
    }

    return null;
  },

  async getAllShops(): Promise<Shop[]> {
    if (typeof window !== 'undefined') {
      try {
        const authSession = await supabase?.auth.getSession();
        const accessToken = authSession?.data?.session?.access_token || '';
        const res = await fetch('/api/admin/shops', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body.shops)) return body.shops as Shop[];
        }
      } catch (err) {
        console.warn('getAllShops API fetch warning:', err);
      }
    }

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { data, error } = await client.from('shops').select('*').order('created_at', { ascending: false });
          if (!error && data) {
            return data.map((s: any) => ({
              ...s,
              is_active: s.is_active ?? true
            })) as Shop[];
          }
        }
      } catch (err) {
        console.warn('getAllShops Supabase warning:', err);
      }
    }
    return getStorageItem<Shop[]>('shops', []);
  },

  async toggleShopStatus(shopId: string, isActive: boolean): Promise<boolean> {
    const shops = getStorageItem<Shop[]>('shops', []);
    const idx = shops.findIndex(s => s.id === shopId);
    if (idx !== -1) {
      shops[idx].is_active = isActive;
    }
    setStorageItem('shops', shops);

    // Sync active session if logged in
    const currentSession = getSessionUser();
    if (currentSession && currentSession.shop && currentSession.shop.id === shopId) {
      currentSession.shop.is_active = isActive;
      setSessionUser(currentSession);
    }

    if (isRealSupabase && supabase) {
      try {
        const { error } = await supabase.from('shops').update({ is_active: isActive }).eq('id', shopId);
        if (error) {
          console.warn('Supabase toggleShopStatus error:', error.message);
        }
      } catch (err) {
        console.warn('toggleShopStatus Supabase exception:', err);
      }
    }
    broadcastDbUpdate('shops');
    return true;
  },

  async deleteShop(shopId: string): Promise<boolean> {
    const shops = getStorageItem<Shop[]>('shops', []);
    const updated = shops.filter(s => s.id !== shopId);
    setStorageItem('shops', updated);

    if (isRealSupabase && supabase) {
      try {
        await supabase.from('users').delete().eq('shop_id', shopId);
        await supabase.from('branches').delete().eq('shop_id', shopId);
        const { error } = await supabase.from('shops').delete().eq('id', shopId);
        if (error) console.warn('deleteShop Supabase warning:', error.message);
      } catch (err) {
        console.warn('deleteShop Supabase exception:', err);
      }
    }
    broadcastDbUpdate('shops');
    return true;
  },

  async resetShopOwnerPassword(email: string, newPassword?: string): Promise<{ success: boolean; message: string }> {
    if (newPassword && typeof window !== 'undefined') {
      try {
        const accessToken = await getAccessToken();
        const res = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ email, newPassword }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          return { success: true, message: data.message };
        } else if (data.error) {
          return { success: false, message: data.error };
        }
      } catch (err: any) {
        console.warn('Direct password reset exception:', err);
      }
    }

    if (isRealSupabase && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        return { success: true, message: `Password reset instructions sent to ${email}` };
      } catch (err: any) {
        return { success: false, message: err.message || 'Failed to send password reset email' };
      }
    }
    return { success: true, message: `Password reset link generated for ${email}` };
  },

  async updateShopGoldRates(shopId: string, gold24k: number, gold22k: number, gold20k: number = 6375, gold18k: number = 5738, silver1kg: number = 95000): Promise<boolean> {
    const silverPerGram = Number((silver1kg / 1000).toFixed(2));
    const shops = getStorageItem<Shop[]>('shops', []);
    const idx = shops.findIndex(s => s.id === shopId);
    if (idx !== -1) {
      shops[idx].gold_rate_24k = gold24k;
      shops[idx].gold_rate_22k = gold22k;
      shops[idx].gold_rate_20k = gold20k;
      shops[idx].gold_rate_18k = gold18k;
      shops[idx].silver_rate_1kg = silver1kg;
      shops[idx].silver_rate_per_gram = silverPerGram;
      setStorageItem('shops', shops);
    }

    if (isRealSupabase && supabase) {
      try {
        const { error } = await supabase
          .from('shops')
          .update({
            gold_rate_24k: gold24k,
            gold_rate_22k: gold22k,
            gold_rate_20k: gold20k,
            gold_rate_18k: gold18k,
            silver_rate_1kg: silver1kg,
            silver_rate_per_gram: silverPerGram,
          })
          .eq('id', shopId);

        if (error) {
          console.warn('Supabase updateShopGoldRates warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase updateShopGoldRates exception:', err);
      }
    }

    broadcastDbUpdate('shops');
    return true;
  },

  async updateShopLiveRateMode(shopId: string, useLiveRates: boolean): Promise<boolean> {
    const shops = getStorageItem<Shop[]>('shops', []);
    const idx = shops.findIndex(s => s.id === shopId);
    if (idx !== -1) {
      shops[idx].use_live_rates = useLiveRates;
      shops[idx].last_rate_sync_at = new Date().toISOString();
      setStorageItem('shops', shops);
    }

    if (isRealSupabase && supabase) {
      try {
        await supabase
          .from('shops')
          .update({
            use_live_rates: useLiveRates,
            last_rate_sync_at: new Date().toISOString(),
          })
          .eq('id', shopId);
      } catch (err) {
        console.warn('updateShopLiveRateMode warning:', err);
      }
    }

    broadcastDbUpdate('shops');
    return true;
  },

  // ── Customer API ──────────────────────────────────────────
  async getCustomers(shopId: string): Promise<Customer[]> {
    if (!shopId) return [];

    const cacheKey = `customers_${shopId}`;
    const cached = dbQueryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { data, error } = await client
            .from('customers')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (!error && data) {
            const refreshed = await Promise.all(
              (data as Customer[]).map(async (c) => {
                const photo_url = c.photo_url ? await getSignedDocumentUrl(c.shop_id, c.photo_url) : c.photo_url;
                const aadhaar_url = c.aadhaar_url ? await getSignedDocumentUrl(c.shop_id, c.aadhaar_url) : c.aadhaar_url;
                const aadhaar_back_url = c.aadhaar_back_url ? await getSignedDocumentUrl(c.shop_id, c.aadhaar_back_url) : c.aadhaar_back_url;
                const pan_url = c.pan_url ? await getSignedDocumentUrl(c.shop_id, c.pan_url) : c.pan_url;
                return {
                  ...c,
                  photo_url,
                  aadhaar_url,
                  aadhaar_back_url,
                  pan_url,
                };
              })
            );
            dbQueryCache.set(cacheKey, { data: refreshed, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
            return refreshed;
          }
        }
      } catch (err) {
        console.warn('getCustomers Supabase fetch warning:', err);
      }
    }

    const localCustomers = getStorageItem<Customer[]>('customers', DEFAULT_CUSTOMERS).filter(c => c.shop_id === shopId && !c.deleted_at);
    dbQueryCache.set(cacheKey, { data: localCustomers, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
    return localCustomers;
  },

  async createCustomer(customer: Omit<Customer, 'id' | 'created_at'> & { id?: string; request_uuid?: string }): Promise<Customer> {
    const localCustomers = getStorageItem<Customer[]>('customers', DEFAULT_CUSTOMERS);

    // Request UUID Idempotency Check: Drop duplicated API requests with same request_uuid
    if (customer.request_uuid) {
      if (processedRequestUuidSet.has(customer.request_uuid)) {
        console.warn(`[db.createCustomer] Duplicate submission request with UUID ${customer.request_uuid} dropped.`);
        const existing = localCustomers.find(
          c => c.shop_id === customer.shop_id && c.mobile_number === customer.mobile_number?.trim() && !c.deleted_at
        );
        if (existing) return existing;
      }
      processedRequestUuidSet.add(customer.request_uuid);
      if (processedRequestUuidSet.size > 1000) {
        const first = processedRequestUuidSet.values().next().value;
        if (first) processedRequestUuidSet.delete(first);
      }
    }

    // Storage / Database Level Idempotency Check:
    // If a customer with the same mobile_number already exists for this shop, return the existing record to prevent duplicates.
    if (customer.mobile_number) {
      const cleanMobile = customer.mobile_number.trim();
      const existing = localCustomers.find(
        c => c.shop_id === customer.shop_id && c.mobile_number === cleanMobile && !c.deleted_at
      );
      if (existing) {
        console.warn(`[db.createCustomer] Customer with mobile ${cleanMobile} already exists for shop ${customer.shop_id}. Returning existing customer record.`);
        return existing;
      }
    }

    const { request_uuid: _reqUuid, ...cleanCustomerData } = customer;
    const custId = customer.id || (await generateNextCustomerId(customer.shop_id));
    const newCust: Customer = {
      ...cleanCustomerData,
      id: custId,
      created_at: new Date().toISOString(),
    };

    // CRIT-02 Remediation: Sanitize / Upload Base64 Data URLs to Storage Bucket
    if (isRealSupabase) {
      try {
        if (newCust.photo_url && isBase64DataUrl(newCust.photo_url)) {
          newCust.photo_url = (await sanitizeStoragePathOrUpload(newCust.shop_id, newCust.id, newCust.photo_url, 'Passport-Photo', { customerName: newCust.full_name })) || undefined;
        }
        if (newCust.aadhaar_url && isBase64DataUrl(newCust.aadhaar_url)) {
          newCust.aadhaar_url = (await sanitizeStoragePathOrUpload(newCust.shop_id, newCust.id, newCust.aadhaar_url, 'Aadhaar-Front', { customerName: newCust.full_name })) || undefined;
        }
        if (newCust.aadhaar_back_url && isBase64DataUrl(newCust.aadhaar_back_url)) {
          newCust.aadhaar_back_url = (await sanitizeStoragePathOrUpload(newCust.shop_id, newCust.id, newCust.aadhaar_back_url, 'Aadhaar-Back', { customerName: newCust.full_name })) || undefined;
        }
        if (newCust.pan_url && isBase64DataUrl(newCust.pan_url)) {
          newCust.pan_url = (await sanitizeStoragePathOrUpload(newCust.shop_id, newCust.id, newCust.pan_url, 'PAN-Card', { customerName: newCust.full_name })) || undefined;
        }
      } catch (err: any) {
        console.error('Customer document storage upload error:', err);
        throw new Error(`Document upload error: ${err.message || 'Failed to upload document to storage bucket.'}`);
      }
    }

    const filteredLocal = localCustomers.filter(c => c.id !== newCust.id);
    filteredLocal.unshift(newCust);
    setStorageItem('customers', filteredLocal, newCust.shop_id);

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { total_loans_count, active_loans_count, version, request_uuid, ...dbPayload } = newCust as any;
          let { data, error } = await client.from('customers').insert(dbPayload).select().single();
          if (error && (error.message.includes('duplicate key') || error.message.includes('customers_pkey'))) {
            const retryId = `cust-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            newCust.id = retryId;
            dbPayload.id = retryId;
            const { data: retryData, error: retryErr } = await client.from('customers').insert(dbPayload).select().single();
            if (retryErr) {
              console.error('Supabase createCustomer retry error:', retryErr.message);
              throw new Error(`Database error: ${retryErr.message}`);
            }
          } else if (error) {
            console.error('Supabase createCustomer error:', error.message, error);
            throw new Error(`Database error: ${error.message}`);
          }
        }
      } catch (err: any) {
        console.error('Supabase createCustomer exception:', err);
        throw err;
      }
    }

    broadcastDbUpdate('customers');

    const session = getSessionUser();
    logAuditEvent(
      newCust.shop_id,
      session?.user?.id || 'system',
      session?.user?.name || 'Staff User',
      'CREATE',
      'customers',
      newCust.id,
      null,
      { full_name: newCust.full_name, mobile_number: newCust.mobile_number }
    ).catch(() => {});

    return newCust;
  },

  async updateCustomerMobile(customerId: string, newMobile: string): Promise<boolean> {
    const customers = getStorageItem<Customer[]>('customers', DEFAULT_CUSTOMERS);
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx !== -1) {
      customers[idx].mobile_number = newMobile;
      setStorageItem('customers', customers);
    }

    if (isRealSupabase && supabase) {
      try {
        await supabase
          .from('customers')
          .update({ mobile_number: newMobile })
          .eq('id', customerId);
      } catch (err) {
        console.warn('updateCustomerMobile warning:', err);
      }
    }

    broadcastDbUpdate('customers');
    return true;
  },

  async softDeleteCustomer(customerId: string): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const customers = getStorageItem<Customer[]>('customers', DEFAULT_CUSTOMERS);
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx !== -1) {
      customers[idx].deleted_at = timestamp;
      setStorageItem('customers', customers);
    }

    if (isRealSupabase && supabase) {
      try {
        await supabase
          .from('customers')
          .update({ deleted_at: timestamp })
          .eq('id', customerId);
        
        // Purge customer documents and gold images from Supabase Storage bucket
        const cust = customers[idx];
        if (cust?.shop_id) {
          deleteCustomerFiles(cust.shop_id, customerId).catch((err) =>
            console.warn('deleteCustomerFiles cleanup warning:', err)
          );
        }
      } catch (err) {
        console.warn('softDeleteCustomer warning:', err);
      }
    }

    broadcastDbUpdate('customers');
    return true;
  },

  // ── Gold Item & Valuation API ──────────────────────────────
  async getGoldItems(shopId: string): Promise<GoldItem[]> {
    if (!shopId) return [];

    const cacheKey = `gold_items_${shopId}`;
    const cached = dbQueryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { data, error } = await client
            .from('gold_items')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (!error && data) {
            const refreshed = await Promise.all(
              (data as GoldItem[]).map(async (g) => {
                const rawUrl = g.photo_url || (g as any).front_image_url || (g as any).back_image_url || '';
                const photo_url = rawUrl ? await getSignedDocumentUrl(g.shop_id || shopId, rawUrl) : '';
                return {
                  ...g,
                  photo_url,
                  front_image_url: photo_url,
                };
              })
            );
            dbQueryCache.set(cacheKey, { data: refreshed, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
            return refreshed;
          }
        }
      } catch (err) {
        console.warn('getGoldItems fetch warning:', err);
      }
    }

    const localItems = getStorageItem<GoldItem[]>('gold_items', DEFAULT_GOLD_ITEMS).filter(g => g.shop_id === shopId && !g.deleted_at);
    dbQueryCache.set(cacheKey, { data: localItems, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
    return localItems;
  },

  async createGoldItem(item: Omit<GoldItem, 'id' | 'created_at'>): Promise<GoldItem> {
    let finalPhotoUrl = item.photo_url || '';

    if (finalPhotoUrl && finalPhotoUrl.startsWith('data:')) {
      try {
        const localCustomers = getStorageItem<Customer[]>('customers', DEFAULT_CUSTOMERS);
        const cust = localCustomers.find((c) => c.id === item.customer_id);
        const customerName = cust ? cust.full_name : 'Borrower-Customer';

        finalPhotoUrl = await uploadToSupabaseStorage(finalPhotoUrl, {
          shopId: item.shop_id,
          customerName: customerName,
          customerId: item.customer_id,
          uniqueId: `ornament-${Date.now()}`,
          docType: 'Pledged-Gold-Ornament',
          ornamentDescription: item.ornament_type,
        });
      } catch (err) {
        console.warn('Auto upload of gold ornament photo to storage warning:', err);
      }
    }

    const itemId = await generateNextGoldItemId(item.shop_id);
    const newItem: GoldItem = {
      ...item,
      photo_url: finalPhotoUrl,
      id: itemId,
      created_at: new Date().toISOString(),
    };

    const localItems = getStorageItem<GoldItem[]>('gold_items', DEFAULT_GOLD_ITEMS);
    localItems.unshift(newItem);
    setStorageItem('gold_items', localItems);

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { customer, loans, version, request_uuid, ...rawPayload } = newItem as any;
          const dbPayload = {
            ...rawPayload,
            front_image_url: rawPayload.front_image_url || rawPayload.photo_url || '',
          };
          delete dbPayload.photo_url;

          let { error } = await client.from('gold_items').insert(dbPayload);
          if (error && (error.message.includes('duplicate key') || error.message.includes('gold_items_pkey'))) {
            const retryId = `item-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            newItem.id = retryId;
            dbPayload.id = retryId;
            const { error: retryErr } = await client.from('gold_items').insert(dbPayload);
            if (retryErr) throw new Error(`Database error: ${retryErr.message}`);
          } else if (error) {
            console.error('Supabase createGoldItem error:', error.message, error);
            throw new Error(`Database error: ${error.message}`);
          }
        }
      } catch (err: any) {
        console.warn('createGoldItem warning:', err);
        throw err;
      }
    }

    broadcastDbUpdate('gold_items');
    return newItem;
  },

  // ── Disbursements API ──────────────────────────────────────
  async getDisbursements(shopId: string, loanId?: string): Promise<LoanDisbursement[]> {
    const activeSession = getSessionUser();
    const targetShopId = shopId || activeSession?.shop?.id || activeSession?.user?.shop_id || 'shared';

    const cacheKey = `disbursements_${targetShopId}_${loanId || 'all'}`;
    const cached = dbQueryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let cloudDisbursements: LoanDisbursement[] = [];
    if (isRealSupabase && supabase) {
      try {
        let q = supabase
          .from('loan_disbursements')
          .select('*')
          .is('deleted_at', null)
          .order('disbursement_number', { ascending: true });

        if (shopId) {
          q = q.eq('shop_id', shopId);
        }
        if (loanId) {
          q = q.or(`loan_id.eq.${loanId},loan_id.eq.loan-${loanId}`);
        }

        const { data, error } = await q;
        if (!error && data) {
          cloudDisbursements = data as LoanDisbursement[];
        }
      } catch (err) {
        console.warn('getDisbursements Supabase warning:', err);
      }
    }

    // Load from tenant-scoped storage and shared storage
    const scopedDisbs = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS, targetShopId);
    const sharedDisbs = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS);
    const allLocal = [...scopedDisbs, ...sharedDisbs];

    const localDisbursements = allLocal.filter(d => {
      if (d.deleted_at) return false;
      if (shopId && d.shop_id && d.shop_id !== shopId) return false;
      if (loanId) {
        return d.loan_id === loanId || String(d.loan_id).toLowerCase() === String(loanId).toLowerCase();
      }
      return true;
    });

    const mergedMap = new Map<string, LoanDisbursement>();
    cloudDisbursements.forEach(d => mergedMap.set(d.id, d));
    localDisbursements.forEach(d => mergedMap.set(d.id, d));

    let result = Array.from(mergedMap.values());

    // Auto-synthesize Disbursement #1 if missing for a specific loan
    if (loanId) {
      const allLoans = [
        ...getStorageItem<Loan[]>('loans', DEFAULT_LOANS, targetShopId),
        ...getStorageItem<Loan[]>('loans', DEFAULT_LOANS),
      ];
      const targetLoan = allLoans.find(l => (l.id === loanId || l.loan_number === loanId));
      if (targetLoan && !result.some(d => d.disbursement_number === 1)) {
        const initialDisb: LoanDisbursement = {
          id: `disb-${targetLoan.id}-1`,
          loan_id: targetLoan.id,
          shop_id: targetLoan.shop_id || targetShopId,
          disbursement_number: 1,
          amount: Number(targetLoan.loan_amount) || 0,
          interest_rate: targetLoan.interest_rate || 1.5,
          disbursement_date: targetLoan.loan_date || new Date().toISOString().split('T')[0],
          interest_start_date: targetLoan.loan_date || new Date().toISOString().split('T')[0],
          due_date: targetLoan.due_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
          tenure_months: targetLoan.tenure_months || 12,
          status: targetLoan.status === 'Closed' ? 'Settled' : 'Active',
          principal_outstanding: targetLoan.status === 'Closed' ? 0 : Number(targetLoan.loan_amount),
          total_interest_paid: 0,
          payment_method: 'Cash',
          notes: 'Initial Gold Pledge Disbursement #1',
          created_at: targetLoan.created_at || new Date().toISOString(),
        };
        result.unshift(initialDisb);
      }
    }

    result.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

    // Merge into existing storage rather than overwriting (avoids wiping disbursements for other loans)
    if (loanId) {
      const existingScoped = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS, targetShopId);
      const existingShared = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS);
      const mergeInto = (existing: LoanDisbursement[]) => {
        const map = new Map<string, LoanDisbursement>();
        existing.forEach(d => map.set(d.id, d));
        result.forEach(d => map.set(d.id, d));
        return Array.from(map.values());
      };
      setStorageItem('loan_disbursements', mergeInto(existingScoped), targetShopId);
      setStorageItem('loan_disbursements', mergeInto(existingShared));
    } else {
      setStorageItem('loan_disbursements', result, targetShopId);
      setStorageItem('loan_disbursements', result);
    }

    dbQueryCache.set(cacheKey, { data: result, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
    return result;
  },

  async addLoanDisbursement(arg1: string | Omit<LoanDisbursement, 'id' | 'created_at'>, arg2?: any): Promise<LoanDisbursement> {
    const disbursementData: Omit<LoanDisbursement, 'id' | 'created_at'> = typeof arg1 === 'string'
      ? { ...arg2, loan_id: arg1 }
      : arg1;

    const activeSession = getSessionUser();
    const sessionShopId = activeSession?.shop?.id || activeSession?.user?.shop_id || '';

    // Find target loan across all storage keys
    const allLoans = [
      ...getStorageItem<Loan[]>('loans', DEFAULT_LOANS, sessionShopId),
      ...getStorageItem<Loan[]>('loans', DEFAULT_LOANS),
    ];
    const targetLoan = allLoans.find(l => l.id === disbursementData.loan_id || l.loan_number === disbursementData.loan_id) || null;
    const targetShopId = disbursementData.shop_id || targetLoan?.shop_id || sessionShopId || 'shared';

    // Fetch all existing disbursements for this loan
    let existingLoanDisbursements = await this.getDisbursements(targetShopId, disbursementData.loan_id);

    // If no Disbursement #1 exists yet for this loan, synthesize Disbursement #1
    if (targetLoan && !existingLoanDisbursements.some(d => d.disbursement_number === 1)) {
      const initialDisbId = `disb-${targetLoan.id}-1`;
      const initialDisb: LoanDisbursement = {
        id: initialDisbId,
        loan_id: targetLoan.id,
        shop_id: targetShopId,
        disbursement_number: 1,
        amount: Number(targetLoan.loan_amount) || 0,
        interest_rate: targetLoan.interest_rate || disbursementData.interest_rate || 1.5,
        disbursement_date: targetLoan.loan_date || disbursementData.disbursement_date || new Date().toISOString().split('T')[0],
        interest_start_date: targetLoan.loan_date || disbursementData.interest_start_date || new Date().toISOString().split('T')[0],
        due_date: targetLoan.due_date || disbursementData.due_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        tenure_months: targetLoan.tenure_months || 12,
        status: targetLoan.status === 'Closed' ? 'Settled' : 'Active',
        principal_outstanding: targetLoan.status === 'Closed' ? 0 : Number(targetLoan.loan_amount),
        total_interest_paid: 0,
        payment_method: 'Cash',
        notes: 'Initial Gold Pledge Disbursement #1',
        created_at: targetLoan.created_at || new Date().toISOString(),
      };
      
      existingLoanDisbursements = [initialDisb, ...existingLoanDisbursements];

      if (isRealSupabase && supabase) {
        try {
          await supabase.from('loan_disbursements').insert(initialDisb);
        } catch (err) {
          console.warn('Initial disbursement seed warning:', err);
        }
      }
    }

    const nextDisbursementNum = existingLoanDisbursements.length + 1;
    const newDisbId = `disb-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDisb: LoanDisbursement = {
      ...disbursementData,
      id: newDisbId,
      loan_id: targetLoan ? targetLoan.id : disbursementData.loan_id,
      shop_id: targetShopId,
      disbursement_number: nextDisbursementNum,
      amount: Number(disbursementData.amount) || 0,
      interest_rate: Number(disbursementData.interest_rate) || (targetLoan?.interest_rate || 1.5),
      disbursement_date: disbursementData.disbursement_date || new Date().toISOString().split('T')[0],
      interest_start_date: disbursementData.interest_start_date || disbursementData.disbursement_date || new Date().toISOString().split('T')[0],
      due_date: disbursementData.due_date || (targetLoan?.due_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0]),
      tenure_months: Number(disbursementData.tenure_months) || (targetLoan?.tenure_months || 12),
      status: 'Active',
      principal_outstanding: Number(disbursementData.amount) || 0,
      total_interest_paid: 0,
      payment_method: disbursementData.payment_method || 'Cash',
      notes: disbursementData.notes || `Top-up tranche #${nextDisbursementNum}`,
      created_at: new Date().toISOString(),
    };

    let resultDisb = newDisb;

    if (isRealSupabase && supabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { payments, accrued_interest, total_balance_due, ...dbPayload } = newDisb as any;
          const { data, error } = await client.from('loan_disbursements').insert(dbPayload).select().single();
          if (!error && data) {
            resultDisb = data as LoanDisbursement;
          } else if (error) {
            console.warn('Supabase addLoanDisbursement insert warning:', error.message);
          }
        }
      } catch (err) {
        console.warn('Supabase addLoanDisbursement exception:', err);
      }
    }

    const updatedLoanDisbursements = [...existingLoanDisbursements.filter(d => d.id !== resultDisb.id), resultDisb];
    updatedLoanDisbursements.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

    // Save in storage
    const localScoped = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS, targetShopId);
    const combinedDisbs = [...localScoped.filter(d => d.id !== resultDisb.id), resultDisb];
    setStorageItem('loan_disbursements', combinedDisbs, targetShopId);
    setStorageItem('loan_disbursements', combinedDisbs);

    // Update the master Loan record to reflect new total cumulative principal: Disbursement #1 + Disbursement #2 + ...
    const activeLoanId = targetLoan ? targetLoan.id : disbursementData.loan_id;
    const allTranchesForLoan = updatedLoanDisbursements.filter(d => (d.loan_id === activeLoanId || (targetLoan && d.loan_id === targetLoan.loan_number)) && !d.deleted_at);
    const newTotalPrincipal = allTranchesForLoan.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const updateLoanList = (list: Loan[]) => {
      return list.map(l => {
        if (l.id === activeLoanId || l.loan_number === activeLoanId) {
          return {
            ...l,
            loan_amount: newTotalPrincipal,
            total_disbursed: newTotalPrincipal,
            status: 'Active' as any,
            disbursements: allTranchesForLoan,
          };
        }
        return l;
      });
    };

    const loansScoped = getStorageItem<Loan[]>('loans', DEFAULT_LOANS, targetShopId);
    setStorageItem('loans', updateLoanList(loansScoped), targetShopId);

    const loansShared = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);
    setStorageItem('loans', updateLoanList(loansShared));

    if (isRealSupabase && supabase && targetLoan) {
      try {
        await supabase.from('loans').update({ loan_amount: newTotalPrincipal, status: 'Active' }).eq('id', targetLoan.id);
      } catch (err) {
        console.warn('Supabase loan total amount update warning:', err);
      }
    }

    clearDbCache();
    broadcastDbUpdate('loan_disbursements');
    broadcastDbUpdate('loans');

    const session = getSessionUser();
    logAuditEvent(
      targetShopId,
      session?.user?.id || 'system',
      session?.user?.name || 'Staff User',
      'CREATE',
      'loan_disbursements',
      resultDisb.id,
      null,
      { loan_id: resultDisb.loan_id, amount: resultDisb.amount, disbursement_number: resultDisb.disbursement_number }
    ).catch(() => {});

    return resultDisb;
  },

  // ── Loans API ──────────────────────────────────────────────
  async getLoans(shopId: string): Promise<Loan[]> {
    if (!shopId) return [];

    const cacheKey = `loans_${shopId}`;
    const cached = dbQueryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let resultLoans: Loan[] = [];

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { data, error } = await client
            .from('loans')
            .select('*, customer:customers(*), gold_item:gold_items(*), payments(*)')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (!error && data) {
            const [allDisbursements, allPayments] = await Promise.all([
              this.getDisbursements(shopId),
              this.getPayments(shopId),
            ]);

            const disbGroupMap = new Map<string, LoanDisbursement[]>();
            allDisbursements.forEach(d => {
              if (d && d.loan_id) {
                const lid = String(d.loan_id).trim();
                const existing = disbGroupMap.get(lid) || [];
                existing.push(d);
                disbGroupMap.set(lid, existing);
              }
            });

            const pmtGroupMap = new Map<string, Payment[]>();
            allPayments.forEach(p => {
              if (p && p.loan_id) {
                const lid = String(p.loan_id).trim();
                const existing = pmtGroupMap.get(lid) || [];
                existing.push(p);
                pmtGroupMap.set(lid, existing);
              }
            });

            resultLoans = await Promise.all(
              (data as any[]).map(async (loan) => {
                const cust = Array.isArray(loan.customer) ? loan.customer[0] : (loan.customer || {
                  id: loan.customer_id,
                  full_name: (loan as any).customer_name || 'Customer Record Unlinked',
                  mobile_number: (loan as any).customer_mobile || 'N/A',
                });

                let rawGold = Array.isArray(loan.gold_item) ? loan.gold_item[0] : (loan.gold_item || {});
                if (rawGold && (rawGold.photo_url || (rawGold as any).front_image_url || (rawGold as any).back_image_url)) {
                  const rawUrl = rawGold.photo_url || (rawGold as any).front_image_url || (rawGold as any).back_image_url || '';
                  const photo_url = rawUrl ? await getSignedDocumentUrl(loan.shop_id, rawUrl) : '';
                  rawGold = {
                    ...rawGold,
                    photo_url,
                    front_image_url: photo_url,
                  };
                }

                const embeddedPmts = (loan.payments || []).map((p: any) => ({ ...p, amount: Number(p.amount) || 0 }));
                const pmtMap = new Map<string, Payment>();
                const fromGroup = pmtGroupMap.get(String(loan.id).trim()) || (loan.loan_number ? pmtGroupMap.get(String(loan.loan_number).trim()) : null) || [];
                fromGroup.forEach(p => pmtMap.set(p.id, p));
                embeddedPmts.forEach((p: Payment) => pmtMap.set(p.id, p));
                const pmts = Array.from(pmtMap.values()).sort((a, b) => new Date(b.created_at || b.payment_date || 0).getTime() - new Date(a.created_at || a.payment_date || 0).getTime());
                
                let tranches = disbGroupMap.get(String(loan.id).trim()) || (loan.loan_number ? disbGroupMap.get(String(loan.loan_number).trim()) : null) || [];
                if (!tranches.some(t => t.disbursement_number === 1)) {
                  const initialDisb: LoanDisbursement = {
                    id: `disb-${loan.id}-1`,
                    loan_id: loan.id,
                    shop_id: loan.shop_id,
                    disbursement_number: 1,
                    amount: Number(loan.loan_amount) || 0,
                    interest_rate: loan.interest_rate || 1.5,
                    disbursement_date: loan.loan_date || new Date().toISOString().split('T')[0],
                    interest_start_date: loan.loan_date || new Date().toISOString().split('T')[0],
                    due_date: loan.due_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
                    tenure_months: loan.tenure_months || 12,
                    status: loan.status === 'Closed' ? 'Settled' : 'Active',
                    principal_outstanding: loan.status === 'Closed' ? 0 : Number(loan.loan_amount),
                    payment_method: 'Cash',
                    notes: 'Initial Gold Pledge Disbursement #1',
                    created_at: loan.created_at || new Date().toISOString(),
                  };
                  tranches = [initialDisb, ...tranches];
                }
                tranches.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

                const fin = calculateLoanFinancials(
                  loan.loan_amount,
                  loan.interest_rate,
                  loan.loan_date,
                  loan.due_date,
                  pmts,
                  loan.repayment_model || 'Bullet Repayment',
                  loan.tenure_months || 12,
                  tranches
                );

                const isFullySettled = fin.remainingPrincipal <= 0 || fin.totalBalanceDue <= 0 || (loan.status as string) === 'Closed' || (loan.status as string) === 'Settled';
                const effectiveStatus: LoanStatus = isFullySettled
                  ? 'Closed'
                  : loan.status === 'Auctioned'
                  ? 'Auctioned'
                  : fin.isOverdue
                  ? 'Overdue'
                  : (loan.status || 'Active');

                return {
                  ...loan,
                  status: effectiveStatus,
                  customer: cust,
                  gold_item: rawGold,
                  payments: pmts,
                  disbursements: tranches,
                  total_disbursed: fin.totalDisbursed || loan.loan_amount,
                  total_principal_outstanding: isFullySettled ? 0 : fin.remainingPrincipal,
                  accrued_interest: isFullySettled ? 0 : fin.netAccruedInterest,
                  total_balance_due: isFullySettled ? 0 : fin.totalBalanceDue,
                };
              })
            );

            dbQueryCache.set(cacheKey, { data: resultLoans, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
            return resultLoans;
          }
        }
      } catch (err) {
        console.warn('getLoans Supabase warning:', err);
      }
    }

    const [customersList, goldItemsList, paymentsList, allDisbursements] = await Promise.all([
      this.getCustomers(shopId),
      this.getGoldItems(shopId),
      this.getPayments(shopId),
      this.getDisbursements(shopId),
    ]);

    const goldMap = new Map<string, GoldItem>();
    goldItemsList.forEach(g => {
      if (g && g.id) goldMap.set(String(g.id).trim(), g);
    });

    const pmtGroupMap = new Map<string, Payment[]>();
    paymentsList.forEach(p => {
      if (p && p.loan_id) {
        const lid = String(p.loan_id).trim();
        const existing = pmtGroupMap.get(lid) || [];
        existing.push(p);
        pmtGroupMap.set(lid, existing);
      }
    });

    const disbGroupMap = new Map<string, LoanDisbursement[]>();
    allDisbursements.forEach(d => {
      if (d && d.loan_id) {
        const lid = String(d.loan_id).trim();
        const existing = disbGroupMap.get(lid) || [];
        existing.push(d);
        disbGroupMap.set(lid, existing);
      }
    });

    const localLoans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS).filter(l => l.shop_id === shopId && !l.deleted_at);
    resultLoans = localLoans.map((loan, idx) => {
      const cust = resolveLoanCustomer(loan, customersList, idx);

      const rawGold = (loan.gold_item_id ? goldMap.get(String(loan.gold_item_id).trim()) : null) || loan.gold_item;
      const gold = Array.isArray(rawGold) ? rawGold[0] : rawGold;

      const pmts = pmtGroupMap.get(String(loan.id).trim()) || (loan.loan_number ? pmtGroupMap.get(String(loan.loan_number).trim()) : null) || [];
      
      let tranches = disbGroupMap.get(String(loan.id).trim()) || (loan.loan_number ? disbGroupMap.get(String(loan.loan_number).trim()) : null) || [];
      if (!tranches.some(t => t.disbursement_number === 1)) {
        const initialDisb: LoanDisbursement = {
          id: `disb-${loan.id}-1`,
          loan_id: loan.id,
          shop_id: loan.shop_id,
          disbursement_number: 1,
          amount: Number(loan.loan_amount) || 0,
          interest_rate: loan.interest_rate || 1.5,
          disbursement_date: loan.loan_date || new Date().toISOString().split('T')[0],
          interest_start_date: loan.loan_date || new Date().toISOString().split('T')[0],
          due_date: loan.due_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
          tenure_months: loan.tenure_months || 12,
          status: loan.status === 'Closed' ? 'Settled' : 'Active',
          principal_outstanding: loan.status === 'Closed' ? 0 : Number(loan.loan_amount),
          payment_method: 'Cash',
          notes: 'Initial Gold Pledge Disbursement #1',
          created_at: loan.created_at || new Date().toISOString(),
        };
        tranches = [initialDisb, ...tranches];
      }
      tranches.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

      const fin = calculateLoanFinancials(
        loan.loan_amount,
        loan.interest_rate,
        loan.loan_date,
        loan.due_date,
        pmts,
        loan.repayment_model || 'Bullet Repayment',
        loan.tenure_months || 12,
        tranches
      );

      const isFullySettled = fin.remainingPrincipal <= 0 || fin.totalBalanceDue <= 0 || (loan.status as string) === 'Closed' || (loan.status as string) === 'Settled';
      const effectiveStatus: LoanStatus = isFullySettled
        ? 'Closed'
        : loan.status === 'Auctioned'
        ? 'Auctioned'
        : fin.isOverdue
        ? 'Overdue'
        : (loan.status || 'Active');

      return {
        ...loan,
        status: effectiveStatus,
        customer: cust,
        gold_item: gold,
        payments: pmts,
        disbursements: tranches,
        total_disbursed: fin.totalDisbursed || loan.loan_amount,
        total_principal_outstanding: isFullySettled ? 0 : fin.remainingPrincipal,
        accrued_interest: isFullySettled ? 0 : fin.netAccruedInterest,
        total_balance_due: isFullySettled ? 0 : fin.totalBalanceDue,
      };
    });

    dbQueryCache.set(cacheKey, { data: resultLoans, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
    return resultLoans;
  },

  async getLoanById(loanId: string, shopId?: string): Promise<Loan | null> {
    if (!loanId) return null;
    const target = loanId.toLowerCase();

    if (isRealSupabase && supabase) {
      try {
        let q = supabase
          .from('loans')
          .select('*, customer:customers(*), gold_item:gold_items(*), payments(*)')
          .or(`id.eq.${loanId},loan_number.eq.${loanId}`);
        if (shopId) q = q.eq('shop_id', shopId);
        const { data, error } = await q.limit(1);
        if (!error && data && data.length > 0) {
          const l = data[0];
          const activeShopId = l.shop_id || shopId || '';
          
          let cust = Array.isArray(l.customer) ? l.customer[0] : l.customer;
          if (!cust || !cust.full_name) {
            const customers = await this.getCustomers(activeShopId);
            cust = resolveLoanCustomer(l, customers, 0);
          }

          let gold = Array.isArray(l.gold_item) ? l.gold_item[0] : l.gold_item;
          if (!gold || !gold.ornament_type) {
            const goldItems = await this.getGoldItems(activeShopId);
            const rawGold = goldItems.find(g => g.id === l.gold_item_id || String(g.id).trim() === String(l.gold_item_id).trim());
            gold = rawGold || gold;
          }

          if (gold) {
            const rawUrl = gold.photo_url || gold.front_image_url || gold.back_image_url || '';
            const photo_url = rawUrl ? await getSignedDocumentUrl(activeShopId, rawUrl) : '';
            gold = {
              ...gold,
              photo_url,
              front_image_url: photo_url,
            };
          }

          const allPayments = await this.getPayments(activeShopId);
          const cloudPmts = (l.payments || []).map((p: any) => ({ ...p, amount: Number(p.amount) || 0 }));
          const pmtMap = new Map<string, Payment>();
          allPayments.filter((p: Payment) => p.loan_id === l.id || p.loan_id === l.loan_number).forEach((p: Payment) => pmtMap.set(p.id, p));
          cloudPmts.forEach((p: Payment) => pmtMap.set(p.id, p));
          const pmts = Array.from(pmtMap.values()).sort((a, b) => new Date(b.created_at || b.payment_date || 0).getTime() - new Date(a.created_at || a.payment_date || 0).getTime());

          // Fetch all disbursements (cloud + local storage merged)
          const fetchedTranches = await this.getDisbursements(activeShopId, l.id);
          const cloudTranches = Array.isArray(l.disbursements) ? l.disbursements : [];
          const trancheMap = new Map<string, LoanDisbursement>();
          cloudTranches.forEach((d: LoanDisbursement) => trancheMap.set(d.id, d));
          fetchedTranches.forEach((d: LoanDisbursement) => trancheMap.set(d.id, d));

          let tranches: LoanDisbursement[] = Array.from(trancheMap.values());
          if (!tranches.some(t => t.disbursement_number === 1)) {
            const initialDisb: LoanDisbursement = {
              id: `disb-${l.id}-1`,
              loan_id: l.id,
              shop_id: l.shop_id || activeShopId,
              disbursement_number: 1,
              amount: Number(l.loan_amount) || 0,
              interest_rate: l.interest_rate || 1.5,
              disbursement_date: l.loan_date || new Date().toISOString().split('T')[0],
              interest_start_date: l.loan_date || new Date().toISOString().split('T')[0],
              due_date: l.due_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
              tenure_months: l.tenure_months || 12,
              status: l.status === 'Closed' ? 'Settled' : 'Active',
              principal_outstanding: l.status === 'Closed' ? 0 : Number(l.loan_amount),
              total_interest_paid: 0,
              payment_method: 'Cash',
              notes: 'Initial Gold Pledge Disbursement #1',
              created_at: l.created_at || new Date().toISOString(),
            };
            tranches = [initialDisb, ...tranches];
          }
          tranches.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

          const fin = calculateLoanFinancials(
            l.loan_amount,
            l.interest_rate,
            l.loan_date,
            l.due_date,
            pmts,
            l.repayment_model || 'Bullet Repayment',
            l.tenure_months || 12,
            tranches
          );

          const isFullySettled = fin.remainingPrincipal <= 0 || fin.totalBalanceDue <= 0 || (l.status as string) === 'Closed' || (l.status as string) === 'Settled';
          const effectiveStatus: LoanStatus = isFullySettled
            ? 'Closed'
            : l.status === 'Auctioned'
            ? 'Auctioned'
            : fin.isOverdue
            ? 'Overdue'
            : (l.status || 'Active');

          return {
            ...l,
            status: effectiveStatus,
            customer: cust,
            gold_item: gold,
            payments: pmts,
            disbursements: tranches,
            total_disbursed: fin.totalDisbursed || l.loan_amount,
            total_principal_outstanding: isFullySettled ? 0 : fin.remainingPrincipal,
            total_interest_paid: fin.totalInterestPaid,
            accrued_interest: isFullySettled ? 0 : fin.netAccruedInterest,
            total_balance_due: isFullySettled ? 0 : fin.totalBalanceDue,
          } as Loan;
        }
      } catch (err) {
        console.warn('getLoanById Supabase warning:', err);
      }
    }

    const rawLoans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);
    const raw = rawLoans.find(l => (l.id.toLowerCase() === target || l.loan_number.toLowerCase() === target) && (!shopId || l.shop_id === shopId));
    if (!raw) return null;

    const targetShopId = raw.shop_id || shopId || '';
    const customers = targetShopId ? await this.getCustomers(targetShopId) : [];
    const goldItems = targetShopId ? await this.getGoldItems(targetShopId) : [];
    const payments = targetShopId ? await this.getPayments(targetShopId) : [];
    const pmts = payments.filter(p => p.loan_id === raw.id || p.loan_id === raw.loan_number);

    let rawTranches = await this.getDisbursements(targetShopId, raw.id);
    let tranches: LoanDisbursement[] = [...rawTranches];
    if (!tranches.some(t => t.disbursement_number === 1)) {
      const initialDisb: LoanDisbursement = {
        id: `disb-${raw.id}-1`,
        loan_id: raw.id,
        shop_id: raw.shop_id,
        disbursement_number: 1,
        amount: Number(raw.loan_amount) || 0,
        interest_rate: raw.interest_rate || 1.5,
        disbursement_date: raw.loan_date,
        interest_start_date: raw.loan_date,
        due_date: raw.due_date,
        tenure_months: raw.tenure_months || 12,
        status: raw.status === 'Closed' ? 'Settled' : 'Active',
        principal_outstanding: raw.status === 'Closed' ? 0 : Number(raw.loan_amount),
        total_interest_paid: 0,
        payment_method: 'Cash',
        notes: 'Initial Gold Pledge Disbursement #1',
        created_at: raw.created_at,
      };
      tranches = [initialDisb, ...tranches];
    }
    tranches.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

    const fin = calculateLoanFinancials(
      raw.loan_amount,
      raw.interest_rate,
      raw.loan_date,
      raw.due_date,
      pmts,
      raw.repayment_model || 'Bullet Repayment',
      raw.tenure_months || 12,
      tranches
    );

    const isFullySettled = fin.remainingPrincipal <= 0 || fin.totalBalanceDue <= 0 || (raw.status as string) === 'Closed' || (raw.status as string) === 'Settled';
    const effectiveStatus: LoanStatus = isFullySettled
      ? 'Closed'
      : raw.status === 'Auctioned'
      ? 'Auctioned'
      : fin.isOverdue
      ? 'Overdue'
      : (raw.status || 'Active');

    const cust = resolveLoanCustomer(raw, customers, 0);
    const rawGold = goldItems.find(g => g.id === raw.gold_item_id || String(g.id).trim() === String(raw.gold_item_id).trim()) || raw.gold_item;
    const gold = Array.isArray(rawGold) ? rawGold[0] : rawGold;

    return {
      ...raw,
      status: effectiveStatus,
      customer: cust,
      gold_item: gold,
      payments: pmts,
      disbursements: tranches,
      total_disbursed: fin.totalDisbursed || raw.loan_amount,
      total_principal_outstanding: isFullySettled ? 0 : fin.remainingPrincipal,
      total_interest_paid: fin.totalInterestPaid,
      accrued_interest: isFullySettled ? 0 : fin.netAccruedInterest,
      total_balance_due: isFullySettled ? 0 : fin.totalBalanceDue,
    };
  },

  async generateNextLoanNumber(shopId: string): Promise<string> {
    const activeShopId = shopId || 'shop-00001';
    let maxSeq = 0;
    const currentYear = new Date().getFullYear();

    if (isRealSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('loans')
          .select('loan_number')
          .eq('shop_id', activeShopId)
          .order('created_at', { ascending: false })
          .limit(25);

        if (!error && data && data.length > 0) {
          data.forEach((l) => {
            if (l.loan_number) {
              const digits = l.loan_number.match(/\d+/g);
              if (digits && digits.length > 0) {
                const lastDigit = parseInt(digits[digits.length - 1], 10);
                if (!isNaN(lastDigit) && lastDigit > maxSeq) {
                  maxSeq = lastDigit;
                }
              }
            }
          });
          const nextNum = maxSeq + 1;
          const padded = String(nextNum).padStart(4, '0');
          return `GL-${currentYear}-${padded}`;
        }
      } catch (err) {
        console.warn('generateNextLoanNumber DB query error:', err);
      }
    }

    const localLoans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS).filter(l => l.shop_id === activeShopId);
    localLoans.forEach((l) => {
      if (l.loan_number) {
        const digits = l.loan_number.match(/\d+/g);
        if (digits && digits.length > 0) {
          const lastDigit = parseInt(digits[digits.length - 1], 10);
          if (!isNaN(lastDigit) && lastDigit > maxSeq) maxSeq = lastDigit;
        }
      }
    });
    const nextNum = Math.max(localLoans.length, maxSeq) + 1;
    const padded = String(nextNum).padStart(4, '0');
    return `GL-${currentYear}-${padded}`;
  },

  async createLoan(loanData: Omit<Loan, 'id' | 'created_at'>): Promise<Loan> {
    let loanId = await generateNextLoanId(loanData.shop_id);
    let loanNum = loanData.loan_number || (await this.generateNextLoanNumber(loanData.shop_id));

    const newLoan: Loan = {
      ...loanData,
      id: loanId,
      loan_number: loanNum,
      created_at: new Date().toISOString(),
    };

    const localLoans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);
    localLoans.unshift(newLoan);
    setStorageItem('loans', localLoans);

    if (isRealSupabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { 
            customer, 
            gold_item, 
            payments, 
            accrued_interest, 
            total_balance_due, 
            tenure_months, 
            repayment_model, 
            version, 
            request_uuid, 
            ...dbPayload 
          } = newLoan as any;

          let { error } = await client.from('loans').insert(dbPayload);

          if (error && (error.message.includes('duplicate key') || error.message.includes('loans_pkey') || error.message.includes('loans_loan_number_key'))) {
            const retryId = `loan-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const retryNum = `GL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            newLoan.id = retryId;
            newLoan.loan_number = retryNum;
            dbPayload.id = retryId;
            dbPayload.loan_number = retryNum;

            const { error: retryErr } = await client.from('loans').insert(dbPayload);
            if (retryErr) throw new Error(`Database error: ${retryErr.message}`);
          } else if (error) {
            console.error('Supabase createLoan error:', error.message, error);
            throw new Error(`Database error: ${error.message}`);
          }
        }
      } catch (err: any) {
        console.warn('createLoan warning:', err);
        throw err;
      }
    }

    // Automatically seed and persist initial Disbursement #1
    const initialDisb: LoanDisbursement = {
      id: `disb-${newLoan.id}-1`,
      loan_id: newLoan.id,
      shop_id: newLoan.shop_id,
      disbursement_number: 1,
      amount: Number(newLoan.loan_amount) || 0,
      interest_rate: newLoan.interest_rate || 1.5,
      disbursement_date: newLoan.loan_date,
      interest_start_date: newLoan.loan_date,
      due_date: newLoan.due_date,
      tenure_months: newLoan.tenure_months || 12,
      status: 'Active',
      principal_outstanding: Number(newLoan.loan_amount) || 0,
      total_interest_paid: 0,
      payment_method: 'Cash',
      notes: 'Initial Gold Pledge Disbursement #1',
      created_at: newLoan.created_at,
    };

    const localDisbursements = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS);
    localDisbursements.push(initialDisb);
    setStorageItem('loan_disbursements', localDisbursements, newLoan.shop_id);

    if (isRealSupabase && supabase) {
      try {
        await supabase.from('loan_disbursements').insert(initialDisb);
      } catch (err) {
        console.warn('Initial disbursement insert warning:', err);
      }
    }

    broadcastDbUpdate('loan_disbursements');
    broadcastDbUpdate('loans');

    const session = getSessionUser();
    logAuditEvent(
      newLoan.shop_id,
      session?.user?.id || 'system',
      session?.user?.name || 'Staff User',
      'CREATE',
      'loans',
      newLoan.id,
      null,
      { loan_number: newLoan.loan_number, loan_amount: newLoan.loan_amount, customer_id: newLoan.customer_id }
    ).catch(() => {});

    return newLoan;
  },

  async updateLoanStatus(loanId: string, status: LoanStatus): Promise<boolean> {
    const loans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);
    const idx = loans.findIndex(l => l.id === loanId);
    if (idx !== -1) {
      loans[idx].status = status;
      if (status === 'Closed') {
        loans[idx].closed_date = new Date().toISOString().split('T')[0];
      }
      setStorageItem('loans', loans);
    }

    if (isRealSupabase && supabase) {
      try {
        const updateData: any = { status };
        if (status === 'Closed') {
          updateData.closed_date = new Date().toISOString().split('T')[0];
        }
        await supabase.from('loans').update(updateData).eq('id', loanId);
      } catch (err) {
        console.warn('updateLoanStatus warning:', err);
      }
    }

    broadcastDbUpdate('loans');
    return true;
  },

  async deleteLoan(loanId: string, shopId?: string): Promise<boolean> {
    const localLoans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);
    const existingLocal = localLoans.find(l => l.id === loanId || l.loan_number === loanId);
    if (existingLocal && (existingLocal.status === 'Active' || existingLocal.status === 'Overdue')) {
      throw new Error(`Cannot delete an ${existingLocal.status} loan (Loan #${existingLocal.loan_number}). Active & Overdue loans cannot be deleted.`);
    }

    if (isRealSupabase && supabase) {
      try {
        const client = getDbClient();
        if (client) {
          const { data: dbLoan } = await client
            .from('loans')
            .select('status, loan_number')
            .or(`id.eq.${loanId},loan_number.eq.${loanId}`)
            .maybeSingle();

          if (dbLoan && (dbLoan.status === 'Active' || dbLoan.status === 'Overdue')) {
            throw new Error(`Cannot delete an ${dbLoan.status} loan (Loan #${dbLoan.loan_number}). Active & Overdue loans cannot be deleted.`);
          }

          const { error } = await client
            .from('loans')
            .delete()
            .or(`id.eq.${loanId},loan_number.eq.${loanId}`);

          if (error) {
            console.warn('Direct delete warning, performing soft delete:', error.message);
            await client
              .from('loans')
              .update({ status: 'Closed', deleted_at: new Date().toISOString() })
              .or(`id.eq.${loanId},loan_number.eq.${loanId}`);
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Cannot delete an')) throw err;
        console.warn('deleteLoan error:', err);
      }
    }

    const updatedLocal = localLoans.filter(l => l.id !== loanId && l.loan_number !== loanId);
    setStorageItem('loans', updatedLocal);

    broadcastDbUpdate('loans');
    return true;
  },

  // ── Payments API ──────────────────────────────────────────
  async getPayments(shopId: string): Promise<Payment[]> {
    if (!shopId) return [];

    const cacheKey = `payments_${shopId}`;
    const cached = dbQueryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let cloudPayments: Payment[] = [];
    if (isRealSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*, loan:loans(*, customer:customers(*), gold_item:gold_items(*))')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          cloudPayments = data as Payment[];
        }
      } catch (err) {
        console.warn('getPayments fetch warning:', err);
      }
    }

    const localPayments = getStorageItem<Payment[]>('payments', DEFAULT_PAYMENTS);
    const localLoans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);

    const mergedMap = new Map<string, Payment>();
    cloudPayments.forEach((p) => mergedMap.set(p.id, p));
    localPayments.forEach((p) => {
      if (p.shop_id === shopId || !p.shop_id) {
        mergedMap.set(p.id, p);
      }
    });

    const allPaymentsArray = Array.from(mergedMap.values());
    const loanPmtsMap = new Map<string, Payment[]>();
    allPaymentsArray.forEach(p => {
      if (p && p.loan_id) {
        const lid = String(p.loan_id).trim();
        const existing = loanPmtsMap.get(lid) || [];
        existing.push(p);
        loanPmtsMap.set(lid, existing);
      }
    });

    const combined = allPaymentsArray.map((p) => {
      const rawLoan = localLoans.find((l) => l.id === p.loan_id) || p.loan;
      const loanPayments = loanPmtsMap.get(String(p.loan_id).trim()) || (rawLoan?.loan_number ? loanPmtsMap.get(String(rawLoan.loan_number).trim()) : null) || [];
      const loan = rawLoan ? { ...rawLoan, payments: loanPayments } : undefined;
      return { ...p, loan };
    });

    setStorageItem('payments', allPaymentsArray.map(p => ({ ...p, loan: undefined })));
    dbQueryCache.set(cacheKey, { data: combined, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
    return combined;
  },

  async recordPayment(paymentData: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const existingLocalPmts = getStorageItem<Payment[]>('payments', DEFAULT_PAYMENTS);

    let pmtId = (paymentData as any).id;
    if (!pmtId || existingLocalPmts.some(p => p.id === pmtId)) {
      pmtId = await generateNextPaymentId(paymentData.shop_id);
      let attempt = 1;
      let safeId = pmtId;
      while (existingLocalPmts.some(p => p.id === safeId)) {
        const numPart = parseInt(pmtId.replace(/^pmt-/i, ''), 10) || (Date.now() % 900000);
        safeId = formatHumanId('pmt', numPart + attempt, 6);
        attempt++;
      }
      pmtId = safeId;
    }

    const yr = new Date().getFullYear();
    const rawSeq = pmtId.replace(/^[a-z]+-/i, '');
    const receiptNum = paymentData.receipt_number || `REC-${yr}-${rawSeq}`;

    const newPmt: Payment = {
      ...paymentData,
      id: pmtId,
      receipt_number: receiptNum,
      created_at: new Date().toISOString(),
    };

    let resultPmt = newPmt;

    if (isRealSupabase && supabase) {
      try {
        const { loan, version, request_uuid, ...dbPayload } = newPmt as any;
        const { data, error } = await supabase.from('payments').insert(dbPayload).select().single();
        if (!error && data) {
          resultPmt = data as Payment;
        } else if (error) {
          console.warn('Supabase recordPayment insert warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase recordPayment exception:', err);
      }
    }

    // Always update local cache & broadcast for instant UI reactivity
    const pmts = getStorageItem<Payment[]>('payments', DEFAULT_PAYMENTS);
    const existingIdx = pmts.findIndex((p) => p.id === resultPmt.id);
    if (existingIdx !== -1) {
      pmts[existingIdx] = resultPmt;
    } else {
      pmts.unshift(resultPmt);
    }
    setStorageItem('payments', pmts);

    // Update target loan in local storage
    const loans = getStorageItem<Loan[]>('loans', DEFAULT_LOANS);
    const targetLoan = loans.find((l) => l.id === paymentData.loan_id || l.loan_number === paymentData.loan_id);
    if (targetLoan) {
      if (!targetLoan.payments) targetLoan.payments = [];
      const pIdx = targetLoan.payments.findIndex(p => p.id === resultPmt.id);
      if (pIdx !== -1) {
        targetLoan.payments[pIdx] = resultPmt;
      } else {
        targetLoan.payments.unshift(resultPmt);
      }

      const fin = calculateLoanFinancials(
        targetLoan.loan_amount,
        targetLoan.interest_rate,
        targetLoan.loan_date,
        targetLoan.due_date,
        targetLoan.payments,
        targetLoan.repayment_model || 'Bullet Repayment',
        targetLoan.tenure_months || 12
      );

      targetLoan.total_interest_paid = fin.totalInterestPaid;
      targetLoan.accrued_interest = fin.netAccruedInterest;
      targetLoan.total_balance_due = fin.totalBalanceDue;

      // Also update target disbursement if payment is targeted to a specific tranche
      if (paymentData.disbursement_id) {
        const localDisbs = getStorageItem<LoanDisbursement[]>('loan_disbursements', DEFAULT_DISBURSEMENTS);
        const disbIdx = localDisbs.findIndex(d => d.id === paymentData.disbursement_id);
        if (disbIdx !== -1) {
          const targetDisb = localDisbs[disbIdx];
          const disbPmts = (targetLoan.payments || []).filter(p => p.disbursement_id === targetDisb.id);
          const disbFin = calculateDisbursementFinancials(
            targetDisb,
            disbPmts,
            targetLoan.repayment_model || 'Bullet Repayment'
          );
          targetDisb.principal_outstanding = disbFin.remainingPrincipal;
          targetDisb.total_interest_paid = disbFin.totalInterestPaid;
          if (disbFin.totalBalanceDue <= 0 || paymentData.payment_type === 'Full Settlement') {
            targetDisb.status = 'Settled';
          }
          setStorageItem('loan_disbursements', localDisbs, targetDisb.shop_id);
          broadcastDbUpdate('loan_disbursements');
        }
      }

      const isFullyClosed = paymentData.payment_type === 'Full Settlement' || fin.totalBalanceDue <= 0 || fin.remainingPrincipal <= 0;
      if (isFullyClosed) {
        targetLoan.status = 'Closed';
        targetLoan.closed_date = new Date().toISOString().split('T')[0];
        targetLoan.total_principal_outstanding = 0;
        targetLoan.total_balance_due = 0;
        targetLoan.accrued_interest = 0;

        if (isRealSupabase && supabase) {
          try {
            await supabase
              .from('loans')
              .update({
                status: 'Closed',
                closed_date: new Date().toISOString().split('T')[0],
              })
              .or(`id.eq.${targetLoan.id},loan_number.eq.${targetLoan.id}`);

            await supabase
              .from('loan_disbursements')
              .update({
                status: 'Settled',
                principal_outstanding: 0,
              })
              .eq('loan_id', targetLoan.id);
          } catch (err) {
            console.warn('Supabase loan closure sync warning:', err);
          }
        }
      }
      setStorageItem('loans', loans);
      setStorageItem('loans', loans, targetLoan.shop_id);
    }

    clearDbCache();
    broadcastDbUpdate('payments');
    broadcastDbUpdate('loans');
    broadcastDbUpdate('loan_disbursements');
    return resultPmt;
  },

  // ── Dashboard Metrics API ──────────────────────────────────
  async getDashboardMetrics(shopId: string): Promise<DashboardMetrics> {
    if (!shopId) return {} as DashboardMetrics;

    const cacheKey = `dashboard_metrics_${shopId}`;
    const cached = dbQueryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const [loans, goldItems, payments, shop] = await Promise.all([
      this.getLoans(shopId),
      this.getGoldItems(shopId),
      this.getPayments(shopId),
      this.getShop(shopId),
    ]);

    const activeLoans = loans.filter(l => l.status === 'Active' || l.status === 'Overdue');
    const overdueLoans = loans.filter(l => l.status === 'Overdue');

    const totalPortfolioAum = activeLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0);
    const goldOnlyItems = goldItems.filter(g => g.metal_type !== 'Silver');
    const silverOnlyItems = goldItems.filter(g => g.metal_type === 'Silver');

    const totalPledgedGoldWeightGrams = goldOnlyItems.reduce((sum, g) => sum + (g.net_weight || 0), 0);
    const totalPledgedSilverWeightGrams = silverOnlyItems.reduce((sum, g) => sum + (g.net_weight || 0), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollectionsAmount = payments
      .filter(p => p.payment_date === todayStr)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const overdueNpaAmount = overdueLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0);

    // Calculate Karat distribution
    const karatMap = new Map<string, { weight: number; count: number }>();
    goldItems.forEach(g => {
      const k = g.purity || (g.metal_type === 'Silver' ? '925 Sterling Silver' : '22K (91.6%)');
      const existing = karatMap.get(k) || { weight: 0, count: 0 };
      karatMap.set(k, { weight: existing.weight + g.net_weight, count: existing.count + 1 });
    });

    const portfolioKaratDistribution = Array.from(karatMap.entries()).map(([name, val]) => ({
      name,
      value: val.count,
      weightGrams: Number(val.weight.toFixed(2)),
    }));

    const silver1kgRate = shop?.silver_rate_1kg || 95000;
    const silverGramRate = shop?.silver_rate_per_gram || Number((silver1kgRate / 1000).toFixed(2));

    const metricsResult: DashboardMetrics = {
      totalActiveLoansCount: activeLoans.length,
      totalPortfolioAum,
      totalPledgedGoldWeightGrams: Number(totalPledgedGoldWeightGrams.toFixed(2)),
      totalPledgedSilverWeightGrams: Number(totalPledgedSilverWeightGrams.toFixed(2)),
      todayCollectionsAmount,
      overdueNpaCount: overdueLoans.length,
      overdueNpaAmount,
      avgLtvPercentage: 72.4,
      goldRate24k: shop?.gold_rate_24k || 7650,
      goldRate22k: shop?.gold_rate_22k || 7010,
      goldRate18k: shop?.gold_rate_18k || 5738,
      silverRate1kg: silver1kgRate,
      silverRatePerGram: silverGramRate,
      monthlyDisbursementVsCollection: [
        { month: 'Feb', disbursed: 420000, collected: 85000 },
        { month: 'Mar', disbursed: 510000, collected: 110000 },
        { month: 'Apr', disbursed: 380000, collected: 95000 },
        { month: 'May', disbursed: 650000, collected: 140000 },
        { month: 'Jun', disbursed: 590000, collected: 165000 },
        { month: 'Jul', disbursed: 660000, collected: 182000 },
      ],
      portfolioKaratDistribution: portfolioKaratDistribution.length ? portfolioKaratDistribution : [
        { name: '22K (91.6%)', value: 2, weightGrams: 102.0 },
        { name: '24K (99.9%)', value: 1, weightGrams: 25.0 },
      ],
    };

    dbQueryCache.set(cacheKey, { data: metricsResult, expiresAt: Date.now() + DEFAULT_CACHE_TTL });
    return metricsResult;
  },
};

/**
 * Subscribes to Realtime Supabase Database Change notifications across physical gadgets (Tablet, Mobile, PC).
 * Features 150ms debouncing for cascading operations and explicit INSERT/UPDATE/DELETE event listeners per table.
 */
export function setupRealtimeSync(shopId: string, onUpdate: () => void): () => void {
  if (typeof window === 'undefined' || !isRealSupabase || !supabase || !shopId) return () => {};

  try {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerDebouncedRefresh = (targetTable?: string) => {
      // ⚡ Wipes target table & dependent query caches so affected model refetches fresh data from Supabase
      clearDbCache(targetTable);

      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        onUpdate();
      }, 150);
    };

    const tables = [
      { name: 'loans', filter: `shop_id=eq.${shopId}` },
      { name: 'customers', filter: `shop_id=eq.${shopId}` },
      { name: 'gold_items', filter: `shop_id=eq.${shopId}` },
      { name: 'payments', filter: `shop_id=eq.${shopId}` },
      { name: 'shops', filter: `id=eq.${shopId}` },
    ];

    const events = ['INSERT', 'UPDATE', 'DELETE'] as const;

    const channelName = `shop-realtime-${shopId}-${Math.floor(Math.random() * 10000)}`;
    let channel = supabase.channel(channelName);

    tables.forEach((t) => {
      events.forEach((evt) => {
        channel = channel.on(
          'postgres_changes',
          { event: evt, schema: 'public', table: t.name, filter: t.filter },
          (payload) => {
            if (t.name === 'loans') {
              console.log('🔥 Realtime loan event received:', payload);
            } else {
              console.log(`🔥 Realtime ${t.name} event received:`, payload);
            }
            triggerDebouncedRefresh(t.name);
          }
        );
      });
    });

    channel.subscribe((status) => {
      console.log('Realtime status:', status);
      if (status === 'SUBSCRIBED') {
        console.log(`[RealtimeSync] Successfully SUBSCRIBED to multi-table CDC (INSERT/UPDATE/DELETE) for shop: ${shopId}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[RealtimeSync] Realtime channel status: ${status} for shop: ${shopId}`);
      }
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  } catch (err) {
    console.warn('setupRealtimeSync exception:', err);
    return () => {};
  }
}



