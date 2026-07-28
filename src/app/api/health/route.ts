import { NextResponse } from 'next/server';
import { supabase, isRealSupabase } from '../../../lib/supabase/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  if (isRealSupabase && supabase) {
    try {
      const dbStart = Date.now();
      const { error } = await supabase.from('shops').select('id').limit(1);
      dbLatencyMs = Date.now() - dbStart;
      if (error) {
        dbStatus = `degraded: ${error.message}`;
      }
    } catch (err: any) {
      dbStatus = `unreachable: ${err?.message || 'unknown error'}`;
    }
  } else {
    dbStatus = 'local_mock';
  }

  const overallStatus = dbStatus.startsWith('degraded') || dbStatus.startsWith('unreachable')
    ? 503
    : 200;

  return NextResponse.json(
    {
      status: overallStatus === 200 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        storage: {
          status: isRealSupabase ? 'connected' : 'local_fallback',
        },
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
      responseTimeMs: Date.now() - startTime,
    },
    { status: overallStatus }
  );
}
