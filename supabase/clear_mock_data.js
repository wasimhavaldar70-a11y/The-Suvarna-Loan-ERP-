const { Client } = require('pg');

const directUrl = 'postgresql://postgres.qjkrzluyhonginpsvamx:Suhani@70585363@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function clearMockData() {
  console.log('Connecting to Supabase Postgres database to clear mock dummy data...');
  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Postgres successfully!');

    // Delete dummy rows from database tables
    const sql = `
      TRUNCATE TABLE public.payments CASCADE;
      TRUNCATE TABLE public.loans CASCADE;
      TRUNCATE TABLE public.gold_items CASCADE;
      TRUNCATE TABLE public.customers CASCADE;
      TRUNCATE TABLE public.audit_logs CASCADE;
    `;

    console.log('Truncating payments, loans, gold_items, customers, and audit_logs tables...');
    await client.query(sql);
    console.log('✓ SUCCESS: All mock dummy data removed from Supabase database tables!');
  } catch (err) {
    console.error('Clear mock data error:', err);
  } finally {
    await client.end();
  }
}

clearMockData();
