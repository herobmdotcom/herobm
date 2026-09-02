# Frontend Architecture & UI Patterns

This document defines the strict constraints and established patterns for building user interfaces within the `ops-portal` (Next.js) application. Adhering to these patterns ensures a consistent user experience, identical technical foundations, and a secure interface.

## 1. Authentication & Role-Based Access (AuthZ)

Authentication and session validation interact closely with the NestJS API layer (refer to `api_layer_guide.md` for Casbin RBAC rules).

- **`AuthGate` Component**: The top-level application shell is wrapped in `<AuthGate>`. This component calls `validateSession()` on mount to ensure the user's JWT is fully valid or prompts them to log in.
- **`useAuth()` Hook**: Always use the `useAuth()` hook to access the context of `{ authenticated, role }`. 
  - *Constraint*: The frontend never makes authoritative security decisions, but you **must** use `role` to conditionally render UI (e.g., hiding edit or delete buttons from `viewer` roles) to provide a smooth UX before the API rejects the request.

## 2. API Data Fetching & Mutations

Our app explicitly manages component states rather than relying heavily on library abstractions like React Query or SWR.

### GET Requests
Always use the `apiFetch<T>` wrapper (from `lib/api.ts`).
- Trigger fetches in `useEffect` blocks or via standard event handlers. 
- **DTO Strict Boundary:** Map responses to localized TypeScript `interface`s within your components for strict type safety. **Never** import DTO files directly from `apps/api`. Because the NestJS backend strictly uses `class`-based DTOs for `class-validator` metadata reflection, importing them into the frontend will severely bloat the Next.js bundle with backend decorators.
- Capture `loading` states as `boolean` flags to render skeletons or spinners.

### POST / PUT / DELETE Mutations
Always use the `apiMutate<T>` wrapper (from `lib/api.ts`).

> [!IMPORTANT]  
> **Strict Form Constraints:** Use **standard React controlled components** (`useState`) for form fields. We do **not** use `react-hook-form` or `formik` unless a form requires exceptionally complex dynamic array mapping not practically manageable by vanilla state.

- Explicitly wrap all `apiMutate` calls in a `try/catch` block.
- Keep a local `error` state string and render it cleanly on failure. Use our standard Tailwind/CSS-in-JS aesthetic for alert banners (e.g., specific `rgba(239, 68, 68, 0.1)` backgrounds for errors).
- Manage `submitting` boolean states to explicitly disable "Save" buttons during flight to prevent double-submissions.

## 3. The `DataGrid` Component

The core structural element for displaying tabular data is the shared `<DataGrid>` (`components/shared/DataGrid.tsx`), which provides a rich wrapper around the AG Grid Community edition.

### Core Implementation
- Provide a typed `columns` array (`ColDef<T>[]`) overriding specific formats such as `valueFormatter: numericFormatter`.
- Pass a valid `endpoint` and the authenticated `apiFetch` instance.
- **Feature Flags**:
  - `showArchivedToggle`: Boolean flag determining if the UI should offer an "Include Archived" checkbox.
  - `fetchAll`: For small datasets (like Locations or Tax Rates), set `fetchAll={true}` so the grid handles search and filtering client-side. For massive datasets (e.g., Products or Orders), rely on the built-in server-side pagination.

### Persistence Mechanisms
`DataGrid` contains essential quality-of-life persistence:
- **`localStorage`**: Using the passed `gridKey`, it stores the user's column width, order, and visibility configuration across sessions.
- **`sessionStorage`**: Stores vertical and horizontal scroll positions so that navigating out of the grid and pressing the "Back" button perfectly restores the user's view.

## 4. Navigation & Layout Structures

### Global Sidebar
Global navigation is driven mechanically via the `<Sidebar>` component.
- Located within `components/shared/Sidebar.tsx` and utilized heavily in the `Shell`.
- Receives strict typed `NavSection` configurations (grouping related `NavItem` objects with `subItems`).
- It uses Next.js `usePathname()` to automatically highlight the current active route and its parent accordion items. 

### In-Page Structure (`EntityHeader`)
Almost all detail and module pages must utilize the `<EntityHeader>` component (`components/shared/EntityHeader.tsx`).

- **Consistent Typography**: Enforces exact spacing, title tags (`h1`), and subtitles across the app.
- **Contextual Actions**: Allows injection of `badges` next to the title (e.g., `Status: Shipped`).
- **Save Bar**: Exposes standardized `isSaving`, `isDirty`, and `onSave` callbacks that unify how data commits look and feel across modules.
- **Responsive Layout**: Aligns custom `actions` neatly to the top-right of the title block.

## 5. Styling Ecosystem
- **CSS Architecture**: Use utility classes (TailwindCSS patterns) combined with specific CSS variables defined in `/theme.css` and `/globals.css`.
- **Theme Variables**: Always prioritize our mapped variables (e.g., `var(--text-primary)`, `var(--bg-card)`, `var(--border)`, `var(--accent)`) to ensure the application automatically adheres to dark-mode capabilities and aesthetic redesigns securely.
- **Semantic Colors**: For status badges and semantic highlights, use `var(--success)` (emerald/green), `var(--warning)` (amber), and `var(--danger)` (red). Combine a light background with a solid dot or border for badges.
- **Interactivity & Density**: Use `transition-all` or `transition-colors` for all hover states. Ensure interactive elements have clear focus states. Maintain a dense UI suitable for back-office power users by preferring tighter spacing (`p-2`, `p-4`, `gap-2`).
- **AI Agent Enforcement**: The exact UI implementation specifics (such as density constraints, tailwind arbitrary variable injection, and specific styling patterns) are rigorously documented and mechanically enforced via the [UI Design System Agent Workflow](../../.agents/workflows/ui_design_system.md).
- **Internationalization**: Texts, especially for standard UI elements like grid options, save buttons, and error messages, must be driven through `next-intl` (e.g., `const t = useTranslations('common')`). Do not hardcode literal textual values into the React components where possible. See [messages/README.md](../../apps/ops-portal/messages/README.md) for the full namespace structure, key naming conventions, and rules for adding new translation keys.

## 6. Internationalization (i18n)

The `ops-portal` uses `next-intl` with **strict TypeScript type checking** enabled. Every key passed to `t()` or `useTranslations()` must exist in `apps/ops-portal/messages/en.json` — otherwise `tsc` will reject it with a `TS2345` error.

- **Namespace Reference**: See [`messages/README.md`](../../apps/ops-portal/messages/README.md) for the complete namespace map (16 namespaces), sub-key grouping conventions (`columns.*`, `buttons.*`, `labels.*`, etc.), and instructions for adding new keys.
- **Validation**: Run `npm run typecheck -w apps/ops-portal` to verify all keys resolve correctly.
- **Shared keys**: Common strings (column headers, button labels, state names) go under `common`. Module-specific strings go under their respective namespace (`salesOrders`, `products`, etc.).

## 7. Testing & Verification

For verifying frontend layouts and functionality quickly without the overhead of heavy integration tests or manual clicks, the `ops-portal` uses a lightweight verification workflow.

- **Smoke Tests**: We rely on shallow E2E checks via Playwright (`apps/ops-portal/e2e/*.spec.ts`) that simply load the exact page you are working on to catch syntax errors, layout crashes, and unhandled React exceptions natively.
- **Static Analysis**: Heavy reliance on TypeScript (`npm run typecheck`) and the OpenAPI schema generator (`npm run generate-api`) keeps the contract with the backend API secure and robust.
- **Verification Workflow**: Always follow the steps in `.agents/workflows/verify-frontend.md` before finalizing frontend work.
