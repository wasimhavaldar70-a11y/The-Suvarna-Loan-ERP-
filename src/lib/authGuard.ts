// ========================================================
// SuvarnaLoan ERP - Administrative Auth Guard & Token Validator
// Location: src/lib/authGuard.ts
// ========================================================

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabaseAdmin = (supabaseUrl && supabaseSecretKey && !supabaseSecretKey.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export interface AuthGuardResult {
  authorized: boolean;
  status: number;
  error?: string;
  user?: any;
}

/**
 * Extracts and verifies Supabase Auth JWT token from Authorization header or cookies.
 * Rejects request unless user is authenticated AND holds 'Super Admin' role.
 */
function extractValidJwtToken(request: NextRequest): string {
  // 1. Check Authorization Bearer Header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    if (rawToken && rawToken.split('.').length === 3) {
      return rawToken;
    }
  }

  // 2. Fallback to Cookie Header parsing
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return '';

  // 2a. Single cookie format sb-*-auth-token
  const singleMatch = cookieHeader.match(/sb-[a-z0-9-]+-auth-token=([^;]+)/i);
  if (singleMatch && singleMatch[1]) {
    try {
      const decodedStr = decodeURIComponent(singleMatch[1]);
      const parsed = JSON.parse(decodedStr);
      const token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed);
      if (typeof token === 'string' && token.split('.').length === 3) return token;
    } catch {
      const raw = decodeURIComponent(singleMatch[1]);
      if (raw.split('.').length === 3) return raw;
    }
  }

  // 2b. Chunked cookie format sb-*-auth-token.0, sb-*-auth-token.1
  const chunkMatches: { index: number; value: string }[] = [];
  const regex = /sb-[a-z0-9-]+-auth-token\.(\d+)=([^;]+)/gi;
  let match;
  while ((match = regex.exec(cookieHeader)) !== null) {
    chunkMatches.push({ index: parseInt(match[1], 10), value: match[2] });
  }

  if (chunkMatches.length > 0) {
    chunkMatches.sort((a, b) => a.index - b.index);
    const combinedBase64 = chunkMatches.map(c => c.value).join('');
    try {
      const decodedStr = decodeURIComponent(combinedBase64);
      const parsed = JSON.parse(decodedStr);
      const token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed);
      if (typeof token === 'string' && token.split('.').length === 3) return token;
    } catch {
      const raw = decodeURIComponent(combinedBase64);
      if (raw.split('.').length === 3) return raw;
    }
  }

  return '';
}

/**
 * Extracts and verifies Supabase Auth JWT token from Authorization header or cookies.
 * Rejects request unless user is authenticated AND holds 'Super Admin' role.
 */
export async function verifySuperAdmin(request: NextRequest): Promise<AuthGuardResult> {
  if (!supabaseAdmin) {
    return {
      authorized: false,
      status: 500,
      error: 'Authentication service unconfigured on server',
    };
  }

  const token = extractValidJwtToken(request);

  if (!token) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized: Missing or malformed administrative authorization token',
    };
  }

  try {
    // Verify JWT token against Supabase Auth engine
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return {
        authorized: false,
        status: 401,
        error: `Unauthorized: Invalid or expired access token (${authErr?.message || 'User session revoked'})`,
      };
    }

    // Role Authorization Enforcement: Must be Super Admin
    const userRole = user.user_metadata?.role;
    if (userRole !== 'Super Admin') {
      return {
        authorized: false,
        status: 403,
        error: `Forbidden: Access restricted to Platform Super Admin. Current role: "${userRole || 'User'}"`,
      };
    }

    return {
      authorized: true,
      status: 200,
      user,
    };
  } catch (err: any) {
    return {
      authorized: false,
      status: 500,
      error: `Internal Authentication Error: ${err?.message || 'Server token verification failure'}`,
    };
  }
}
