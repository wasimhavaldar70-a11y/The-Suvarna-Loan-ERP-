// ========================================================
// SuvarnaLoan ERP - API, Security & Infrastructure Guard
// Location: src/lib/security.ts
// ========================================================

import { supabase, isRealSupabase } from './supabase/supabaseClient';

export interface CsrfValidationResult {
  isAllowed: boolean;
  status: number;
  reason?: string;
}

/**
 * 6A. CSRF Origin Validation (validateCsrfOrigin)
 */
export function validateCsrfOrigin(headers: Record<string, string | undefined>): CsrfValidationResult {
  const origin = headers['origin'] || headers['Origin'];
  const referer = headers['referer'] || headers['Referer'];
  const host = headers['host'] || headers['Host'] || 'localhost';

  // Explicit null origin check (sandboxed iframe attack guard)
  if (origin === 'null') {
    return {
      isAllowed: false,
      status: 403,
      reason: 'Forbidden: Sandboxed iframe null origin disallowed',
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const checkUrl = origin || referer || '';

  // If no origin/referer header present, allow for standard same-origin SSR
  if (!checkUrl) {
    return { isAllowed: true, status: 200 };
  }

  // Allowed domain matching
  const isLocalhost = Boolean(
    checkUrl.includes('localhost') ||
    checkUrl.includes('127.0.0.1') ||
    checkUrl.includes('[::1]') ||
    checkUrl.includes('.local')
  );

  const isPrivateIp = Boolean(
    /https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/.test(checkUrl)
  );

  const matchesAppUrl = Boolean(appUrl && checkUrl.startsWith(appUrl));
  const matchesHost = Boolean(host && checkUrl.includes(host));

  if (isLocalhost || isPrivateIp || matchesAppUrl || matchesHost) {
    return { isAllowed: true, status: 200 };
  }

  return {
    isAllowed: false,
    status: 403,
    reason: `Forbidden: Origin "${checkUrl}" is not allowed`,
  };
}

/**
 * 6B. Environment Variable Guard (validateEnv)
 */
export function validateEnv(requiredKeys: string[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]): { isValid: boolean; missingOrInvalidKeys: string[] } {
  const missingOrInvalidKeys: string[] = [];

  for (const key of requiredKeys) {
    const val = process.env[key];
    if (!val || val.trim() === '') {
      missingOrInvalidKeys.push(`${key} (Missing)`);
    } else if (val.includes('[YOUR-') || val.includes('placeholder') || val.includes('example.com')) {
      missingOrInvalidKeys.push(`${key} (Contains unconfigured placeholder: "${val}")`);
    }
  }

  if (missingOrInvalidKeys.length > 0) {
    const errorMsg = `[FATAL SECURITY GUARD] Invalid or missing environment variables:\n${missingOrInvalidKeys.join('\n')}`;
    console.error(errorMsg);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg);
    }
    return { isValid: false, missingOrInvalidKeys };
  }

  return { isValid: true, missingOrInvalidKeys: [] };
}

/**
 * 6C. Database-Backed Rate Limiting (isRequestAllowed)
 */
export async function isRequestAllowed(
  clientIp: string = '127.0.0.1',
  maxRequestsPerMinute: number = 30
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    if (isRealSupabase && supabase) {
      const windowStart = new Date(Date.now() - 60 * 1000).toISOString();

      // Query rate_limits table for this IP within 60s
      const { data, error } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('ip_address', clientIp)
        .gte('created_at', windowStart);

      if (!error && data) {
        const count = data.length;
        if (count >= maxRequestsPerMinute) {
          console.warn(`[RATE LIMIT EXCEEDED] IP ${clientIp} made ${count} requests in 60s`);
          return { allowed: false, remaining: 0 };
        }

        // Record request
        await supabase.from('rate_limits').insert({
          ip_address: clientIp,
          created_at: new Date().toISOString(),
        });

        return { allowed: true, remaining: maxRequestsPerMinute - count - 1 };
      }
    }

    // Local Storage / In-memory Rate Limit Fallback
    if (typeof window !== 'undefined') {
      const storageKey = `sl_rate_${clientIp}`;
      const now = Date.now();
      const raw = localStorage.getItem(storageKey);
      const timestamps: number[] = raw ? JSON.parse(raw) : [];
      
      // Filter last 60 seconds
      const validTimestamps = timestamps.filter(t => now - t < 60000);
      
      if (validTimestamps.length >= maxRequestsPerMinute) {
        return { allowed: false, remaining: 0 };
      }

      validTimestamps.push(now);
      localStorage.setItem(storageKey, JSON.stringify(validTimestamps));
      return { allowed: true, remaining: maxRequestsPerMinute - validTimestamps.length };
    }

    // Fail-Open strategy for maximum uptime
    return { allowed: true, remaining: maxRequestsPerMinute };
  } catch (err) {
    console.error('Rate limiting error (Fail-Open active):', err);
    return { allowed: true, remaining: maxRequestsPerMinute }; // Preserves app uptime
  }
}
