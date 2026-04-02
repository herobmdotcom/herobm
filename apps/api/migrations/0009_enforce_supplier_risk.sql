-- 0009_enforce_supplier_risk.sql
-- Custom migration: Defense in Depth Trigger for Supplier Risk

CREATE OR REPLACE FUNCTION modbm_core.check_supplier_risk_block()
RETURNS trigger AS $$
DECLARE
    v_supplier_blocked boolean;
    v_group_blocked boolean;
    v_expiry_breached boolean;
BEGIN
    IF NEW.vendor_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Check Supplier explicitly
    SELECT is_purchasing_blocked INTO v_supplier_blocked
    FROM modbm_core.suppliers
    WHERE vendor_id = NEW.vendor_id;

    IF v_supplier_blocked THEN
        RAISE EXCEPTION 'Purchase blocked: Supplier is on purchasing hold.';
    END IF;

    -- 2. Check Supplier Group inheritance
    SELECT g.is_purchasing_blocked INTO v_group_blocked
    FROM modbm_core.suppliers s
    LEFT JOIN modbm_core.supplier_groups g ON s.supplier_group_id = g.supplier_group_id
    WHERE s.vendor_id = NEW.vendor_id;

    IF v_group_blocked THEN
        RAISE EXCEPTION 'Purchase blocked: Supplier Group is on purchasing hold.';
    END IF;

    -- 3. Check for any Compliance Expiries that have elapsed
    SELECT EXISTS (
        SELECT 1 FROM modbm_core.supplier_expiries
        WHERE vendor_id = NEW.vendor_id
        AND expiry_date < CURRENT_DATE
    ) INTO v_expiry_breached;

    IF v_expiry_breached THEN
         RAISE EXCEPTION 'Purchase blocked: Supplier has expired compliance documents (e.g. Insurance or Tax Certificate).';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_supplier_purchasing_block
BEFORE INSERT OR UPDATE ON modbm_core.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION modbm_core.check_supplier_risk_block();