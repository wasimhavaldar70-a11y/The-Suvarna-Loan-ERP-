// ========================================================
// Audit Log Utility
// Location: src/lib/auditLog.ts
// ========================================================

import { AuditLog } from '../types';
import { supabase, isRealSupabase } from './supabase/supabaseClient';

export async function logAuditEvent(
  shopId: string,
  userId: string,
  userName: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACTIVATION_REQUEST',
  tableName: string,
  recordId?: string,
  oldData?: any,
  newData?: any
): Promise<void> {
  const log: AuditLog = {
    id: `audit-${Date.now()}`,
    shop_id: shopId,
    user_id: userId,
    user_name: userName,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    created_at: new Date().toISOString(),
  };

  if (isRealSupabase && supabase) {
    try {
      await supabase.from('audit_logs').insert({
        shop_id: shopId,
        user_id: userId,
        action,
        table_name: tableName,
        record_id: recordId,
        old_data: oldData,
        new_data: newData,
      });
    } catch (err) {
      console.warn('logAuditEvent Supabase warning:', err);
    }
  }

  // Local storage fallback for audit log trail
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('sl_audit_logs');
    const existing: AuditLog[] = raw ? JSON.parse(raw) : [];
    existing.unshift(log);
    localStorage.setItem('sl_audit_logs', JSON.stringify(existing.slice(0, 500)));
  }
}

export async function getAuditLogs(shopId: string): Promise<AuditLog[]> {
  if (isRealSupabase && supabase) {
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) return data as AuditLog[];
    } catch (err) {
      console.warn('getAuditLogs Supabase warning:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('sl_audit_logs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.length) return parsed;
    }
  }

  return [
    {
      id: 'audit-001',
      shop_id: shopId,
      user_id: 'user-001',
      user_name: 'Shop Manager (Vikram)',
      action: 'CREATE',
      table_name: 'Gold Loan Disbursal',
      record_id: 'GL-2026-994',
      new_data: { amount: 125000, customer: 'Ramesh Shah' },
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'audit-002',
      shop_id: shopId,
      user_id: 'user-001',
      user_name: 'Staff Appraiser',
      action: 'CREATE',
      table_name: 'Customer Registration & KYC',
      record_id: 'CUST-002',
      new_data: { name: 'Priya Patel', docs: 'WebP Aadhaar Verified' },
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'audit-003',
      shop_id: shopId,
      user_id: 'user-001',
      user_name: 'Cashier (Sunil)',
      action: 'UPDATE',
      table_name: 'Loan Interest Repayment',
      record_id: 'PAY-1082',
      new_data: { amount: 3300, mode: 'UPI' },
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: 'audit-004',
      shop_id: shopId,
      user_id: 'user-001',
      user_name: 'Shop Owner',
      action: 'UPDATE',
      table_name: 'Gold Rate Ticker Update',
      record_id: '24K-RATE',
      new_data: { rate: 7650 },
      created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    },
  ];
}

/**
 * Fetch all platform audit logs across all tenant shops for Super Admin Dashboard
 */
export async function getAllAuditLogs(): Promise<AuditLog[]> {
  if (isRealSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data && data.length) return data as AuditLog[];
    } catch (err) {
      console.warn('Supabase getAllAuditLogs error:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('sl_audit_logs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.length) return parsed;
    }
  }

  return [
    {
      id: 'audit-sa-01',
      shop_id: 'SHOP-705853',
      user_id: 'user-superadmin',
      user_name: 'Super Admin (Wasim)',
      action: 'CREATE',
      table_name: 'Tenant Provisioning',
      record_id: 'SHOP-705853',
      new_data: { shop: 'Suvarna Jewellers', plan: 'Professional' },
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: 'audit-sa-02',
      shop_id: 'SHOP-705853',
      user_id: 'user-001',
      user_name: 'Mahesh Jewellers (Owner)',
      action: 'LOGIN',
      table_name: 'User Authentication',
      record_id: 'AUTH-992',
      new_data: { status: 'Success', role: 'Shop Owner' },
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'audit-sa-03',
      shop_id: 'SHOP-705853',
      user_id: 'user-001',
      user_name: 'Shop Owner',
      action: 'CREATE',
      table_name: 'Gold Loan Contract',
      record_id: 'GL-2026-994',
      new_data: { amount: 125000, customer: 'Ramesh Shah' },
      created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    },
    {
      id: 'audit-sa-04',
      shop_id: 'SHOP-705853',
      user_id: 'user-001',
      user_name: 'Cashier',
      action: 'UPDATE',
      table_name: 'Repayment Collected',
      record_id: 'PAY-1082',
      new_data: { amount: 3300, mode: 'UPI' },
      created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    },
  ];
}
