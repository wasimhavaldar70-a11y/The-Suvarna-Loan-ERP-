-- ========================================================
-- SuvarnaLoan ERP - Supabase Database Schema Migration
-- Migration 03: Add is_active column to shops table
-- ========================================================

-- Add is_active column to public.shops table if it does not exist
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing shops to have is_active = true
UPDATE public.shops 
SET is_active = true 
WHERE is_active IS NULL;
