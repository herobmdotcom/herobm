import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { getCreditBlockedSql } from './orders.sql';
import {
  salesOrders,
  customers,
  customerGroups,
  actors,
} from '../drizzle/herobm-core-schema';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { CUSTOMER_STATE } from '@herobm/shared';

describe('orders.sql - getCreditBlockedSql', () => {
  const pg = setupPgliteSuite();

  async function createCustomer(
    overrides: Partial<typeof customers.$inferInsert> = {},
  ) {
    const customerId = randomUUID();
    const [act] = await pg.db
      .insert(actors)
      .values({
        name: 'Test Customer',
      })
      .returning();

    await pg.db.insert(customers).values({
      actorId: act.actorId,
      customerId,
      customerNumber: `CUST-${customerId.substring(0, 8)}`,
      currencyCode: 'AUD',
      ...overrides,
    });
    return customerId;
  }

  async function createOrder(
    customerId: string,
    overrides: Partial<typeof salesOrders.$inferInsert> = {},
  ) {
    const salesOrderId = randomUUID();
    await pg.db.insert(salesOrders).values({
      salesOrderId,
      orderNumber: `SO-${salesOrderId.substring(0, 8)}`,
      customerId,
      currencyCode: 'AUD',
      fulfillmentLocationId: '10000000-0000-4000-8000-000000000001',
      ...overrides,
    });
    return salesOrderId;
  }

  async function checkCreditBlocked(salesOrderId: string): Promise<boolean> {
    const res = await pg.db
      .select({
        isBlocked: getCreditBlockedSql(),
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .where(eq(salesOrders.salesOrderId, salesOrderId));

    return res[0]?.isBlocked ?? false;
  }

  it('should return false if customer is active and not on hold', async () => {
    const customerId = await createCustomer({
      stateCode: CUSTOMER_STATE.ACTIVE,
      isOnCreditHold: false,
    });
    const orderId = await createOrder(customerId);

    const isBlocked = await checkCreditBlocked(orderId);
    expect(isBlocked).toBe(false);
  });

  it('should return true if customer isOnCreditHold is true', async () => {
    const customerId = await createCustomer({
      stateCode: CUSTOMER_STATE.ACTIVE,
      isOnCreditHold: true,
    });
    const orderId = await createOrder(customerId);

    const isBlocked = await checkCreditBlocked(orderId);
    expect(isBlocked).toBe(true);
  });

  it('should return false if order has a creditHoldOverrideAt timestamp', async () => {
    const customerId = await createCustomer({
      stateCode: CUSTOMER_STATE.ACTIVE,
      isOnCreditHold: true,
    });
    const orderId = await createOrder(customerId, {
      creditHoldOverrideAt: new Date(),
    });

    const isBlocked = await checkCreditBlocked(orderId);
    expect(isBlocked).toBe(false); // Override takes precedence
  });

  it('should return false if customer has a valid overrideCreditHoldUntil timestamp', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const customerId = await createCustomer({
      stateCode: CUSTOMER_STATE.ACTIVE,
      isOnCreditHold: true,
      overrideCreditHoldUntil: futureDate,
    });
    const orderId = await createOrder(customerId);

    const isBlocked = await checkCreditBlocked(orderId);
    expect(isBlocked).toBe(false); // Valid override takes precedence
  });

  it('should return true if customer overrideCreditHoldUntil has expired', async () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);

    const customerId = await createCustomer({
      stateCode: CUSTOMER_STATE.ACTIVE,
      isOnCreditHold: true,
      overrideCreditHoldUntil: pastDate,
    });
    const orderId = await createOrder(customerId);

    const isBlocked = await checkCreditBlocked(orderId);
    expect(isBlocked).toBe(true); // Expired override is ignored
  });

  it('should return true if customer stateCode is not active', async () => {
    const customerId = await createCustomer({
      stateCode: CUSTOMER_STATE.INACTIVE,
      isOnCreditHold: false,
    });
    const orderId = await createOrder(customerId);

    const isBlocked = await checkCreditBlocked(orderId);
    expect(isBlocked).toBe(true);
  });
});
