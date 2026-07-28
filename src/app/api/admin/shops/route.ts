import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateCsrfOrigin } from '../../../../lib/security';
import { verifySuperAdmin } from '../../../../lib/authGuard';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabaseAdmin = (supabaseUrl && supabaseSecretKey && !supabaseSecretKey.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export async function GET(request: NextRequest) {
  try {
    const headersObj: Record<string, string | undefined> = {};
    request.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    const csrfCheck = validateCsrfOrigin(headersObj);
    if (!csrfCheck.isAllowed) {
      return NextResponse.json({ error: csrfCheck.reason }, { status: 403 });
    }

    const authCheck = await verifySuperAdmin(request);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase service role client is not configured on server' }, { status: 500 });
    }

    const { data: shops, error } = await supabaseAdmin
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedShops = (shops || []).map((s: any) => ({
      ...s,
      is_active: s.is_active ?? true,
    }));

    return NextResponse.json({ shops: formattedShops }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch shop directory' }, { status: 500 });
  }
}
