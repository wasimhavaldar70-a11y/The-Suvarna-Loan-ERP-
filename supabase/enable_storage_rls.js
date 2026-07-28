const { Client } = require('pg');

const directUrl = 'postgresql://postgres.qjkrzluyhonginpsvamx:Suhani@70585363@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function enableStoragePolicies() {
  console.log('Connecting to Supabase Postgres database to enable Storage RLS Policies...');
  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Postgres successfully!');

    const sql = `
    -- Enable storage policies for Uploaded-Documents and Customer-Documents storage buckets
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Storage Upload Access Uploaded-Documents' AND tablename = 'objects'
      ) THEN
        CREATE POLICY "Public Storage Upload Access Uploaded-Documents" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id IN ('Uploaded-Documents', 'Customer-Documents'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Storage Select Access Uploaded-Documents' AND tablename = 'objects'
      ) THEN
        CREATE POLICY "Public Storage Select Access Uploaded-Documents" ON storage.objects
          FOR SELECT USING (bucket_id IN ('Uploaded-Documents', 'Customer-Documents'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Storage Update Access Uploaded-Documents' AND tablename = 'objects'
      ) THEN
        CREATE POLICY "Public Storage Update Access Uploaded-Documents" ON storage.objects
          FOR UPDATE USING (bucket_id IN ('Uploaded-Documents', 'Customer-Documents'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Storage Delete Access Uploaded-Documents' AND tablename = 'objects'
      ) THEN
        CREATE POLICY "Public Storage Delete Access Uploaded-Documents" ON storage.objects
          FOR DELETE USING (bucket_id IN ('Uploaded-Documents', 'Customer-Documents'));
      END IF;
    END
    $$;
    `;

    console.log('Executing SQL to grant Storage RLS Policies...');
    await client.query(sql);
    console.log('SUCCESS: Storage RLS Policies enabled on Uploaded-Documents bucket!');
  } catch (err) {
    console.error('Storage RLS error:', err);
  } finally {
    await client.end();
  }
}

enableStoragePolicies();
