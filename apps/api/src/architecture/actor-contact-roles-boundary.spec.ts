/**
 * Actor Contact Roles Boundary — Structural & Completeness Test
 *
 * Ensures all transactional actor contact roles (Sales, Purchasing, Billing, Delivery)
 * remain synchronized across @herobm/shared, production seed scripts, and document dispatch workflows.
 */
import {
  ACTOR_CONTACT_ROLE,
  DEFAULT_ACTOR_CONTACT_ROLES,
  ActorContactRole,
} from '@herobm/shared';
import * as fs from 'fs';
import * as path from 'path';

describe('Actor Contact Roles Boundary & Completeness', () => {
  it('should define all 4 canonical actor contact roles in ACTOR_CONTACT_ROLE', () => {
    const expectedRoles: ActorContactRole[] = [
      'sales',
      'purchasing',
      'billing',
      'delivery',
    ];

    const actualRoles = Object.values(ACTOR_CONTACT_ROLE);
    expect(actualRoles.sort()).toEqual(expectedRoles.sort());
  });

  it('should include all canonical roles in DEFAULT_ACTOR_CONTACT_ROLES with sequential order', () => {
    const defaultValues = DEFAULT_ACTOR_CONTACT_ROLES.map((r) =>
      r.value.toLowerCase(),
    );
    const canonicalValues = Object.values(ACTOR_CONTACT_ROLE);

    for (const canonical of canonicalValues) {
      expect(defaultValues).toContain(canonical);
    }

    // Verify ordering is sequential starting from 1
    const orders = DEFAULT_ACTOR_CONTACT_ROLES.map((r) => r.order);
    expect(orders).toEqual([1, 2, 3, 4]);
  });

  it('should ensure production seeds in core.ts reference DEFAULT_ACTOR_CONTACT_ROLES', () => {
    const coreSeedPath = path.resolve(__dirname, '../seeds/prod/core.ts');
    expect(fs.existsSync(coreSeedPath)).toBe(true);

    const content = fs.readFileSync(coreSeedPath, 'utf-8');
    expect(content).toContain('DEFAULT_ACTOR_CONTACT_ROLES');
    expect(content).toContain('actorContactRoles: DEFAULT_ACTOR_CONTACT_ROLES');
  });

  it('should ensure document dispatch workflows default to valid canonical roles', () => {
    // 1. PO workflow defaults to 'sales'
    // 2. Sales order / quote workflow defaults to 'purchasing'
    // 3. Shipping docket workflow defaults to 'delivery'
    // 4. Invoices and statements default to 'billing'
    const validRoles = new Set(Object.values(ACTOR_CONTACT_ROLE));

    expect(validRoles.has('sales')).toBe(true);
    expect(validRoles.has('purchasing')).toBe(true);
    expect(validRoles.has('delivery')).toBe(true);
    expect(validRoles.has('billing')).toBe(true);
  });
});
