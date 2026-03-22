-- 0018_invoicing_schemas.sql
-- Adds sales_invoices, sales_invoice_lines, purchase_invoices, purchase_invoice_lines
-- and erpnext_id / erpnext_journal_id columns for ERPNext GL sync.
-- Fully idempotent per §12.

-- Sales Invoices (AR header)
CREATE TABLE IF NOT EXISTS "modbm_core"."sales_invoices" (
    "invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "invoice_number" text NOT NULL,
    "sales_order_id" uuid NOT NULL,
    "erpnext_journal_id" text,
    "total_amount" numeric NOT NULL,
    "tax_amount" numeric DEFAULT '0',
    "currency_code" text DEFAULT 'EUR' NOT NULL,
    "state_code" text DEFAULT 'draft' NOT NULL,
    "notes" text,
    "created_by" text,
    "created_on" timestamp with time zone DEFAULT now(),
    "modified_on" timestamp with time zone DEFAULT now(),
    CONSTRAINT "sales_invoices_invoice_number_unique" UNIQUE("invoice_number")
);

-- Sales Invoice Lines (AR details)
CREATE TABLE IF NOT EXISTS "modbm_core"."sales_invoice_lines" (
    "invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "invoice_id" uuid NOT NULL,
    "sales_order_line_id" uuid NOT NULL,
    "quantity_invoiced" numeric NOT NULL,
    "price_per_unit" numeric NOT NULL,
    "amount" numeric NOT NULL
);

-- Purchase Invoices (AP header)
CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_invoices" (
    "invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "invoice_number" text NOT NULL,
    "purchase_order_id" uuid NOT NULL,
    "supplier_invoice_number" text,
    "erpnext_journal_id" text,
    "total_amount" numeric NOT NULL,
    "tax_amount" numeric DEFAULT '0',
    "currency_code" text DEFAULT 'EUR' NOT NULL,
    "state_code" text DEFAULT 'draft' NOT NULL,
    "notes" text,
    "created_by" text,
    "created_on" timestamp with time zone DEFAULT now(),
    "modified_on" timestamp with time zone DEFAULT now(),
    CONSTRAINT "purchase_invoices_invoice_number_unique" UNIQUE("invoice_number")
);

-- Purchase Invoice Lines (AP details)
CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_invoice_lines" (
    "invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "invoice_id" uuid NOT NULL,
    "purchase_order_line_id" uuid NOT NULL,
    "quantity_invoiced" numeric NOT NULL,
    "price_per_unit" numeric NOT NULL,
    "amount" numeric NOT NULL
);

-- Add erpnext_id columns to accounts and suppliers
ALTER TABLE "modbm_core"."accounts" ADD COLUMN IF NOT EXISTS "erpnext_id" text;
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN IF NOT EXISTS "erpnext_id" text;

-- Foreign Keys (exception-wrapped for idempotency)
DO $$ BEGIN
    ALTER TABLE "modbm_core"."sales_invoices"
        ADD CONSTRAINT "sales_invoices_sales_order_id_sales_orders_sales_order_id_fk"
        FOREIGN KEY ("sales_order_id")
        REFERENCES "modbm_core"."sales_orders"("sales_order_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."sales_invoice_lines"
        ADD CONSTRAINT "sales_invoice_lines_invoice_id_sales_invoices_invoice_id_fk"
        FOREIGN KEY ("invoice_id")
        REFERENCES "modbm_core"."sales_invoices"("invoice_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."sales_invoice_lines"
        ADD CONSTRAINT "sales_invoice_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk"
        FOREIGN KEY ("sales_order_line_id")
        REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_invoices"
        ADD CONSTRAINT "purchase_invoices_purchase_order_id_purchase_orders_purchase_order_id_fk"
        FOREIGN KEY ("purchase_order_id")
        REFERENCES "modbm_core"."purchase_orders"("purchase_order_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_invoice_lines"
        ADD CONSTRAINT "purchase_invoice_lines_invoice_id_purchase_invoices_invoice_id_fk"
        FOREIGN KEY ("invoice_id")
        REFERENCES "modbm_core"."purchase_invoices"("invoice_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_invoice_lines"
        ADD CONSTRAINT "purchase_invoice_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk"
        FOREIGN KEY ("purchase_order_line_id")
        REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;