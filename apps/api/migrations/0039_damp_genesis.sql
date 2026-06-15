UPDATE "herobm_core"."payment_entries"
SET "payment_type" = 
  CASE 
    WHEN "payment_type" = 'receive' AND "party_type" = 'customer' THEN 'customer_receipt'
    WHEN "payment_type" = 'receive' AND "party_type" = 'supplier' THEN 'supplier_refund'
    WHEN "payment_type" = 'receive' AND "party_type" = 'gl_account' THEN 'direct_receipt'
    WHEN "payment_type" = 'pay' AND "party_type" = 'supplier' THEN 'supplier_payment'
    WHEN "payment_type" = 'pay' AND "party_type" = 'customer' THEN 'customer_refund'
    WHEN "payment_type" = 'pay' AND "party_type" = 'gl_account' THEN 'direct_payment'
    ELSE "payment_type"
  END;

ALTER TABLE "herobm_core"."payment_entries" DROP COLUMN "party_type";