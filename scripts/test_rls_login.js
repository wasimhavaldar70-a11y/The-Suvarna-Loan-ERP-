const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) {
    env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create anon client simulating browser client
const supabase = createClient(supabaseUrl, anonKey);

async function testRlsLogin() {
  console.log('=== TESTING SIGN IN WITH SUHANI70@GMAIL.COM AS ANON CLIENT ===\n');

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'suhani70@gmail.com',
    password: 'Password123!', // or user's password
  });

  if (authErr) {
    console.log('Auth sign in error:', authErr.message);
    return;
  }

  console.log('Auth Success! User ID:', authData.user.id);
  console.log('User metadata:', authData.user.user_metadata);

  // Now try query shops table with authenticated session
  const { data: shopData, error: shopErr } = await supabase
    .from('shops')
    .select('*')
    .eq('id', 'shop-00001')
    .single();

  console.log('\nQuerying shops table with authenticated user session:');
  if (shopErr) {
    console.error('❌ Shops Query Error:', shopErr);
  } else {
    console.log('✅ Shops Data returned:', shopData);
  }

  // Now try query users table
  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  console.log('\nQuerying users table with authenticated user session:');
  if (userErr) {
    console.error('❌ Users Query Error:', userErr);
  } else {
    console.log('✅ Users Data returned:', userData);
  }
}

testRlsLogin();
