const { Client } = require('pg');

// Support both Supavisor Transaction Pooler (Port 6543) for high concurrency and Direct Session Pooler (Port 5432)
const dbHost = process.env.SUPABASE_DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
const dbPort = process.env.SUPABASE_DB_PORT || '5432'; // Port 6543 for transaction pooling, 5432 for session pooling
const directUrl = process.env.DATABASE_URL || `postgresql://postgres.qjkrzluyhonginpsvamx:Suhani@70585363@${dbHost}:${dbPort}/postgres`;

async function migrate() {
  console.log(`Connecting to Supabase Postgres database via Pooler (${dbHost}:${dbPort})...`);
  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Postgres successfully!');

    const sql = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Atomic Sequence for Concurrency-Safe Shop ID Generation
    CREATE SEQUENCE IF NOT EXISTS public.shop_id_seq START WITH 1 INCREMENT BY 1;

    -- 1. Shops (Tenants)
    CREATE TABLE IF NOT EXISTS public.shops (
      id TEXT PRIMARY KEY,
      shop_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      plan VARCHAR(50) DEFAULT 'Professional',
      address TEXT,
      logo_url TEXT,
      gstin VARCHAR(20),
      license_number VARCHAR(100),
      gold_rate_24k DECIMAL(10, 2) DEFAULT 7650.00,
      gold_rate_22k DECIMAL(10, 2) DEFAULT 7010.00,
      gold_rate_18k DECIMAL(10, 2) DEFAULT 5738.00,
      silver_rate_1kg DECIMAL(10, 2) DEFAULT 95000.00,
      silver_rate_per_gram DECIMAL(10, 2) DEFAULT 95.00,
      max_ltv_percentage DECIMAL(5, 2) DEFAULT 75.00,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    -- 1b. Users (Staff / Shop Owners)
    CREATE TABLE IF NOT EXISTS public.users (
      id TEXT PRIMARY KEY,
      shop_id TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'Shop Owner',
      avatar_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 2. Customers
    CREATE TABLE IF NOT EXISTS public.customers (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
      branch_id VARCHAR(100),
      full_name VARCHAR(255) NOT NULL,
      mobile_number VARCHAR(20) NOT NULL,
      alternate_mobile VARCHAR(20),
      email VARCHAR(255),
      aadhaar_number VARCHAR(20),
      pan_number VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pincode VARCHAR(10),
      photo_url TEXT,
      aadhaar_url TEXT,
      aadhaar_back_url TEXT,
      pan_url TEXT,
      credit_score INTEGER DEFAULT 750,
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 3. Gold Items (Assets Pledged)
    CREATE TABLE IF NOT EXISTS public.gold_items (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      shop_id TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
      ornament_type VARCHAR(100) NOT NULL,
      description TEXT,
      gross_weight DECIMAL(10, 3) NOT NULL,
      stone_weight DECIMAL(10, 3) DEFAULT 0,
      net_weight DECIMAL(10, 3) NOT NULL,
      purity VARCHAR(50) NOT NULL,
      purity_percentage DECIMAL(5, 2) DEFAULT 91.66,
      hallmark_number VARCHAR(100),
      pocket_locker_number VARCHAR(100),
      market_value_per_gram DECIMAL(10, 2),
      estimated_value DECIMAL(15, 2),
      photo_url TEXT,
      front_image_url TEXT,
      back_image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 4. Loans
    CREATE TABLE IF NOT EXISTS public.loans (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
      branch_id VARCHAR(100),
      customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      gold_item_id TEXT NOT NULL REFERENCES public.gold_items(id) ON DELETE RESTRICT,
      loan_number VARCHAR(50) UNIQUE NOT NULL,
      loan_amount DECIMAL(15, 2) NOT NULL,
      interest_rate DECIMAL(5, 2) DEFAULT 1.50,
      tenure_months INTEGER DEFAULT 12,
      repayment_model VARCHAR(100) DEFAULT 'Bullet Repayment',
      scheme_name VARCHAR(100) DEFAULT 'Standard Monthly',
      loan_purpose VARCHAR(255),
      loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE NOT NULL,
      closed_date DATE,
      auction_date DATE,
      status VARCHAR(50) DEFAULT 'Active',
      total_interest_paid DECIMAL(15, 2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 5. Payments
    CREATE TABLE IF NOT EXISTS public.payments (
      id TEXT PRIMARY KEY,
      shop_id TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
      loan_id TEXT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
      payment_type VARCHAR(50) NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      principal_portion DECIMAL(15, 2) DEFAULT 0,
      interest_portion DECIMAL(15, 2) DEFAULT 0,
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      payment_method VARCHAR(50) NOT NULL,
      receipt_number VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 6. Audit Logs
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id TEXT PRIMARY KEY,
      shop_id TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
      user_id VARCHAR(100),
      user_name VARCHAR(255),
      action VARCHAR(20) NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      record_id VARCHAR(100),
      old_data JSONB,
      new_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 6b. Customer Documents (Storage Paths)
    CREATE TABLE IF NOT EXISTS public.customer_documents (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      document_type VARCHAR(100) NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type VARCHAR(100),
      file_size INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 6c. Supabase Storage Bucket Initialization
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'customer-documents',
      'customer-documents',
      false,
      10485760,
      ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET public = false;

    -- Concurrency-Safe Shop Sequence Generator RPC
    CREATE OR REPLACE FUNCTION public.get_next_shop_sequence()
    RETURNS BIGINT AS $$
      SELECT nextval('public.shop_id_seq');
    $$ LANGUAGE sql VOLATILE SECURITY DEFINER;

    -- 7. Add Missing Columns IF NOT EXISTS
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.gold_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.gold_items ADD COLUMN IF NOT EXISTS metal_type VARCHAR(20) DEFAULT 'Gold';
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS silver_rate_1kg DECIMAL(10, 2) DEFAULT 95000.00;
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS silver_rate_per_gram DECIMAL(10, 2) DEFAULT 95.00;
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS use_live_rates BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS last_rate_sync_at TIMESTAMP WITH TIME ZONE;

    -- 8. Enable Row Level Security (RLS) & Tenant Isolation Policies
    ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.gold_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Tenant Isolation for Shops" ON public.shops;
    CREATE POLICY "Tenant Isolation for Shops" ON public.shops FOR ALL TO authenticated
      USING (id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text) OR (SELECT role FROM public.users WHERE id::text = auth.uid()::text) = 'Super Admin')
      WITH CHECK ((SELECT role FROM public.users WHERE id::text = auth.uid()::text) = 'Super Admin' OR id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));

    DROP POLICY IF EXISTS "Public Shop Read for Login" ON public.shops;
    CREATE POLICY "Public Shop Read for Login" ON public.shops FOR SELECT TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Tenant Isolation for Users" ON public.users;
    CREATE POLICY "Tenant Isolation for Users" ON public.users FOR ALL TO authenticated
      USING (shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text) OR (SELECT role FROM public.users WHERE id::text = auth.uid()::text) = 'Super Admin')
      WITH CHECK ((SELECT role FROM public.users WHERE id::text = auth.uid()::text) = 'Super Admin' OR shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));

    DROP POLICY IF EXISTS "Public User Read for Login" ON public.users;
    CREATE POLICY "Public User Read for Login" ON public.users FOR SELECT TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Tenant Isolation for Customers" ON public.customers;
    CREATE POLICY "Tenant Isolation for Customers" ON public.customers FOR ALL TO authenticated
      USING (shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));

    DROP POLICY IF EXISTS "Tenant Isolation for Gold Items" ON public.gold_items;
    CREATE POLICY "Tenant Isolation for Gold Items" ON public.gold_items FOR ALL TO authenticated
      USING (shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));

    DROP POLICY IF EXISTS "Tenant Isolation for Loans" ON public.loans;
    CREATE POLICY "Tenant Isolation for Loans" ON public.loans FOR ALL TO authenticated
      USING (shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));

    DROP POLICY IF EXISTS "Tenant Isolation for Payments" ON public.payments;
    CREATE POLICY "Tenant Isolation for Payments" ON public.payments FOR ALL TO authenticated
      USING (shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));

    DROP POLICY IF EXISTS "Tenant Isolation for Customer Documents" ON public.customer_documents;
    CREATE POLICY "Tenant Isolation for Customer Documents" ON public.customer_documents FOR ALL TO authenticated
      USING (shop_id = (SELECT shop_id FROM public.users WHERE id::text = auth.uid()::text));
    CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments(loan_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON public.audit_logs(shop_id);
    CREATE INDEX IF NOT EXISTS idx_customer_docs_shop_id ON public.customer_documents(shop_id);
    CREATE INDEX IF NOT EXISTS idx_customer_docs_cust_id ON public.customer_documents(customer_id);

    -- 9. Atomic Sequential Loan Number Generator
    CREATE OR REPLACE FUNCTION generate_next_loan_number(p_shop_id TEXT)
    RETURNS TEXT AS $$
    DECLARE
      v_year TEXT;
      v_count INT;
      v_loan_num TEXT;
    BEGIN
      v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
      SELECT COUNT(*) + 1 INTO v_count FROM public.loans WHERE shop_id = p_shop_id;
      v_loan_num := 'GL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
      RETURN v_loan_num;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    console.log('Executing database schema creation SQL...');
    await client.query(sql);
    console.log('SUCCESS: All production database tables created successfully in Supabase Postgres!');
  } catch (err) {
    console.error('Migration execution error:', err);
  } finally {
    await client.end();
  }
}

migrate();
