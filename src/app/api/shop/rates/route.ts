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

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client is not configured on server' }, { status: 500 });
    }

    const { data: shop, error } = await supabaseServer
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .single();

    if (error || !shop) {
      return NextResponse.json({ error: error?.message || 'Shop not found in central database' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      shop: {
        ...shop,
        is_active: shop.is_active ?? true,
      },
      rates: {
        gold_rate_24k: shop.gold_rate_24k || 7650,
        gold_rate_22k: shop.gold_rate_22k || 7010,
        gold_rate_20k: shop.gold_rate_20k || Math.round((shop.gold_rate_24k || 7650) * (20 / 24)),
        gold_rate_18k: shop.gold_rate_18k || 5738,
        silver_rate_1kg: shop.silver_rate_1kg || 95000,
        silver_rate_per_gram: shop.silver_rate_per_gram || Number(((shop.silver_rate_1kg || 95000) / 1000).toFixed(2)),
        use_live_rates: shop.use_live_rates ?? true,
        last_rate_sync_at: shop.last_rate_sync_at || new Date().toISOString(),
      },
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch live gold rates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shop_id,
      gold_rate_24k,
      gold_rate_22k,
      gold_rate_20k,
      gold_rate_18k,
      silver_rate_1kg,
      silver_rate_per_gram,
      use_live_rates,
    } = body;

    if (!shop_id) {
      return NextResponse.json({ error: 'Shop ID is required for live rate update' }, { status: 400 });
    }

    const num24 = Number(gold_rate_24k);
    if (isNaN(num24) || num24 <= 0) {
      return NextResponse.json({ error: 'Valid 24K Gold Rate is required (must be > 0)' }, { status: 400 });
    }

    const num22 = Number(gold_rate_22k) || Math.round(num24 * 0.9166);
    const num20 = Number(gold_rate_20k) || Math.round(num24 * (20 / 24));
    const num18 = Number(gold_rate_18k) || Math.round(num24 * 0.75);
    const numSilver = Number(silver_rate_1kg) || 95000;
    const silverGram = Number(silver_rate_per_gram) || Number((numSilver / 1000).toFixed(2));
    const nowIso = new Date().toISOString();

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database server client is not available' }, { status: 500 });
    }

    const updatePayload: Record<string, any> = {
      gold_rate_24k: num24,
      gold_rate_22k: num22,
      gold_rate_20k: num20,
      gold_rate_18k: num18,
      silver_rate_1kg: numSilver,
      silver_rate_per_gram: silverGram,
      last_rate_sync_at: nowIso,
      updated_at: nowIso,
    };

    if (use_live_rates !== undefined) {
      updatePayload.use_live_rates = Boolean(use_live_rates);
    }

    // 1. Perform direct update to central database
    let { data, error } = await supabaseServer
      .from('shops')
      .update(updatePayload)
      .eq('id', shop_id)
      .select()
      .single();

    if (error && (error.message.includes('gold_rate_20k') || error.message.includes('schema cache'))) {
      const corePayload = {
        gold_rate_24k: num24,
        gold_rate_22k: num22,
        gold_rate_18k: num18,
        silver_rate_1kg: numSilver,
        silver_rate_per_gram: silverGram,
        last_rate_sync_at: nowIso,
        updated_at: nowIso,
        ...(use_live_rates !== undefined ? { use_live_rates: Boolean(use_live_rates) } : {}),
      };
      const retry = await supabaseServer
        .from('shops')
        .update(corePayload)
        .eq('id', shop_id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[API /api/shop/rates] Database update error:', error.message);
      return NextResponse.json({
        error: `Database update failed: ${error.message}`,
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        error: 'Database update failed: shop record was not found or not modified',
      }, { status: 404 });
    }

    // 2. Verified return from central database
    return NextResponse.json({
      success: true,
      message: 'Live bullion rates permanently persisted in database',
      shop: {
        ...data,
        is_active: data.is_active ?? true,
      },
      rates: {
        gold_rate_24k: data.gold_rate_24k,
        gold_rate_22k: data.gold_rate_22k,
        gold_rate_20k: data.gold_rate_20k,
        gold_rate_18k: data.gold_rate_18k,
        silver_rate_1kg: data.silver_rate_1kg,
        silver_rate_per_gram: data.silver_rate_per_gram,
        use_live_rates: data.use_live_rates,
        last_rate_sync_at: data.last_rate_sync_at,
      },
    }, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/shop/rates] Exception:', err);
    return NextResponse.json({
      error: err?.message || 'Internal server error while persisting gold rates',
    }, { status: 500 });
  }
}
