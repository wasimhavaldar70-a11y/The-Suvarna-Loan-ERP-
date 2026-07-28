-- ============================================================
-- SuvarnaLoan ERP - Supabase Master Schema Migration (04)
-- Location: supabase/migrations/04_complete_schema_tables.sql
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Shops Table (Tenants)
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  max_ltv_percentage DECIMAL(5, 2) DEFAULT 75.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure is_active column exists
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Users Table (Roles: Super Admin, Shop Owner, Staff)
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(255) PRIMARY KEY,
  shop_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Shop Owner',
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
  id VARCHAR(255) PRIMARY KEY,
  shop_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255),
  user_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255),
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS or set open policy for public tables if RLS is restrictive
ALTER TABLE public.shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
