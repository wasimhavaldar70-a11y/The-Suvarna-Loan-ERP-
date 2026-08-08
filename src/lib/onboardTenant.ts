// ========================================================
// SuvarnaLoan ERP - Automated Tenant Provisioning Engine
// Location: src/lib/onboardTenant.ts
// ========================================================

import { createClient } from '@supabase/supabase-js';
import { supabase, isRealSupabase } from './supabase/supabaseClient';
import { Shop, User, Branch } from '../types';
import { logger } from './logger';
import { ensureCustomerDocumentsBucketExists } from './storageHelper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabaseAdmin = (supabaseUrl && supabaseSecretKey && !supabaseSecretKey.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export interface TenantRegistrationInput {
  shopId?: string;
  shopName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  ownerPassword?: string;
  plan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  panNumber?: string;
  businessType?: string;
  openingDate?: string;
  status?: 'Active' | 'Inactive';
  licenseNumber?: string;
  goldRate24k?: number;
  goldRate22k?: number;
  goldRate18k?: number;
  silverRate1kg?: number;
  maxLtvPercentage?: number;
  mainBranchAddress?: string;
}

export interface TenantOnboardingResult {
  success: boolean;
  shop: Shop | null;
  ownerUser: User | null;
  primaryBranch: Branch | null;
  message: string;
  error?: string;
}

import { generateNextShopId as genShopId, generateNextBranchId, generateNextUserId, formatHumanId } from './idGenerator';

export async function generateNextShopId(): Promise<string> {
  return await genShopId();
}

/**
 * Repeatable function to onboard a new Tenant (Shop / Jeweler) in < 2 seconds
 */
import { getAccessToken } from './supabase/client';

export async function onboardNewTenant(
  input: TenantRegistrationInput
): Promise<TenantOnboardingResult> {
  // Delegate client-side calls to server API route for secure admin auth provisioning
  if (typeof window !== 'undefined') {
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/admin/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          shop: null,
          ownerUser: null,
          primaryBranch: null,
          message: data.error || 'Failed to onboard tenant via admin API.',
          error: data.error || 'Failed to onboard tenant via admin API.',
        };
      }
      return data;
    } catch (fetchErr: any) {
      console.error('API onboard fetch exception:', fetchErr);
      return {
        success: false,
        shop: null,
        ownerUser: null,
        primaryBranch: null,
        message: fetchErr.message || 'Network error during tenant onboarding.',
        error: fetchErr.message || 'Network error during tenant onboarding.',
      };
    }
  }

  const startTime = Date.now();
  logger.info('Starting automated tenant onboarding workflow', {
    action: 'ONBOARD_TENANT_START',
    shopName: input.shopName,
    ownerEmail: input.ownerEmail,
  });

  try {
    const shopId = input.shopId || (await generateNextShopId());
    let userId = await generateNextUserId(shopId);
    const branchId = await generateNextBranchId(shopId);
    const createdAt = new Date().toISOString();

    if (supabaseAdmin && input.ownerPassword) {
      try {
        const email = input.ownerEmail.trim();
        const password = input.ownerPassword.trim();
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

        if (existing) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
            user_metadata: { role: 'Shop Owner', name: input.ownerName.trim(), shop_id: shopId },
          });
          userId = existing.id;
        } else {
          const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'Shop Owner', name: input.ownerName.trim(), shop_id: shopId },
          });
          if (authData?.user?.id) {
            userId = authData.user.id;
          } else if (authErr) {
            console.warn('Admin createUser error:', authErr.message);
          }
        }
      } catch (authErr) {
        console.warn('Supabase admin auth creation warning:', authErr);
      }
    } else if (isRealSupabase && supabase && input.ownerPassword) {
      try {
        const { data: authData } = await supabase.auth.signUp({
          email: input.ownerEmail.trim(),
          password: input.ownerPassword.trim(),
        });
        if (authData?.user?.id) {
          userId = authData.user.id;
        }
      } catch (authErr) {
        console.warn('Supabase auth signUp warning during onboarding:', authErr);
      }
    }

    const silver1kg = input.silverRate1kg || 95000;
    const newShop: Shop = {
      id: shopId,
      shop_name: input.shopName.trim(),
      owner_name: input.ownerName.trim(),
      mobile: input.ownerMobile.trim(),
      email: input.ownerEmail.trim(),
      plan: (input.plan as any) || 'Professional',
      address: input.address?.trim() || '',
      gstin: input.gstin?.trim() || '',
      license_number: input.licenseNumber?.trim() || '',
      gold_rate_24k: input.goldRate24k || 7650,
      gold_rate_22k: input.goldRate22k || 7010,
      gold_rate_20k: Math.round((input.goldRate24k || 7650) * (20 / 24)),
      gold_rate_18k: input.goldRate18k || 5738,
      silver_rate_1kg: silver1kg,
      silver_rate_per_gram: Number((silver1kg / 1000).toFixed(2)),
      max_ltv_percentage: input.maxLtvPercentage || 75,
      is_active: true,
      created_at: createdAt,
    };

    const newOwner: User = {
      id: userId,
      shop_id: shopId,
      name: `${input.ownerName.trim()} (Owner)`,
      role: 'Shop Owner',
      email: input.ownerEmail.trim(),
      created_at: createdAt,
    };

    const newBranch: Branch = {
      id: branchId,
      shop_id: shopId,
      name: `${input.shopName.trim()} - Main Branch`,
      address: input.mainBranchAddress?.trim() || input.address?.trim() || 'Main Market Branch',
      phone: input.ownerMobile.trim(),
      is_active: true,
      created_at: createdAt,
    };

    const dbClient = supabaseAdmin || supabase;

    if (isRealSupabase && dbClient) {
      // 1. Insert Shop
      const { is_active, ...dbShopPayload } = newShop;
      let { error: shopErr } = await dbClient.from('shops').insert(newShop);
      if (shopErr && shopErr.message.includes('is_active')) {
        const { error: retryErr } = await dbClient.from('shops').insert(dbShopPayload);
        if (retryErr) shopErr = retryErr;
        else shopErr = null;
      }

      if (shopErr) {
        // Compensating Rollback: Delete created auth user if shop creation fails
        if (supabaseAdmin && userId) {
          await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        }
        throw new Error(`Failed to create shop record: ${shopErr.message}`);
      }

      // Auto-provision customer-documents storage bucket
      await ensureCustomerDocumentsBucketExists();

      // 2. Insert User Profile
      const { error: userErr } = await dbClient.from('users').insert(newOwner);
      if (userErr) {
        // Compensating Rollback: Clean up created shop & auth user
        await dbClient.from('shops').delete().eq('id', shopId);
        if (supabaseAdmin && userId) {
          await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        }
        throw new Error(`Failed to create user profile: ${userErr.message}`);
      }

      // 3. Insert Branch
      try {
        await dbClient.from('branches').insert(newBranch);
      } catch (branchErr) {
        console.warn('Branch creation non-blocking warning:', branchErr);
      }

      // 4. Audit Log Entry
      try {
        await dbClient.from('audit_logs').insert({
          shop_id: shopId,
          user_id: userId,
          action: 'CREATE',
          table_name: 'shops',
          record_id: shopId,
          new_data: { shopName: input.shopName, plan: input.plan },
          created_at: createdAt,
        });
      } catch (auditErr) {
        console.warn('Audit logs table insert warning:', auditErr);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('Tenant onboarding completed successfully', {
      action: 'ONBOARD_TENANT_SUCCESS',
      tenantId: shopId,
      durationMs,
    });

    return {
      success: true,
      shop: newShop,
      ownerUser: newOwner,
      primaryBranch: newBranch,
      message: `Tenant "${input.shopName}" onboarded successfully in ${durationMs}ms`,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error('Tenant onboarding failed', err, {
      action: 'ONBOARD_TENANT_ERROR',
      durationMs,
    });

    return {
      success: false,
      shop: null,
      ownerUser: null,
      primaryBranch: null,
      message: 'Failed to onboard new tenant',
      error: err?.message || 'Unknown database error',
    };
  }
}
