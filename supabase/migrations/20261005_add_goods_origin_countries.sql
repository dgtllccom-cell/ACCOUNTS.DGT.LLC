-- Migration: 20261005_add_goods_origin_countries.sql
-- Description: Ensure common import/export origin countries (e.g. Chile, USA) exist in public.countries

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.countries WHERE name = 'Chile') THEN
    INSERT INTO public.countries (name, iso2, iso3, currency_code, reporting_currency, is_active, official_email, admin_email, email_server_settings)
    VALUES ('Chile', 'CL', 'CHL', 'CLP', 'USD', true, 'info.cl@dgt.llc', 'admin.cl@dgt.llc', '{}'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.countries WHERE name = 'USA') THEN
    INSERT INTO public.countries (name, iso2, iso3, currency_code, reporting_currency, is_active, official_email, admin_email, email_server_settings)
    VALUES ('USA', 'US', 'USA', 'USD', 'USD', true, 'info.us@dgt.llc', 'admin.us@dgt.llc', '{}'::jsonb);
  END IF;
END $$;
