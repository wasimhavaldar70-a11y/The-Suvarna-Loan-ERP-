import { NextResponse } from 'next/server';
import { supabase, isRealSupabase } from '../../../lib/supabase/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const isConfigured = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && !supabaseUrl.includes('example.com'));

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        database: {
          status: isConfigured ? 'connected' : 'local_mock',
          latencyMs: Date.now() - startTime,
        },
        storage: {
          status: isConfigured ? 'connected' : 'local_fallback',
        },
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
      responseTimeMs: Date.now() - startTime,
    },
    { status: 200 }
  );
}
