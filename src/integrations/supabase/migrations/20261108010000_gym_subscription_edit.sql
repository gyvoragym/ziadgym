-- GYVORA: lets the super admin edit each approved gym's plan, prices and subscription dates.
-- Safe to run more than once. Run in Supabase -> SQL Editor -> New query -> Run.

BEGIN;

ALTER TABLE public.owner_requests
  ADD COLUMN IF NOT EXISTS subscription_start date,
  ADD COLUMN IF NOT EXISTS subscription_end date,
  ADD COLUMN IF NOT EXISTS monthly_price numeric CHECK (monthly_price IS NULL OR (monthly_price >= 0 AND monthly_price <= 100000000)),
  ADD COLUMN IF NOT EXISTS annual_price numeric CHECK (annual_price IS NULL OR (annual_price >= 0 AND annual_price <= 1200000000)),
  ADD COLUMN IF NOT EXISTS annual_price_manual boolean NOT NULL DEFAULT false;

ALTER TABLE public.owner_requests DROP CONSTRAINT IF EXISTS owner_requests_subscription_dates_check;
ALTER TABLE public.owner_requests ADD CONSTRAINT owner_requests_subscription_dates_check
  CHECK (subscription_start IS NULL OR subscription_end IS NULL OR subscription_end >= subscription_start);

COMMIT;
