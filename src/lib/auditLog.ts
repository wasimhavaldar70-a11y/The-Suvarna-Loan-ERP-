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
    await supabase.from('audit_logs').insert({
      shop_id: shopId,
      user_id: userId,
      action,
      table_name: tableName,
      record_id: recordId,
      old_data: oldData,
      new_data: newData,
    });
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
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data && data.length) return data as AuditLog[];
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
