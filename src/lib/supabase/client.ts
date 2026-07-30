// ========================================================
// Supabase Client & Session Management Adapter
// Location: src/lib/supabase/client.ts
// ========================================================

import { createBrowserClient } from '@supabase/ssr';
import { User, Shop, SessionData } from '../../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isRealSupabase = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') && 
  !supabaseUrl.includes('example.com')
);

export const supabase = (isRealSupabase && typeof window !== 'undefined')
  ? createBrowserClient(supabaseUrl, supabaseAnonKey) 
  : null;

const SESSION_KEY = 'suvarna_session';

export function getSessionUser(): SessionData | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error('Error parsing session data:', err);
    return null;
  }
}

export function setSessionUser(session: SessionData | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    document.cookie = `${SESSION_KEY}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=604800; SameSite=Lax`;
  }
}

export async function getAccessToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (supabase) {
    try {
      const authSession = await supabase.auth.getSession();
      const token = authSession?.data?.session?.access_token;
      if (token && typeof token === 'string' && token.split('.').length === 3) {
        return token;
      }
    } catch (err) {
      console.warn('getAccessToken auth warning:', err);
    }
  }

  // Fallback: Check localStorage for Supabase Auth token keys
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const token = Array.isArray(parsed) ? parsed[0] : (parsed?.access_token || parsed);
          if (typeof token === 'string' && token.split('.').length === 3) {
            return token;
          }
        }
      }
    }
  } catch (err) {
    console.warn('getAccessToken localStorage fallback warning:', err);
  }

  return '';
}
