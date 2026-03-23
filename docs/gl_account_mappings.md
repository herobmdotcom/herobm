# GL Account Mapping Reference

This document records the GL account mappings used by automated journal postings in ModBM. These mappings are currently resolved from GL Settings or hardcoded by convention. They should be made configurable via the UI in a future release.

## Sales Invoice (AR)

| Purpose | Source | Default Code | Account Type |
|---|---|---|---|
| Accounts Receivable | `gl_settings.default_ar_account_id` | 1100 | Asset |
| Sales Revenue | `gl_settings.default_revenue_account_id` | 4100 | Revenue |
| GST Payable | `gl_settings.default_tax_account_id` | 2200 | Liability |

**Journal pattern**: Debit AR (gross), Credit Revenue (net), Credit GST (tax).
AR line carries `partyType: 'customer'` and `partyId` for sub-ledger tracking.

## Sales Credit Note (Return)

| Purpose | Source | Default Code | Account Type |
|---|---|---|---|
| Sales Revenue | `gl_settings.default_revenue_account_id` | 4100 | Revenue |
| GST Payable | `gl_settings.default_tax_account_id` | 2200 | Liability |
| Accounts Receivable | `gl_settings.default_ar_account_id` | 1100 | Asset |
| Restocking Fee Income | Hardcoded convention | 4900 | Revenue |

**Journal pattern**: Debit Revenue (credit amount), Debit GST (tax reversal), Credit AR (net credit after fees), Credit 4900 (restocking fees).
AR line carries `partyType: 'customer'` and `partyId`.

> [!NOTE]
> GST is calculated per-line using each order line's `gstCategoryId`, not at the order level.

## Purchase Invoice (AP)

| Purpose | Source | Default Code | Account Type |
|---|---|---|---|
| Accounts Payable | `gl_settings.default_ap_account_id` | 2100 | Liability |
| Expense / COGS | `gl_settings.default_expense_account_id` | 6900 | Expense |
| GST Receivable | `gl_settings.default_tax_account_id` | 1200 | Asset |

**Journal pattern**: Debit Expense (net), Debit GST Receivable (input tax), Credit AP (gross).

## Future Improvements

- [ ] Make restocking fee account configurable via GL Settings
- [ ] Add per-product revenue account overrides
- [ ] Add per-product COGS account mapping
- [ ] Support multi-currency GL postings
