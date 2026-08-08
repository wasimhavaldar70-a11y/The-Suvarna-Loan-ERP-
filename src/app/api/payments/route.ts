import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseServer = (supabaseUrl && supabaseSecretKey && !supabaseSecretKey.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shop_id');
    const loanId = searchParams.get('loan_id');

    if (!shopId && !loanId) {
      return NextResponse.json({ error: 'shop_id or loan_id is required' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database server client is not configured' }, { status: 500 });
    }

    let query = supabaseServer
      .from('payments')
      .select('*, loan:loans(*, customer:customers(*), gold_item:gold_items(*))')
      .order('created_at', { ascending: false });

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }
    if (loanId) {
      query = query.or(`loan_id.eq.${loanId}`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[API /api/payments GET] Query warning:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, payments: data || [] }, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/payments GET] Exception:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      shop_id,
      loan_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      receipt_number,
      notes,
      disbursement_id,
      disbursement_number,
    } = body;

    if (!shop_id && !loan_id) {
      return NextResponse.json({ error: 'shop_id and loan_id are required' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount (greater than 0) is required' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database server client is not available' }, { status: 500 });
    }

    // 1. Authoritative Loan Lookup in central PostgreSQL database
    let targetLoan: any = null;
    if (loan_id) {
      const { data: loanRows, error: loanQueryErr } = await supabaseServer
        .from('loans')
        .select('*, payments(*), loan_disbursements(*)')
        .or(`id.eq.${loan_id},loan_number.eq.${loan_id}`)
        .limit(1);

      if (!loanQueryErr && loanRows && loanRows.length > 0) {
        targetLoan = loanRows[0];
      }
    }

    const effectiveShopId = shop_id || targetLoan?.shop_id;
    const effectiveLoanId = targetLoan?.id || loan_id;

    if (!effectiveShopId || !effectiveLoanId) {
      return NextResponse.json({ error: 'Could not resolve authoritative shop_id or loan_id in database' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const cleanDate = payment_date ? String(payment_date).split('T')[0] : nowIso.split('T')[0];

    // Normalize payment_type to match database schema constraints
    let normalizedPaymentType = payment_type || 'Principal Part-Payment';
    if (normalizedPaymentType === 'Partial Payment' || normalizedPaymentType === 'Principal Repayment' || normalizedPaymentType === 'Repayment') {
      normalizedPaymentType = 'Principal Part-Payment';
    }

    const yr = new Date().getFullYear();
    const rawId = id || `pmt-${Date.now()}`;
    const rawSeq = rawId.replace(/^[a-z]+-/i, '');
    const cleanReceiptNumber = receipt_number || `REC-${yr}-${rawSeq}`;

    const insertPayload: Record<string, any> = {
      id: rawId,
      shop_id: effectiveShopId,
      loan_id: effectiveLoanId,
      amount: numAmount,
      payment_type: normalizedPaymentType,
      payment_date: cleanDate,
      payment_method: payment_method || 'Cash',
      receipt_number: cleanReceiptNumber,
      notes: notes || '',
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (disbursement_id) insertPayload.disbursement_id = disbursement_id;
    if (disbursement_number !== undefined && disbursement_number !== null) {
      insertPayload.disbursement_number = Number(disbursement_number);
    }

    // 2. Direct Atomic Insert into central database table (public.payments)
    let { data: insertedPayment, error: insertError } = await supabaseServer
      .from('payments')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      // Retry without optional tranche columns if schema differs
      delete insertPayload.disbursement_id;
      delete insertPayload.disbursement_number;
      const retry = await supabaseServer
        .from('payments')
        .insert(insertPayload)
        .select()
        .single();
      insertedPayment = retry.data;
      insertError = retry.error;
    }

    if (insertError || !insertedPayment) {
      console.error('[API /api/payments POST] Database Insert Error:', insertError?.message);
      return NextResponse.json({
        error: `Database insertion failed: ${insertError?.message || 'Could not insert record into public.payments'}`,
      }, { status: 500 });
    }

    // 3. Atomically update loan balances, interest, and status in central database
    if (targetLoan) {
      const existingPmts = (targetLoan.payments || []).map((p: any) => ({ ...p, amount: Number(p.amount) || 0 }));
      if (!existingPmts.some((p: any) => p.id === insertedPayment.id)) {
        existingPmts.push(insertedPayment);
      }

      const totalPaid = existingPmts.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const principal = Number(targetLoan.loan_amount) || 0;
      const remainingPrincipal = Math.max(0, principal - (normalizedPaymentType === 'Interest Payment' ? 0 : numAmount));
      const isClosed = normalizedPaymentType === 'Full Settlement' || remainingPrincipal <= 0;

      const loanUpdatePayload: Record<string, any> = {
        total_interest_paid: (Number(targetLoan.total_interest_paid) || 0) + (normalizedPaymentType === 'Interest Payment' ? numAmount : 0),
        total_balance_due: isClosed ? 0 : Math.max(0, (Number(targetLoan.total_balance_due) || principal) - numAmount),
        total_principal_outstanding: isClosed ? 0 : remainingPrincipal,
        status: isClosed ? 'Closed' : targetLoan.status,
        updated_at: nowIso,
      };

      if (isClosed) {
        loanUpdatePayload.closed_date = cleanDate;
      }

      const { error: loanUpdateErr } = await supabaseServer
        .from('loans')
        .update(loanUpdatePayload)
        .eq('id', targetLoan.id);

      if (loanUpdateErr) {
        // Fallback update without total_principal_outstanding if not present
        delete loanUpdatePayload.total_principal_outstanding;
        await supabaseServer
          .from('loans')
          .update(loanUpdatePayload)
          .eq('id', targetLoan.id);
      }

      if (disbursement_id) {
        await supabaseServer
          .from('loan_disbursements')
          .update({
            principal_outstanding: isClosed ? 0 : remainingPrincipal,
            status: isClosed ? 'Settled' : 'Active',
            updated_at: nowIso,
          })
          .eq('id', disbursement_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment permanently persisted in central database',
      payment: insertedPayment,
    }, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/payments POST] Exception:', err);
    return NextResponse.json({
      error: err?.message || 'Failed to record repayment in central database',
    }, { status: 500 });
  }
}
