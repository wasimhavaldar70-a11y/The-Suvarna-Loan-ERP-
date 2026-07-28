// ========================================================
// Supabase JS Singleton Export
// Location: src/lib/supabase/supabaseClient.ts
// ========================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isRealSupabase = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('placeholder') && 
  !supabaseUrl.includes('example.com')
);

export const supabase = isRealSupabase 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
