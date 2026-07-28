const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(url, key);

async function setupBucket() {
  console.log('Ensuring Supabase Storage Bucket "Customer-Documents" exists...');
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('List buckets error:', listError.message);
    } else {
      console.log('Existing buckets:', buckets.map(b => b.name));
      const exists = buckets.some(b => b.name === 'Customer-Documents');
      if (!exists) {
        const { data, error } = await supabase.storage.createBucket('Customer-Documents', {
          public: true,
          fileSizeLimit: 10485760, // 10MB limit
          allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
        });
        if (error) {
          console.error('Create bucket error:', error.message);
        } else {
          console.log('SUCCESS: Bucket "Customer-Documents" created successfully!');
        }
      } else {
        console.log('SUCCESS: Bucket "Customer-Documents" already exists & ready!');
      }
    }
  } catch (err) {
    console.error('Bucket setup error:', err);
  }
}

setupBucket();
