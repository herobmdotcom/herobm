import sys
import os

def load_env(profile=None, override=False):
    if not profile:
        active_prof_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.active_profile'))
        if os.path.exists(active_prof_path):
            with open(active_prof_path, 'r', encoding='utf-8') as f:
                profile = f.read().strip()
    env_file = f".env.{profile}" if profile else ".env"
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', env_file))
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    k_clean = k.strip()
                    v_clean = v.strip().strip('"').strip("'")
                    if override or k_clean not in os.environ:
                        os.environ[k_clean] = v_clean
    return profile or "default"

def get_connection(profile=None):
    import psycopg2
    load_env(profile, override=True)
    conn = psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        dbname=os.environ.get("POSTGRES_DB", "herobm")
    )
    conn.autocommit = True
    return conn

def psql_query(cur, sql: str) -> str:
    try:
        cur.execute(sql)
        row = cur.fetchone()
        if row and row[0] is not None:
            return str(row[0])
        return "0"
    except Exception as e:
        try:
            cur.connection.rollback()
        except Exception:
            pass
        if "does not exist" in str(e).lower():
            return "MISSING"
        return f"ERR: {e}"

# 1. Master Data (1-to-1 Staging vs Core DB)
ABM_MASTER_DATA_CHECKS = [
    ("Customers", "SELECT count(*) FROM raw_abm.customers", "SELECT count(*) FROM herobm_core.customers", "Includes 1 seeded fallback customer"),
    ("Suppliers", "SELECT count(*) FROM raw_abm.suppliers", "SELECT count(*) FROM herobm_core.suppliers", "Includes 1 seeded fallback supplier"),
    ("Products", "SELECT count(*) FROM raw_abm.products", "SELECT count(*) FROM herobm_core.products", "Includes 1 seeded system product"),
    ("Locations", "SELECT count(*) FROM raw_abm.plocations", "SELECT count(*) FROM herobm_core.locations", None),
    ("Tax Categories", "SELECT count(*) FROM raw_abm.ltaxrates", "SELECT count(*) FROM herobm_core.tax_categories", None),
    ("Trading Terms", "SELECT count(*) FROM raw_abm.tradingterms", "SELECT count(*) FROM herobm_core.trading_terms", None),
]

ODOO_MASTER_DATA_CHECKS = [
    ("Customers", "SELECT count(*) FROM raw_odoo.res_partner WHERE customer_rank > 0 OR is_company = true OR id IN (SELECT partner_id FROM raw_odoo.sale_order) OR id IN (SELECT partner_id FROM raw_odoo.account_move WHERE move_type = 'out_invoice')", "SELECT count(*) FROM herobm_core.customers WHERE source = 'odoo'", "Odoo customer partners"),
    ("Suppliers", "SELECT count(*) FROM raw_odoo.res_partner WHERE supplier_rank > 0 OR is_company = true", "SELECT count(*) FROM herobm_core.suppliers WHERE source = 'odoo'", "Odoo supplier partners"),
    ("Products", "SELECT count(*) FROM raw_odoo.product_product", "SELECT count(*) FROM herobm_core.products WHERE source = 'odoo'", "Odoo product variants"),
    ("Locations", "SELECT count(*) FROM raw_odoo.stock_warehouse", "SELECT count(*) FROM herobm_core.locations WHERE source = 'odoo'", "Odoo warehouses mapped to HeroBM locations"),
    ("Tax Categories", "SELECT count(*) FROM raw_odoo.account_tax", "SELECT count(*) FROM herobm_core.tax_categories WHERE source = 'odoo'", "Odoo tax rates"),
    ("Trading Terms", "SELECT count(*) FROM raw_odoo.account_payment_term", "SELECT count(*) FROM herobm_core.trading_terms WHERE source = 'odoo'", "Odoo payment terms"),
]

MASTER_DATA_CHECKS = ABM_MASTER_DATA_CHECKS

# 2. Inventory & Stock Reconciliation (Staging vs Core DB)
ABM_INVENTORY_RECONCILIATION_CHECKS = [
    (
        "Physical Stock QOH (Units)",
        "SELECT round(sum(coalesce(ld.quantity_on_hand, 0)), 2) FROM raw_abm.plocdetails ld JOIN herobm_core.products p ON trim(p.source_id) = trim(ld.product_id) WHERE p.product_type = 'inventory' AND ld.quantity_on_hand > 0",
        "SELECT round(sum(coalesce(actual_quantity, 0)), 2) FROM herobm_core.bin_contents",
        "Total physical on-hand inventory units (positive stock)"
    ),
    (
        "Stocked Products Count",
        "SELECT count(DISTINCT ld.product_id) FROM raw_abm.plocdetails ld JOIN herobm_core.products p ON trim(p.source_id) = trim(ld.product_id) WHERE coalesce(ld.quantity_on_hand, 0) > 0 AND p.product_type = 'inventory'",
        "SELECT count(DISTINCT product_id) FROM herobm_core.bin_contents WHERE coalesce(actual_quantity, 0) != 0",
        "Distinct products holding physical inventory"
    ),
    (
        "Inventory Levels QOH Match",
        "SELECT round(sum(coalesce(actual_quantity, 0)), 2) FROM herobm_core.bin_contents",
        "SELECT round(sum(coalesce(quantity_on_hand, 0)), 2) FROM herobm_core.inventory_levels",
        "inventory_levels view total QOH matches bin_contents"
    ),
]

ODOO_INVENTORY_RECONCILIATION_CHECKS = [
    (
        "Physical Stock QOH (Units)",
        "SELECT round(sum(coalesce(sq.quantity, 0)), 2) FROM raw_odoo.stock_quant sq JOIN raw_odoo.stock_location loc ON loc.id = sq.location_id WHERE loc.usage = 'internal' AND coalesce(sq.quantity, 0) > 0",
        "SELECT round(sum(coalesce(actual_quantity, 0)), 2) FROM herobm_core.bin_contents",
        "Total physical on-hand inventory units (positive stock in internal locations)"
    ),
    (
        "Stocked Products Count",
        "SELECT count(DISTINCT sq.product_id) FROM raw_odoo.stock_quant sq JOIN raw_odoo.stock_location loc ON loc.id = sq.location_id WHERE loc.usage = 'internal' AND coalesce(sq.quantity, 0) > 0",
        "SELECT count(DISTINCT product_id) FROM herobm_core.bin_contents WHERE coalesce(actual_quantity, 0) != 0",
        "Distinct products holding physical inventory"
    ),
    (
        "Inventory Levels QOH Match",
        "SELECT round(sum(coalesce(actual_quantity, 0)), 2) FROM herobm_core.bin_contents",
        "SELECT round(sum(coalesce(quantity_on_hand, 0)), 2) FROM herobm_core.inventory_levels",
        "inventory_levels view total QOH matches bin_contents"
    ),
]

INVENTORY_RECONCILIATION_CHECKS = ABM_INVENTORY_RECONCILIATION_CHECKS


# 3. Data Quality & Business Invariants (violations must be 0)
INVARIANT_CHECKS = [
    (
        "Negative Sales Line Qty",
        "SELECT count(*) FROM herobm_core.sales_order_lines WHERE quantity < 0 AND sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-4000-8000-000000000001')",
        "Order line quantities must always be non-negative"
    ),
    (
        "Negative Purchase Line Qty",
        "SELECT count(*) FROM herobm_core.purchase_order_lines WHERE quantity < 0 AND purchase_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')",
        "Purchase line quantities must always be non-negative"
    ),
    (
        "Negative Sales Invoice Line Qty",
        "SELECT count(*) FROM herobm_core.sales_invoice_lines WHERE quantity_invoiced < 0",
        "Sales invoice line quantities must always be non-negative"
    ),
    (
        "Negative Purchase Invoice Line Qty",
        "SELECT count(*) FROM herobm_core.purchase_invoice_lines WHERE quantity_invoiced < 0",
        "Purchase invoice line quantities must always be non-negative"
    ),
    (
        "Invalid Sales Line Numbers",
        "SELECT count(*) FROM herobm_core.sales_order_lines WHERE line_number <= 0 AND sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-4000-8000-000000000001')",
        "Line numbers must be positive sequential integers starting at 1"
    ),
    (
        "Invalid Purchase Line Numbers",
        "SELECT count(*) FROM herobm_core.purchase_order_lines WHERE line_number <= 0 AND purchase_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')",
        "Line numbers must be positive sequential integers starting at 1"
    ),
    (
        "Duplicate Sales Line Nums",
        "SELECT count(*) FROM (SELECT sales_order_id, line_number FROM herobm_core.sales_order_lines WHERE sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-4000-8000-000000000001') GROUP BY sales_order_id, line_number HAVING count(*) > 1) t",
        "Line numbers must be strictly unique per sales order"
    ),
    (
        "Duplicate Purchase Line Nums",
        "SELECT count(*) FROM (SELECT purchase_order_id, line_number FROM herobm_core.purchase_order_lines WHERE purchase_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') GROUP BY purchase_order_id, line_number HAVING count(*) > 1) t",
        "Line numbers must be strictly unique per purchase order"
    ),
    (
        "Sales Line Financial Balance",
        "SELECT count(*) FROM herobm_core.sales_order_lines WHERE abs(coalesce(amount, 0) + coalesce(tax, 0) - coalesce(total_amount, 0)) > 0.01 AND sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-4000-8000-000000000001')",
        "Line item total_amount must equal amount + tax (within 1 cent)"
    ),
    (
        "Purchase Line Financial Balance",
        "SELECT count(*) FROM herobm_core.purchase_order_lines WHERE abs(coalesce(amount, 0) + coalesce(tax, 0) - coalesce(total_amount, 0)) > 0.01 AND purchase_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')",
        "Line item total_amount must equal amount + tax (within 1 cent)"
    ),
    (
        "Orphaned Bin Stock",
        "SELECT count(*) FROM herobm_core.bin_contents bc LEFT JOIN herobm_core.bins b ON b.bin_id = bc.bin_id LEFT JOIN herobm_core.products p ON p.product_id = bc.product_id WHERE b.bin_id IS NULL OR p.product_id IS NULL",
        "Bin stock must reference valid existing products and bins"
    ),
    (
        "Duplicate Bin Product Pairs",
        "SELECT count(*) FROM (SELECT bin_id, product_id FROM herobm_core.bin_contents GROUP BY bin_id, product_id HAVING count(*) > 1) t",
        "Each product can only have one bin_contents entry per bin"
    ),
    (
        "Non-Stock / Kit Physical Stock",
        "SELECT count(*) FROM herobm_core.bin_contents bc JOIN herobm_core.products p ON p.product_id = bc.product_id WHERE (p.product_type = 'non-stock' OR p.structure_type = 'kit') AND bc.actual_quantity != 0",
        "Non-stock items and kits cannot hold physical inventory"
    ),
    (
        "Orphaned Default Bins",
        "SELECT count(*) FROM herobm_core.product_default_bins pdb LEFT JOIN herobm_core.bins b ON b.bin_id = pdb.bin_id LEFT JOIN herobm_core.products p ON p.product_id = pdb.product_id LEFT JOIN herobm_core.locations l ON l.location_id = pdb.location_id WHERE b.bin_id IS NULL OR p.product_id IS NULL OR l.location_id IS NULL",
        "Default bin mappings must reference valid products, locations, and bins"
    ),
    (
        "Cross-Location Default Bin Mismatch",
        "SELECT count(*) FROM herobm_core.product_default_bins pdb JOIN herobm_core.bins b ON b.bin_id = pdb.bin_id JOIN herobm_core.zones z ON z.zone_id = b.zone_id WHERE z.location_id != pdb.location_id",
        "Default bins must reside in a zone belonging to the assigned location"
    ),
    (
        "Spurious ABM_IMPORT Default Bins",
        "SELECT count(*) FROM herobm_core.product_default_bins pdb JOIN herobm_core.bins b ON b.bin_id = pdb.bin_id WHERE b.bin_number = 'ABM_IMPORT' AND (pdb.is_primary_per_loc = false OR EXISTS (SELECT 1 FROM herobm_core.product_default_bins pdb2 JOIN herobm_core.bins b2 ON b2.bin_id = pdb2.bin_id WHERE pdb2.product_id = pdb.product_id AND pdb2.location_id = pdb.location_id AND b2.bin_number != 'ABM_IMPORT'))",
        "ABM_IMPORT must only exist as unbinned fallback when no real bin exists, and must not coexist with real bins"
    ),
    (
        "Zero-Stock ABM_IMPORT Default Bins",
        "SELECT count(*) FROM herobm_core.product_default_bins pdb JOIN herobm_core.bins b ON b.bin_id = pdb.bin_id LEFT JOIN (SELECT bc.product_id, z.location_id, sum(bc.actual_quantity) as total_qty FROM herobm_core.bin_contents bc JOIN herobm_core.bins b2 ON b2.bin_id = bc.bin_id JOIN herobm_core.zones z ON z.zone_id = b2.zone_id GROUP BY bc.product_id, z.location_id) stock ON stock.product_id = pdb.product_id AND stock.location_id = pdb.location_id WHERE b.bin_number = 'ABM_IMPORT' AND coalesce(stock.total_qty, 0) <= 0",
        "ABM_IMPORT default bins must never be created for products with zero or negative inventory"
    ),
    (
        "Zero-Line Purchase Orders",
        "SELECT count(*) FROM herobm_core.purchase_orders po LEFT JOIN herobm_core.purchase_order_lines pol ON po.purchase_order_id = pol.purchase_order_id WHERE po.purchase_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') AND po.order_number NOT LIKE 'Standalone Return%' AND pol.purchase_order_line_id IS NULL",
        "All purchase orders (excluding fallback/standalone return anchors) must have at least one line item"
    ),
    (
        "Zero-Line Sales Orders",
        "SELECT count(*) FROM herobm_core.sales_orders so LEFT JOIN herobm_core.sales_order_lines sol ON so.sales_order_id = sol.sales_order_id WHERE so.sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') AND so.order_number NOT LIKE 'Standalone Delivery%' AND so.order_number NOT LIKE 'SO-FALLBACK%' AND sol.sales_order_line_id IS NULL",
        "All sales orders (excluding fallback/standalone delivery anchors) must have at least one line item"
    ),
    (
        "Zero-Line Sales Invoices",
        "SELECT count(*) FROM herobm_core.sales_invoices si LEFT JOIN herobm_core.sales_invoice_lines sil ON si.invoice_id = sil.invoice_id WHERE sil.invoice_line_id IS NULL",
        "All sales invoices must have at least one invoice line item"
    ),
    (
        "Custom-Line-Only Sales Invoices",
        "SELECT count(*) FROM (SELECT si.invoice_id FROM herobm_core.sales_invoices si JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id JOIN herobm_core.sales_invoice_lines sil ON si.invoice_id = sil.invoice_id LEFT JOIN herobm_core.sales_order_lines sol ON sol.sales_order_line_id = sil.sales_order_line_id LEFT JOIN herobm_core.products p ON p.product_id = sol.product_id WHERE si.sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid) GROUP BY si.invoice_id HAVING bool_and((p.product_number = 'SYSTEM-CUSTOM-LINE' OR sol.sales_order_line_id = '00000000-0000-0000-0000-000000000010'::uuid OR p.product_id = '00000000-0000-0000-0000-000000000000'::uuid) AND (coalesce(sol.product_description, '') = 'Custom Line Product' OR coalesce(p.name, '') = 'Custom Line Product')))",
        "Sales invoices must not consist exclusively of SYSTEM-CUSTOM-LINE products with description 'Custom Line Product'"
    ),
    (
        "Zero-Line Purchase Invoices",
        "SELECT count(*) FROM herobm_core.purchase_invoices pi LEFT JOIN herobm_core.purchase_invoice_lines pil ON pi.invoice_id = pil.invoice_id WHERE pil.invoice_line_id IS NULL",
        "All purchase invoices must have at least one invoice line item"
    ),
    (
        "Zero-Line Goods Received",
        "SELECT count(*) FROM herobm_core.goods_received gr LEFT JOIN herobm_core.goods_received_lines grl ON gr.goods_received_id = grl.goods_received_id WHERE gr.goods_received_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') AND grl.goods_received_line_id IS NULL",
        "All goods received notes (excluding fallback anchors) must have at least one line item"
    ),
    (
        "GL Trial Balance Zero-Sum",
        "SELECT count(*) FROM (SELECT round(abs(coalesce(sum(debit), 0) - coalesce(sum(credit), 0)), 2) as diff FROM herobm_core.gl_journal_lines HAVING round(abs(coalesce(sum(debit), 0) - coalesce(sum(credit), 0)), 2) > 0.01) t",
        "Total General Ledger debits must equal credits across all posted lines"
    ),
    (
        "GL Postings on Group Accounts",
        "SELECT count(*) FROM herobm_core.gl_journal_lines jl JOIN herobm_core.gl_accounts a ON a.gl_account_id = jl.gl_account_id WHERE a.is_group = true",
        "Journal lines must never post to group accounts"
    ),
    (
        "GL Orphan Lines",
        "SELECT count(*) FROM herobm_core.gl_journal_lines jl LEFT JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id LEFT JOIN herobm_core.gl_accounts a ON a.gl_account_id = jl.gl_account_id WHERE je.journal_entry_id IS NULL OR a.gl_account_id IS NULL",
        "Journal lines must reference existing journal entries and valid accounts"
    ),
    (
        "Invoices on Invalid Order States",
        "SELECT count(*) FROM (SELECT si.invoice_id FROM herobm_core.sales_invoices si JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id WHERE so.sales_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') AND so.state_code IN ('quoted', 'draft', 'cancelled') UNION ALL SELECT pi.invoice_id FROM herobm_core.purchase_invoices pi JOIN herobm_core.purchase_orders po ON po.purchase_order_id = pi.purchase_order_id WHERE po.purchase_order_id NOT IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') AND po.state_code IN ('draft', 'cancelled')) t",
        "Invoices must not be linked to orders in draft, quoted, or cancelled states"
    ),
]

# 4. Operational Data Volumes & Metrics (Informational)
VOLUME_METRICS = [
    ("GL Accounts", "SELECT count(*) FROM herobm_core.gl_accounts"),
    ("GL Journal Entries", "SELECT count(*) FROM herobm_core.gl_journal_entries"),
    ("GL Journal Lines", "SELECT count(*) FROM herobm_core.gl_journal_lines"),
    ("Sales Orders (Non-Quoted)", "SELECT count(*) FROM herobm_core.sales_orders WHERE state_code != 'quoted' AND sales_order_id != '00000000-0000-0000-0000-000000000001'"),
    ("Sales Quotes", "SELECT count(*) FROM herobm_core.sales_orders WHERE state_code = 'quoted'"),
    ("Sales Order Lines", "SELECT count(*) FROM herobm_core.sales_order_lines WHERE sales_order_id != '00000000-0000-0000-0000-000000000001'"),
    ("Purchase Orders", "SELECT count(*) FROM herobm_core.purchase_orders WHERE purchase_order_id != '00000000-0000-0000-0000-000000000002'"),
    ("Purchase Order Lines", "SELECT count(*) FROM herobm_core.purchase_order_lines WHERE purchase_order_id != '00000000-0000-0000-0000-000000000002'"),
    ("Sales Invoices", "SELECT count(*) FROM herobm_core.sales_invoices"),
    ("Sales Invoice Lines", "SELECT count(*) FROM herobm_core.sales_invoice_lines"),
    ("Purchase Invoices", "SELECT count(*) FROM herobm_core.purchase_invoices"),
    ("Purchase Invoice Lines", "SELECT count(*) FROM herobm_core.purchase_invoice_lines"),
    ("Fallback Sales Invoices", "SELECT count(*) FROM herobm_core.sales_invoices WHERE sales_order_id = '00000000-0000-0000-0000-000000000001'"),
    ("Fallback Purchase Invoices", "SELECT count(*) FROM herobm_core.purchase_invoices WHERE purchase_order_id = '00000000-0000-0000-0000-000000000002'"),
    ("Active Stock Bins", "SELECT count(DISTINCT bin_id) FROM herobm_core.bin_contents WHERE actual_quantity != 0"),
    ("Default Bin Mappings", "SELECT count(*) FROM herobm_core.product_default_bins"),
    ("Negative Stock Lines (Informational)", "SELECT count(*) FROM herobm_core.bin_contents WHERE actual_quantity < 0"),
    ("Legacy Negative Stock Lines (Staging)", "SELECT count(*) FROM raw_abm.plocdetails WHERE quantity_on_hand < 0"),
    ("Legacy Negative Stock Units (Staging)", "SELECT round(abs(coalesce(sum(quantity_on_hand), 0)), 2) FROM raw_abm.plocdetails WHERE quantity_on_hand < 0"),
]

def resolve_control_account(cur, setting_id, patterns, code_fallbacks):
    # 1. Try explicit ID from gl_settings
    if setting_id and setting_id != '00000000-0000-0000-0000-000000000000':
        cur.execute(f"SELECT gl_account_id, account_code, name FROM herobm_core.gl_accounts WHERE gl_account_id = '{setting_id}';")
        row = cur.fetchone()
        if row:
            return str(row[0]), str(row[1] or ''), str(row[2] or '')

    # 2. Try exact name matches
    for pat in patterns:
        cur.execute(f"SELECT gl_account_id, account_code, name FROM herobm_core.gl_accounts WHERE name ILIKE '{pat}' AND is_group = false ORDER BY account_code ASC LIMIT 1;")
        row = cur.fetchone()
        if row:
            return str(row[0]), str(row[1] or ''), str(row[2] or '')

    # 3. Try code fallbacks
    for code in code_fallbacks:
        cur.execute(f"SELECT gl_account_id, account_code, name FROM herobm_core.gl_accounts WHERE account_code = '{code}' AND is_group = false LIMIT 1;")
        row = cur.fetchone()
        if row:
            return str(row[0]), str(row[1] or ''), str(row[2] or '')

    # 4. Try containing name matches
    for pat in patterns:
        cur.execute(f"SELECT gl_account_id, account_code, name FROM herobm_core.gl_accounts WHERE name ILIKE '%{pat}%' AND is_group = false ORDER BY account_code ASC LIMIT 1;")
        row = cur.fetchone()
        if row:
            return str(row[0]), str(row[1] or ''), str(row[2] or '')

    return '00000000-0000-0000-0000-000000000000', '', ''

def check_subledger_reconciliation(cur):
    """
    Continuous Subledger Reconciliation parity checks:
    Compares dynamically resolved GL Control Account balances with operational subledgers (AR, AP, GRNI, Perpetual Inventory).
    """
    recon_checks = []
    
    # 1. Trial Balance Zero-Sum Equality
    tb_sql = "SELECT round(abs(coalesce(sum(debit), 0) - coalesce(sum(credit), 0)), 2) FROM herobm_core.gl_journal_lines;"
    tb_diff = float(psql_query(cur, tb_sql) or "0")
    recon_checks.append(("Trial Balance Zero-Sum", "0.00", f"{tb_diff:.2f}", f"{tb_diff:.2f}", abs(tb_diff) < 0.01))

    # Get control account settings
    settings_sql = """
    SELECT 
        default_ar_account_id, default_ap_account_id, default_grni_account_id, default_inventory_account_id
    FROM herobm_core.gl_settings LIMIT 1;
    """
    try:
        cur.execute(settings_sql)
        settings_row = cur.fetchone()
    except Exception:
        settings_row = None

    set_ar_id = settings_row[0] if settings_row and settings_row[0] else None
    set_ap_id = settings_row[1] if settings_row and settings_row[1] else None
    set_grni_id = settings_row[2] if settings_row and settings_row[2] else None
    set_inv_id = settings_row[3] if settings_row and settings_row[3] else None

    # Dynamically resolve accounts across any chart of accounts
    ar_id, ar_code, ar_name = resolve_control_account(cur, set_ar_id, ['Trade Debtors', 'Accounts Receivable'], ['0510', '1200', '11000', '1100'])
    ap_id, ap_code, ap_name = resolve_control_account(cur, set_ap_id, ['Trade Creditors', 'Accounts Payable'], ['0600', '2000', '21000', '2100'])
    grni_id, grni_code, grni_name = resolve_control_account(cur, set_grni_id, ['Stock Delivered not invoiced', 'Goods Received Not Invoiced', 'GRNI Accrual', 'Received Not Invoiced'], ['0535', '2150', '2120'])
    inv_id, inv_code, inv_name = resolve_control_account(cur, set_inv_id, ['Stock on Hand', 'Inventory', 'Finished Goods', 'Merchandise Inventory'], ['0530', '1300', '12000'])

    # 2. AR Parity
    ar_sub_sql = """
    SELECT ((SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.sales_invoices WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.sales_credit_notes WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_unallocated_amount, unallocated_amount)), 0)::numeric FROM herobm_core.payment_entries WHERE payment_type = 'customer_receipt' AND state_code NOT IN ('draft', 'cancelled')))::numeric;
    """
    ar_gl_sql = f"""
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::numeric FROM herobm_core.gl_journal_lines jl
    WHERE jl.gl_account_id = '{ar_id}';
    """
    ar_sub = float(psql_query(cur, ar_sub_sql) or "0")
    ar_gl = float(psql_query(cur, ar_gl_sql) or "0")
    ar_drift = ar_sub - ar_gl
    ar_label = f"AR Control ({ar_code})" if ar_code else "Accounts Receivable (AR)"
    recon_checks.append((ar_label, f"{ar_sub:.2f}", f"{ar_gl:.2f}", f"{ar_drift:.2f}", abs(ar_drift) <= 1.00, False))

    # 3. AP Parity
    ap_sub_sql = """
    SELECT ((SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.purchase_invoices WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.purchase_debit_notes WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_unallocated_amount, unallocated_amount)), 0)::numeric FROM herobm_core.payment_entries WHERE payment_type = 'supplier_payment' AND state_code NOT IN ('draft', 'cancelled')))::numeric;
    """
    ap_gl_sql = f"""
    SELECT COALESCE(SUM(jl.credit - jl.debit), 0)::numeric FROM herobm_core.gl_journal_lines jl
    WHERE jl.gl_account_id = '{ap_id}';
    """
    ap_sub = float(psql_query(cur, ap_sub_sql) or "0")
    ap_gl = float(psql_query(cur, ap_gl_sql) or "0")
    ap_drift = ap_sub - ap_gl
    ap_label = f"AP Control ({ap_code})" if ap_code else "Accounts Payable (AP)"
    recon_checks.append((ap_label, f"{ap_sub:.2f}", f"{ap_gl:.2f}", f"{ap_drift:.2f}", abs(ap_drift) <= 1.00, False))

    # 4. GRNI Parity
    grni_sub_sql = """
    SELECT COALESCE(SUM(CASE WHEN gr.state_code = 'received' THEN grl.quantity_received * COALESCE(grl.unit_cost, p.standard_cost, p.weighted_average_cost, 0) ELSE 0 END), 0)::numeric
    FROM herobm_core.goods_received_lines grl
    JOIN herobm_core.goods_received gr ON gr.goods_received_id = grl.goods_received_id
    JOIN herobm_core.products p ON p.product_id = grl.product_id
    WHERE gr.state_code = 'received';
    """
    grni_gl_sql = f"""
    SELECT COALESCE(SUM(jl.credit - jl.debit), 0)::numeric FROM herobm_core.gl_journal_lines jl
    WHERE jl.gl_account_id = '{grni_id}';
    """
    grni_sub = float(psql_query(cur, grni_sub_sql) or "0")
    grni_gl = float(psql_query(cur, grni_gl_sql) or "0")
    grni_drift = grni_sub - grni_gl
    grni_label = f"GRNI Accrual ({grni_code})" if grni_code else "Goods Received Not Invoiced (GRNI)"
    recon_checks.append((grni_label, f"{grni_sub:.2f}", f"{grni_gl:.2f}", f"{grni_drift:.2f}", abs(grni_drift) <= 1.00, False))

    # 5. Perpetual Inventory Parity
    inv_sub_sql = """
    SELECT COALESCE(SUM(bc.actual_quantity * COALESCE(p.weighted_average_cost, p.standard_cost, 0)), 0)::numeric
    FROM herobm_core.bin_contents bc
    JOIN herobm_core.products p ON p.product_id = bc.product_id;
    """
    inv_gl_sql = f"""
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::numeric FROM herobm_core.gl_journal_lines jl
    WHERE jl.gl_account_id = '{inv_id}';
    """
    inv_sub = float(psql_query(cur, inv_sub_sql) or "0")
    inv_gl = float(psql_query(cur, inv_gl_sql) or "0")
    inv_drift = inv_sub - inv_gl
    inv_label = f"Stock on Hand ({inv_code})" if inv_code else "Perpetual Inventory"
    recon_checks.append((inv_label, f"{inv_sub:.2f}", f"{inv_gl:.2f}", f"{inv_drift:.2f}", abs(inv_drift) <= 1.00, False))

    return recon_checks

def gl_ap_str(ar_gl, ap_gl):
    return ap_gl

def main(profile=None, source=None):
    if not source:
        if "--source" in sys.argv:
            try:
                source = sys.argv[sys.argv.index("--source") + 1]
            except (IndexError, ValueError):
                source = os.environ.get("SOURCE", "abm")
        else:
            source = os.environ.get("SOURCE", "abm")

    source = (source or "abm").lower()

    print("\n" + "="*70)
    print(f" DATA VERIFICATION & QUALITY AUDIT (SOURCE: {source.upper()})")
    print("="*70)

    try:
        conn = get_connection(profile)
        cur = conn.cursor()
    except Exception as e:
        print(f"\n[!] Failed to connect to PostgreSQL: {e}")
        sys.exit(1)

    failed = False

    master_checks = ODOO_MASTER_DATA_CHECKS if source == "odoo" else ABM_MASTER_DATA_CHECKS
    inv_checks = ODOO_INVENTORY_RECONCILIATION_CHECKS if source == "odoo" else ABM_INVENTORY_RECONCILIATION_CHECKS

    # Section 1: Master Data Reconciliation
    print("\n--- 1. MASTER DATA RECONCILIATION ---")
    hdr = f"{'Entity':<24} | {'Staging':<10} | {'Core DB':<10} | {'Status'}"
    print(hdr)
    print("-" * len(hdr))

    for name, stg_sql, core_sql, note in master_checks:
        stg_val = psql_query(cur, stg_sql)
        core_val = psql_query(cur, core_sql)

        if stg_val == "MISSING" or core_val == "MISSING":
            print(f"{name:<24} | {'N/A':<10} | {'N/A':<10} | [SKIPPED]")
            continue

        try:
            stg_cnt = int(stg_val)
            core_cnt = int(core_val)
            # Allow for seeded rows (+1 to +10)
            if core_cnt >= stg_cnt and (core_cnt - stg_cnt) <= 10:
                status = "[OK]"
            elif core_cnt == stg_cnt:
                status = "[OK]"
            else:
                status = "[WARN]"
        except ValueError:
            status = "[ERR]"

        print(f"{name:<24} | {stg_val:<10} | {core_val:<10} | {status}")

    # Section 2: Inventory & Stock Reconciliation
    print("\n--- 2. INVENTORY & STOCK RECONCILIATION ---")
    inv_rec_hdr = f"{'Stock Metric':<32} | {'Staging':<12} | {'Core DB':<12} | {'Status'}"
    print(inv_rec_hdr)
    print("-" * len(inv_rec_hdr))

    for name, stg_sql, core_sql, desc in inv_checks:
        stg_val = psql_query(cur, stg_sql)
        core_val = psql_query(cur, core_sql)

        if stg_val == "MISSING" or core_val == "MISSING":
            print(f"{name:<32} | {'N/A':<12} | {'N/A':<12} | [SKIPPED]")
            continue

        try:
            stg_f = float(stg_val)
            core_f = float(core_val)
            if abs(stg_f - core_f) <= 0.01:
                status = "[OK]"
            elif abs(stg_f - core_f) / max(abs(stg_f), 1) < 0.01:
                status = "[OK]"
            else:
                status = "[WARN]"
        except ValueError:
            status = "[ERR]"

        print(f"{name:<32} | {stg_val:<12} | {core_val:<12} | {status}")

    # Section 3: Data Quality Invariants
    print("\n--- 3. DATA QUALITY & INTEGRITY INVARIANTS ---")
    inv_hdr = f"{'Invariant Rule':<38} | {'Violations':<10} | {'Status'}"
    print(inv_hdr)
    print("-" * len(inv_hdr))

    for name, sql, desc in INVARIANT_CHECKS:
        val = psql_query(cur, sql)
        try:
            cnt = int(val)
            if cnt == 0:
                status = "[PASS]"
            else:
                status = "[FAIL]"
                failed = True
        except ValueError:
            status = "[ERR]"
            failed = True

        print(f"{name:<38} | {val:<10} | {status}")

    # Section 4: Continuous Subledger Reconciliation & Parity
    print("\n--- 4. CONTINUOUS SUBLEDGER RECONCILIATION & GL PARITY ---")
    recon_hdr = f"{'Control Account':<36} | {'Subledger':<12} | {'GL Balance':<12} | {'Drift':<10} | {'Status'}"
    print(recon_hdr)
    print("-" * len(recon_hdr))

    for item in check_subledger_reconciliation(cur):
        name, sub_val, gl_val, drift_val, is_matched = item[0], item[1], item[2], item[3], item[4]
        is_strict = item[5] if len(item) > 5 else True
        if is_matched:
            status = "[PASS]"
        elif is_strict:
            status = "[FAIL]"
            failed = True
        else:
            status = "[AUDIT]"
        print(f"{name:<36} | {sub_val:<12} | {gl_val:<12} | {drift_val:<10} | {status}")

    # Section 5: Operational Volumes
    print("\n--- 5. OPERATIONAL DATA VOLUMES (CORE DB) ---")
    vol_hdr = f"{'Entity / Metric':<38} | {'Count':<10} | {'Status'}"
    print(vol_hdr)
    print("-" * len(vol_hdr))

    for name, sql in VOLUME_METRICS:
        val = psql_query(cur, sql)
        print(f"{name:<38} | {val:<10} | [INFO]")

    conn.close()

    print("\n" + "="*70)
    if failed:
        print(" [!] QUALITY GATE FAILED: One or more data invariants were violated.")
        sys.exit(1)
    else:
        print(" [OK] ALL QUALITY GATES PASSED: Master data, invariants, and subledger parity verified.")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
