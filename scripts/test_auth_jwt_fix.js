const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) {
    env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const directUrl = env.DIRECT_URL || env.DATABASE_URL;

async function testAuthJwtFix() {
  console.log('=== TESTING SUPABASE AUTH.JWT() IN POSTGRES ===\n');

  const client = new Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query("BEGIN;");
    await client.query("SET LOCAL role = 'authenticated';");

    // Supabase PostgREST sets request.jwt.claims as a single JSON object containing sub and user_metadata
    const jwtClaims = JSON.stringify({
      sub: '2e618a80-a5be-4ad9-8c1e-2606a4b42e19',
      role: 'authenticated',
      user_metadata: {
        role: 'Shop Owner',
        shop_id: 'shop-00001'
      }
    });

    await client.query(`SET LOCAL request.jwt.claims = '${jwtClaims}';`);

    const res1 = await client.query("SELECT current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'shop_id' AS shop_id;");
    console.log('1. Extracted shop_id from request.jwt.claims:', res1.rows[0].shop_id);

    const res2 = await client.query("SELECT current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'role' AS role;");
    console.log('2. Extracted role from request.jwt.claims:', res2.rows[0].role);

    await client.query("ROLLBACK;");
  } catch (err) {
    console.error('❌ Error testing jwt claims:', err);
  } finally {
    await client.end();
  }
}

testAuthJwtFix();
