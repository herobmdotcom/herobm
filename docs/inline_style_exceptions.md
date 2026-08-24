# Inline Style Exceptions & Architectural Review

## 1. Executive Summary

As part of the UI consistency and style hygiene initiative (**ADV-124**), inline `style={{...}}` blocks across `apps/ops-portal` have been audited, systematically refactored, and ratcheted down from **977** occurrences to **2** remaining occurrences.

The structural test in [`infra/tests/test_adv_124_no_unannotated_inline_styles.ts`](../infra/tests/test_adv_124_no_unannotated_inline_styles.ts) enforces **zero unannotated inline styles**. Any inline style must have an explicit dynamic justification comment directly above it (`{/* inline-style-allowed: <reason> */}`).

---

## 2. Legitimate Dynamic Exceptions

The remaining 2 inline styles are strictly runtime-computed dynamic indentation values for recursive tree structures that cannot be statically modeled via Tailwind utility classes without generating an arbitrary finite set of hardcoded level classes:

### Exception 1: Chart of Accounts Depth Indentation
- **File:** [`apps/ops-portal/app/admin/settings/financial/components/CoASettingsSection.tsx`](../apps/ops-portal/app/admin/settings/financial/components/CoASettingsSection.tsx#L113)
- **Code:**
  ```tsx
  <td style={{ paddingLeft: `${(data.depth || 0) * 20 + 8}px` }}>
  ```
- **Rationale:** Computes the visual indentation of arbitrary recursive Chart of Accounts categories and accounts. Depth can theoretically be nested to $N$ levels based on the user's customized chart structure.

### Exception 2: General Ledger Account Codes Modal Tree Depth
- **File:** [`apps/ops-portal/app/general-ledger/CodesModal.tsx`](../apps/ops-portal/app/general-ledger/CodesModal.tsx#L165)
- **Code:**
  ```tsx
  <td
    className={`px-3 py-1.5 text-xs ${selectedAccount === node.accountCode ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}
    style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
  >
  ```
- **Rationale:** Computes the visual indentation of nested GL account nodes in the account picker modal dynamically based on recursive tree traversal depth.

---

## 3. Categories Refactored to Tailwind

During the audit, the following common patterns were migrated to Tailwind CSS:

1. **Colors & CSS Variables:** Replaced `style={{ color: 'var(--text-muted)' }}` and `style={{ background: 'var(--bg-card)' }}` with `text-[var(--text-muted)]`, `bg-[var(--bg-card)]`, and semantic Tailwind utility classes.
2. **Typography & Fonts:** Replaced `style={{ fontFamily: 'Manrope, sans-serif' }}` and font weight styles with Tailwind font token classes.
3. **Table Column & Component Widths:** Replaced `style={{ width: 140, textAlign: 'right' }}` with `className="w-[140px] text-right"`.
4. **Form Controls & Checkboxes:** Replaced `style={{ accentColor: 'var(--accent)' }}` with `className="accent-[var(--accent)]"`.
5. **Dynamic CSS Variables (AG Grid / DataGrid):** Replaced `style={{ '--ag-row-height': '40px' } as React.CSSProperties}` with Tailwind arbitrary properties `className="[--ag-row-height:40px]"`.
6. **DataGrid & Table Overlays:** Converted AG Grid `cellStyle` callbacks to `cellClass` returning Tailwind class strings (e.g. `text-red-500 font-bold`).

---

## 4. Policy & Future Guidelines

- **Standard Rule:** All presentation, layout, alignment, colors, typography, borders, and animations MUST use Tailwind CSS classes.
- **Dynamic Exceptions:** Inline `style={{ ... }}` is ONLY permitted when values are truly calculated at runtime from continuous/unbounded data (e.g., dynamic coordinates on a 2D canvas, percentage calculations for arbitrary multi-column distributions, or recursive tree depth indentation).
