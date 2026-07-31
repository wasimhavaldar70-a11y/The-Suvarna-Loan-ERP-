/**
 * ========================================================
 * SuvarnaLoan ERP - Automatic Cloud DB Data Migration Tool
 * Migrates data directly from Tokyo DB to New Mumbai DB
 * Location: scripts/migrate_tokyo_to_mumbai.js
 * ========================================================
 */

const { createClient } = require('@supabase/supabase-js');

// 1. Source (Tokyo Database) Config from environment variables
const TOKYO_URL = process.env.TOKYO_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const TOKYO_KEY = process.env.TOKYO_SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || '';

// 2. Destination (New Mumbai Database) Config from environment variables
const MUMBAI_URL = process.env.MUMBAI_SUPABASE_URL || '';
const MUMBAI_KEY = process.env.MUMBAI_SUPABASE_SECRET_KEY || '';

if (!TOKYO_URL || !MUMBAI_URL) {
  console.log('\n======================================================');
  console.log('⚠️ TOKYO OR MUMBAI SUPABASE CREDENTIALS MISSING!');
  console.log('======================================================\n');
  process.exit(0);
}

const tokyoDb = createClient(TOKYO_URL, TOKYO_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const mumbaiDb = createClient(MUMBAI_URL, MUMBAI_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function migrateTable(tableName) {
  console.log(`\n⏳ Fetching records from Tokyo DB for table: '${tableName}'...`);
  const { data, error } = await tokyoDb.from(tableName).select('*');
  if (error) {
    console.warn(`⚠️ Warning fetching '${tableName}' from Tokyo: ${error.message}`);
    return 0;
  }

  if (!data || data.length === 0) {
    console.log(`ℹ️ Table '${tableName}' has 0 records in Tokyo DB. Skipping.`);
    return 0;
  }

  console.log(`📦 Found ${data.length} records in Tokyo for '${tableName}'. Inserting into Mumbai DB...`);
  const { error: insertErr } = await mumbaiDb.from(tableName).upsert(data);
  if (insertErr) {
    console.error(`❌ Error inserting '${tableName}' into Mumbai DB: ${insertErr.message}`);
    return 0;
  }

  console.log(`✅ Successfully migrated ${data.length} records for '${tableName}' to Mumbai DB!`);
  return data.length;
}

async function runMigration() {
  console.log('======================================================');
  console.log('🚀 SUVARNA LOAN ERP - TOKYO ➔ MUMBAI LIVE MIGRATION');
  console.log('======================================================');

  const tables = ['shops', 'users', 'branches', 'customers', 'gold_items', 'loans', 'payments', 'audit_logs'];

  let totalMigrated = 0;
  for (const table of tables) {
    const count = await migrateTable(table);
    totalMigrated += count;
  }

  console.log('\n======================================================');
  console.log(`🎉 MIGRATION COMPLETE! Total ${totalMigrated} records copied to Mumbai.`);
  console.log('======================================================\n');
}

runMigration().catch((err) => console.error('Migration failed:', err));
