# General Ledger (GL) & Financial Fundamentals

This document describes how ModBM handles core financial accounting. The native General Ledger (GL) sits at the center of the system, acting as the ultimate source of truth for all financial movements.

## The Chart of Accounts (COA)

The Chart of Accounts is the backbone of the financial system. It is a hierarchical list of all accounts used to record transactions.

### Organization

Accounts are organized into an expandable "tree" structure using groups and leaf nodes. You can only post financial amounts to **leaf accounts** (accounts that do not have children). Group accounts are used purely for organization and rolling up totals on reports.

Every account in the system belongs to one of five fundamental root types:

| Type | Behavioral Rule | Examples |
|------|-----------------|----------|
| **Asset** | Increased by Debits. What you own or are owed. | Bank, Accounts Receivable, Inventory |
| **Liability**| Increased by Credits. What you owe to others. | Accounts Payable, Tax Collected |
| **Equity** | Increased by Credits. The owner's residual interest. | Retained Earnings, Share Capital |
| **Income** | Increased by Credits. Money earned. | Sales Revenue, Interest Income |
| **Expense** | Increased by Debits. Money spent to operate. | Cost of Goods Sold, Rent, Software Subscriptions |

### System Accounts

Certain accounts are flagged as **System Accounts** (e.g., Accounts Receivable, Sales Revenue, GST Collected). These accounts are automatically targeted by normal business operations (like invoicing). To prevent catastrophic system failure, System Accounts cannot be deleted or deactivated, though their names can be updated.

---

## Double-Entry Accounting

ModBM strictly enforces the principles of double-entry accounting. Every business event must be recorded as a **Journal Entry** consisting of two or more lines.

### The Golden Rule: The Balance Invariant

The system refuses to save any transaction where the total Debits do not mathematically equal the total Credits.

```
Total Debits = Total Credits
```

If you attempt to post an unbalanced entry, the system will immediately reject it. This ensures your books are always perfectly balanced.

---

## How Transactions Are Generated

Journal entries enter the ledger through two distinct pathways:

### 1. Automated Subledger Posting (Business Operations)

When your team performs daily operational tasks, the system figures out the accounting for you automatically behind the scenes.

**Example: Creating a Sales Invoice**
When a Sales Invoice for EUR 100.00 + 9% GST is submitted, the invoice engine automatically generates and posts a balanced journal entry:

*   **Debit:** Accounts Receivable — EUR 109.00
*   **Credit:** Sales Revenue — EUR 100.00
*   **Credit:** GST Collected (Liability) — EUR 9.00

*The user creating the invoice never sees or worries about debits and credits; it happens instantly.*

**Example: Creating a Purchase Invoice (Bill)**
When a Purchase Invoice for EUR 200.00 + 9% GST is submitted:

*   **Credit:** Accounts Payable — EUR 218.00
*   **Debit:** Expenses — EUR 200.00
*   **Debit:** GST Paid (Asset) — EUR 18.00

### 2. Manual Journal Entries

Sometimes the finance team needs to record transactions that fall outside normal operational workflows (e.g., recording depreciation, owner dividend payouts, or correcting a mistake).

Authorized users (`admin` or `finance` roles) can create manual journal entries directly through the Ops Portal via **Finance > Journal Entries**. These entries are subject to the exact same strict balancing rules as automated entries.

---

## Financial Reporting

ModBM provides real-time visibility into the financial health of the business via the Ops Portal.

### Trial Balance
The Trial Balance is a snapshot proving that your books are balanced. It lists every active leaf account alongside its total Debits, total Credits, and current running Balance up to a specific "As of Date". 

If the grand total at the bottom of the Trial Balance shows `Debits = Credits`, you know the math in the database holds true.

### General Ledger
The General Ledger view is the detailed investigative tool. You can filter the view down to a single account (e.g., "Accounts Receivable") across a specific date range. It will display every single transaction line that touched that account, providing a chronological running balance so you can audit exactly why an account sits at a particular number.

---

## Security and Permissions

Financial data is strictly controlled via Role-Based Access Control (RBAC).

By default, standard operational roles (`sales`, `warehouse`, `procurement`) cannot see any financial reporting, nor can they view the Chart of Accounts or Journal Entries.

Only users explicitly assigned the **`admin`** or **`finance`** roles have the authority to view the GL reports and post manual journal entries.
