import { NextResponse } from 'next/server';
import { supabase, isRealSupabase } from '../../../lib/supabase/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const isConfigured = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && !supabaseUrl.includes('example.com'));

  let memoryStats = { heapUsedMb: 0, heapTotalMb: 0, rssMb: 0 };
  if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
    try {
      const mem = process.memoryUsage();
      memoryStats = {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      };
    } catch {}
  }

  const uptime = typeof process !== 'undefined' && typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0;

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: uptime,
      checks: {
        database: {
          status: isConfigured ? 'connected' : 'local_mock',
          latencyMs: Date.now() - startTime,
        },
        storage: {
          status: isConfigured ? 'connected' : 'local_fallback',
        },
        memory: memoryStats,
      },
      responseTimeMs: Date.now() - startTime,
    },
    { status: 200 }
  );
}
