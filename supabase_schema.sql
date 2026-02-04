
-- ============================================
-- [Initialization] Helper Functions & Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- RLS(Row Level Security)를 쉽게 켜기 위한 헬퍼 함수
CREATE OR REPLACE FUNCTION enable_all_access(tbl text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS "AllAccess" ON %I', tbl);
  EXECUTE format('CREATE POLICY "AllAccess" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
END;
$$ LANGUAGE phpgsql;

-- ============================================
-- 1. Core Tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.veterinarians (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL,
    specialty TEXT DEFAULT 'General',
    email TEXT UNIQUE,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('veterinarians');

CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_number TEXT,
    name TEXT NOT NULL,
    species TEXT,
    breed TEXT,
    birth_date DATE,
    gender TEXT,
    weight DECIMAL(5,2),
    owner TEXT,
    phone TEXT,
    avatar TEXT,
    notes TEXT,
    medical_memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_chart_number ON public.patients(chart_number);
SELECT enable_all_access('patients');

-- ============================================
-- 2. Clinical Tables (Medical Records)
-- ============================================

CREATE TABLE IF NOT EXISTS public.soap_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    cc TEXT,
    subjective TEXT,
    objective TEXT,
    assessment_problems TEXT,
    assessment_ddx JSONB DEFAULT '[]'::jsonb,
    plan_tx TEXT,
    plan_rx TEXT,
    plan_summary TEXT,
    images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs (string[])
    lab_results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Ensure images column exists and has default for legacy tables
ALTER TABLE public.soap_records ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
SELECT enable_all_access('soap_records');

-- ============================================
-- 3. Department Orders & Storage
-- ============================================

DO $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.department_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL, 
        patient_name TEXT NOT NULL,
        department TEXT NOT NULL, 
        vet_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 칼럼 보정
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS soap_id UUID REFERENCES public.soap_records(id);
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS request_details TEXT;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb; -- Array of {url, name}
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS attachment_url TEXT;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

    -- 부서 제약 조건
    ALTER TABLE public.department_orders DROP CONSTRAINT IF EXISTS department_orders_department_check;
    ALTER TABLE public.department_orders ADD CONSTRAINT department_orders_department_check 
    CHECK (department IN ('Treatment', 'Pharmacy', 'X-ray', 'Ultrasound'));

EXCEPTION WHEN others THEN RAISE NOTICE 'Order table fix error: %', SQLERRM;
END $$;
SELECT enable_all_access('department_orders');

-- Storage Bucket & Policies
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('order_images', 'order_images', true)
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM storage.policies WHERE bucket_id = 'order_images';
    CREATE POLICY "Public Access" ON storage.objects FOR ALL 
    USING ( bucket_id = 'order_images' ) WITH CHECK ( bucket_id = 'order_images' );
END $$;

-- ============================================
-- 4. Billing System
-- ============================================

CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  sku_code TEXT UNIQUE,
  default_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('service_catalog');

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Unpaid',
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('billing_invoices');

CREATE TABLE IF NOT EXISTS public.billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  linked_order_id UUID REFERENCES department_orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL, 
  category TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('billing_items');

-- ============================================
-- 5. Realtime Publication Fix (CRITICAL)
-- ============================================

-- 기존 게시물을 완전히 삭제하고 다시 생성하여 모든 테이블이 포함되도록 보장
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
    patients, 
    waitlist, 
    soap_records, 
    department_orders, 
    billing_items, 
    veterinarians;

-- ============================================
-- Final Action: Refresh Schema Cache
-- ============================================
NOTIFY pgrst, 'reload schema';
