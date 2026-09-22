-- Add endorsement percentage support to Purchase and Sales Orders
-- Enables partial endorsement payment workflows where only a percentage of the bill amount is required for endorsement

-- 1. Purchase Orders: Add endorsement_percentage column
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS endorsement_percentage numeric(5,2) DEFAULT 0 CHECK (endorsement_percentage >= 0 AND endorsement_percentage <= 100);

-- 2. Sales Orders: Add endorsement_percentage column
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS endorsement_percentage numeric(5,2) DEFAULT 0 CHECK (endorsement_percentage >= 0 AND endorsement_percentage <= 100);

-- 3. Purchase Order Payments: Add endorsement tracking columns
ALTER TABLE public.purchase_order_payments
  ADD COLUMN IF NOT EXISTS endorsement_required numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS endorsement_paid numeric(18,4) DEFAULT 0;

-- 4. Sales Order Payments: Add endorsement tracking columns
ALTER TABLE public.sales_order_payments
  ADD COLUMN IF NOT EXISTS endorsement_required numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS endorsement_paid numeric(18,4) DEFAULT 0;

-- 5. Function: Calculate endorsement requirement from percentage
CREATE OR REPLACE FUNCTION public.calc_endorsement_required(
  p_total_amount numeric,
  p_endorsement_percentage numeric
) RETURNS numeric AS $function$
BEGIN
  IF p_endorsement_percentage IS NULL OR p_endorsement_percentage <= 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND((p_total_amount * p_endorsement_percentage) / 100, 4);
END;
$function$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Function: Check if endorsement requirement is satisfied
CREATE OR REPLACE FUNCTION public.is_endorsement_satisfied(
  p_required numeric,
  p_paid numeric
) RETURNS boolean AS $function$
BEGIN
  IF p_required IS NULL OR p_required <= 0 THEN
    RETURN TRUE; -- No endorsement required
  END IF;
  RETURN COALESCE(p_paid, 0) >= COALESCE(p_required, 0);
END;
$function$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Trigger: Auto-calculate endorsement_required for purchase orders
CREATE OR REPLACE FUNCTION public.trg_purchase_order_calc_endorsement()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.endorsement_percentage > 0 AND NEW.order_total IS NOT NULL AND NEW.order_total > 0 THEN
    NEW.endorsement_required := ROUND((NEW.order_total * NEW.endorsement_percentage) / 100, 4);
  ELSE
    NEW.endorsement_required := 0;
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_endorsement_calc ON public.purchase_orders;
CREATE TRIGGER trg_purchase_endorsement_calc
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purchase_order_calc_endorsement();

-- 8. Trigger: Auto-calculate endorsement_required for sales orders
CREATE OR REPLACE FUNCTION public.trg_sales_order_calc_endorsement()
RETURNS TRIGGER AS $function$
BEGIN
  IF NEW.endorsement_percentage > 0 AND NEW.order_total IS NOT NULL AND NEW.order_total > 0 THEN
    NEW.endorsement_required := ROUND((NEW.order_total * NEW.endorsement_percentage) / 100, 4);
  ELSE
    NEW.endorsement_required := 0;
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_endorsement_calc ON public.sales_orders;
CREATE TRIGGER trg_sales_endorsement_calc
  BEFORE INSERT OR UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sales_order_calc_endorsement();
