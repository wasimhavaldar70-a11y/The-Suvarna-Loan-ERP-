import { NextRequest, NextResponse } from 'next/server';
import { onboardNewTenant, TenantRegistrationInput } from '../../../../lib/onboardTenant';
import { validateCsrfOrigin } from '../../../../lib/security';
import { verifySuperAdmin } from '../../../../lib/authGuard';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate CSRF & Origin Headers
    const headersObj: Record<string, string | undefined> = {};
    request.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    const csrfCheck = validateCsrfOrigin(headersObj);
    if (!csrfCheck.isAllowed) {
      return NextResponse.json({ error: csrfCheck.reason }, { status: 403 });
    }

    // 2. Enforce Super Admin Authorization Guard
    const authCheck = await verifySuperAdmin(request);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    // 3. Parse & Validate Payload
    const body: TenantRegistrationInput = await request.json();

    if (!body.shopName || body.shopName.trim().length < 3) {
      return NextResponse.json({ error: 'Valid shopName (minimum 3 characters) is required' }, { status: 400 });
    }

    if (!body.ownerName || body.ownerName.trim().length < 2) {
      return NextResponse.json({ error: 'Valid ownerName is required' }, { status: 400 });
    }

    if (!body.ownerMobile || body.ownerMobile.trim().length < 10) {
      return NextResponse.json({ error: 'Valid ownerMobile number is required' }, { status: 400 });
    }

    // 3. Execute Provisioning
    const result = await onboardNewTenant(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error || result.message }, { status: 500 });
    }

    logger.info('Admin API successfully onboarded tenant', {
      action: 'API_ONBOARD_SUCCESS',
      tenantId: result.shop?.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    logger.error('API Error during tenant onboarding', err, { action: 'API_ONBOARD_EXCEPTION' });
    return NextResponse.json(
      { error: err?.message || 'Internal server error during onboarding' },
      { status: 500 }
    );
  }
}
