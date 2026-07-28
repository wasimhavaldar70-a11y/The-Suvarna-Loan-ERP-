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

export async function POST(request: NextRequest) {
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

    const { email, newPassword } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client unconfigured' }, { status: 500 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

    if (existingUser) {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: newPassword.trim(),
        email_confirm: true,
      });

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Password updated successfully for ${cleanEmail}. Account is verified and active!`,
      });
    } else {
      // Create confirmed user directly if not in Auth yet
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: newPassword.trim(),
        email_confirm: true,
        user_metadata: { role: 'Shop Owner' },
      });

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Created confirmed credentials for ${cleanEmail}. Account is ready for login!`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error resetting password' }, { status: 500 });
  }
}
