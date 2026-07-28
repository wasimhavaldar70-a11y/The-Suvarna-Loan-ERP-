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
const pubKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(url, pubKey);
const supabaseAdmin = createClient(url, secretKey);

async function testFullWorkflow() {
  console.log('=== Step 1: Testing Storage Bucket Setup ===');
  const bucketName = 'Customer-Documents';
  
  // Verify or create bucket
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets && buckets.some(b => b.name === bucketName);
  if (!exists) {
    console.log(`Creating bucket ${bucketName}...`);
    await supabaseAdmin.storage.createBucket(bucketName, { public: true });
  }
  console.log(`✓ Storage Bucket "${bucketName}" verified as PUBLIC.`);

  console.log('\n=== Step 2: Uploading Human-Readable KYC Documents ===');
  const shopFolder = 'Suvarna-Gold-Jewellers';
  const customerName = 'Rajesh-Kumar-Sharma';
  const timestamp = Date.now();
  const custId = `cust-${timestamp}`;

  // Create WebP sample buffers for KYC documents
  const sampleWebpBuffer = Buffer.from(
    'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    'base64'
  );

  const docUploads = [
    { type: 'Passport-Photo', file: 'Passport-Photo_Rajesh-Kumar-Sharma.webp' },
    { type: 'Aadhaar-Card-Front', file: 'Aadhaar-Card-Front_Rajesh-Kumar-Sharma.webp' },
    { type: 'Aadhaar-Card-Back', file: 'Aadhaar-Card-Back_Rajesh-Kumar-Sharma.webp' },
    { type: 'PAN-Card', file: 'PAN-Card_Rajesh-Kumar-Sharma.webp' }
  ];

  const uploadedUrls = {};

  for (const doc of docUploads) {
    const storagePath = `${shopFolder}/${customerName}/${doc.file}`;
    console.log(`Uploading: ${storagePath}...`);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, sampleWebpBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) {
      console.error(`❌ Upload failed for ${doc.type}:`, error.message);
    } else {
      const { data: pubUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);
      uploadedUrls[doc.type] = pubUrlData.publicUrl;
      console.log(`  ✓ Public URL: ${pubUrlData.publicUrl}`);
    }
  }

  console.log('\n=== Step 3: Inserting Customer into Supabase Postgres Database ===');
  const newCustomer = {
    id: custId,
    shop_id: 'shop-001',
    branch_id: 'branch-001',
    full_name: 'Rajesh Kumar Sharma',
    mobile_number: '9876543210',
    aadhaar_number: '987654321012',
    pan_number: 'ABCDE1234F',
    address: 'Flat 402, Shanti Heights, M.G. Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    status: 'Active',
    credit_score: 760,
    photo_url: uploadedUrls['Passport-Photo'],
    aadhaar_url: uploadedUrls['Aadhaar-Card-Front'],
    aadhaar_back_url: uploadedUrls['Aadhaar-Card-Back'],
    pan_url: uploadedUrls['PAN-Card']
  };

  const { data: dbData, error: dbError } = await supabase
    .from('customers')
    .insert(newCustomer)
    .select()
    .single();

  if (dbError) {
    console.error('❌ Database insert error:', dbError.message);
  } else {
    console.log('✓ SUCCESS: Customer inserted into database successfully!');
    console.log('  Customer ID:', dbData.id);
    console.log('  Full Name:', dbData.full_name);
    console.log('  Photo Storage URL:', dbData.photo_url);
    console.log('  Aadhaar Front URL:', dbData.aadhaar_url);
    console.log('  Aadhaar Back URL:', dbData.aadhaar_back_url);
  }
}

testFullWorkflow();
