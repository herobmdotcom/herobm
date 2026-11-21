import {
  customerGroups,
  customers,
  masterDataEvents,
  organizations,
  supplierGroups,
  suppliers,
  tradingTerms,
} from '@herobm/db-schema';
import { CUSTOMER_STATE, ORGANIZATION_STATE } from '@herobm/shared';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import { SupplierGroupsService } from '../suppliers/supplier-groups.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { CreditAssessmentService } from './credit-assessment.service';
import { CustomerGroupsService } from './customer-groups.service';
import { CustomersWriteService } from './customers-write.service';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto';

describe('ADV-234: Customer Group Trading Terms & Credit Inheritance', () => {
  const pg = setupPgliteSuite();
  let customersService: CustomersService;
  let customersWriteService: CustomersWriteService;
  let customerGroupsService: CustomerGroupsService;
  let supplierGroupsService: SupplierGroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        CustomersWriteService,
        CustomerGroupsService,
        SupplierGroupsService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: CreditAssessmentService,
          useValue: {
            assessCreditBatch: jest.fn().mockResolvedValue({}),
            assessCredit: jest.fn().mockResolvedValue({
              glBalance: 0,
              totalInvoiceBalance: 0,
              overdueInvoiceBalance: 0,
              isOverdue: false,
            }),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            creditLimitBehavior: jest.fn().mockReturnValue('hard'),
            homeCurrency: () => 'AUD',
            taxProviderMappings: () => ({}),
          },
        },
        {
          provide: 'CASBIN_ENFORCER',
          useValue: { enforce: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    customersService = module.get<CustomersService>(CustomersService);
    customersWriteService = module.get<CustomersWriteService>(
      CustomersWriteService,
    );
    customerGroupsService = module.get<CustomerGroupsService>(
      CustomerGroupsService,
    );
    supplierGroupsService = module.get<SupplierGroupsService>(
      SupplierGroupsService,
    );

    await pg.db.delete(masterDataEvents);
    await pg.db.delete(customers);
    await pg.db.delete(customerGroups);
    await pg.db.delete(suppliers);
    await pg.db.delete(supplierGroups);
    await pg.db.delete(organizations);
  });

  it('inherits group trading terms, credit limit, and discount when customer has no override in findOne', async () => {
    const [term] = await pg.db
      .insert(tradingTerms)
      .values({
        code: 'TEST_NET30',
        description: '30 Days Net',
        days: 30,
        type: 'days_after_invoice',
        source: 'app',
        isActive: true,
      })
      .returning();

    const [group] = await pg.db
      .insert(customerGroups)
      .values({
        groupCode: 'GRP-RETAIL',
        name: 'Retail Group',
        tradingTermsId: term.tradingTermsId,
        creditLimit: '5000.00',
        earlyPaymentDiscount: '2.5',
        earlyPaymentDiscountDays: 10,
        isOnCreditHold: false,
        stateCode: CUSTOMER_STATE.ACTIVE,
      })
      .returning();

    const [org] = await pg.db
      .insert(organizations)
      .values({
        stateCode: ORGANIZATION_STATE.ACTIVE,
        name: 'Acme Retail',
        headquartersAddressLine1: '123 Main St',
        headquartersCountry: 'AU',
        isTaxRegistered: false,
      })
      .returning();

    const [cust] = await pg.db
      .insert(customers)
      .values({
        organizationId: org.organizationId,
        customerNumber: 'CUST-001',
        customerGroupId: group.customerGroupId,
        tradingTermsId: null,
        creditLimit: null,
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'test',
      })
      .returning();

    const result = await customersService.findOne(cust.customerId);

    expect(result.customerGroupId).toBe(group.customerGroupId);
    expect(result.tradingTermsId).toBeNull();
    expect(result.creditLimit).toBeNull();
    // Invariants enforced by ADV-234:
    expect(result.effectiveTradingTermsId).toBe(term.tradingTermsId);
    expect(result.customerGroupTradingTermsId).toBe(term.tradingTermsId);
    expect(result.effectiveCreditLimit).toBe('5000.00');
    expect(result.customerGroupCreditLimit).toBe('5000.00');
    expect(result.effectiveEarlyPaymentDiscount).toBe('2.5');
    expect(result.effectiveEarlyPaymentDiscountDays).toBe(10);
  });

  it('respects customer-level override for trading terms and credit limit while preserving group reference in findOne', async () => {
    const [termGroup, termCust] = await pg.db
      .insert(tradingTerms)
      .values([
        {
          code: 'TEST_NET30_2',
          description: '30 Days Net',
          days: 30,
          type: 'days_after_invoice',
          source: 'app',
          isActive: true,
        },
        {
          code: 'TEST_COD_2',
          description: 'Cash On Delivery',
          days: 0,
          type: 'immediate',
          source: 'app',
          isActive: true,
        },
      ])
      .returning();

    const [group] = await pg.db
      .insert(customerGroups)
      .values({
        groupCode: 'GRP-VIP',
        name: 'VIP Group',
        tradingTermsId: termGroup.tradingTermsId,
        creditLimit: '10000.00',
        isOnCreditHold: false,
        stateCode: CUSTOMER_STATE.ACTIVE,
      })
      .returning();

    const [org] = await pg.db
      .insert(organizations)
      .values({
        stateCode: ORGANIZATION_STATE.ACTIVE,
        name: 'VIP Override Corp',
        headquartersAddressLine1: '456 High St',
        headquartersCountry: 'AU',
        isTaxRegistered: false,
      })
      .returning();

    const [cust] = await pg.db
      .insert(customers)
      .values({
        organizationId: org.organizationId,
        customerNumber: 'CUST-VIP',
        customerGroupId: group.customerGroupId,
        tradingTermsId: termCust.tradingTermsId,
        creditLimit: '25000.00',
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'test',
      })
      .returning();

    const result = await customersService.findOne(cust.customerId);

    expect(result.tradingTermsId).toBe(termCust.tradingTermsId);
    expect(result.creditLimit).toBe('25000.00');
    expect(result.effectiveTradingTermsId).toBe(termCust.tradingTermsId);
    expect(result.customerGroupTradingTermsId).toBe(termGroup.tradingTermsId);
    expect(result.effectiveCreditLimit).toBe('25000.00');
    expect(result.customerGroupCreditLimit).toBe('10000.00');
  });

  it('exposes effectiveTradingTermsId in findAll list query', async () => {
    const [term] = await pg.db
      .insert(tradingTerms)
      .values({
        code: 'TEST_NET14',
        description: '14 Days Net',
        days: 14,
        type: 'days_after_invoice',
        source: 'app',
        isActive: true,
      })
      .returning();

    const [group] = await pg.db
      .insert(customerGroups)
      .values({
        groupCode: 'GRP-14D',
        name: '14 Day Group',
        tradingTermsId: term.tradingTermsId,
        creditLimit: '3000.00',
        isOnCreditHold: false,
        stateCode: CUSTOMER_STATE.ACTIVE,
      })
      .returning();

    const [org] = await pg.db
      .insert(organizations)
      .values({
        stateCode: ORGANIZATION_STATE.ACTIVE,
        name: 'Quick Pay Co',
        headquartersAddressLine1: '789 Fast Ln',
        headquartersCountry: 'AU',
        isTaxRegistered: false,
      })
      .returning();

    await pg.db.insert(customers).values({
      organizationId: org.organizationId,
      customerNumber: 'CUST-QP',
      customerGroupId: group.customerGroupId,
      tradingTermsId: null,
      creditLimit: null,
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'app',
      createdBy: 'test',
    });

    const page = await customersService.findAll();
    expect(page.data.length).toBe(1);
    const item = page.data[0];
    expect(item.effectiveTradingTermsId).toBe(term.tradingTermsId);
    expect(item.effectiveCreditLimit).toBe('3000.00');
  });

  it('sanitizes empty string UUID and numeric values to null when updating CustomerGroups', async () => {
    const group = await customerGroupsService.create({
      groupCode: 'GRP-CLEAN',
      name: 'Clean Group',
    });

    // Attempting to pass empty strings as happens when clearing form inputs
    const updated = await customerGroupsService.update(group.customerGroupId, {
      tradingTermsId: '' as unknown as undefined,
      taxPositionId: '' as unknown as undefined,
      creditLimit: '' as unknown as undefined,
      defaultArAccountId: '' as unknown as undefined,
      defaultRevenueAccountId: '' as unknown as undefined,
      defaultCostCenterId: '' as unknown as undefined,
      defaultActivityId: '' as unknown as undefined,
    });

    expect(updated.tradingTermsId).toBeNull();
    expect(updated.taxPositionId).toBeNull();
    expect(updated.creditLimit).toBeNull();
    expect(updated.defaultArAccountId).toBeNull();
    expect(updated.defaultRevenueAccountId).toBeNull();
  });

  it('sanitizes empty string UUID and numeric values to null when updating SupplierGroups', async () => {
    const group = await supplierGroupsService.create({
      groupCode: 'SUP-CLEAN',
      name: 'Clean Supplier Group',
    });

    const updated = await supplierGroupsService.update(group.supplierGroupId, {
      tradingTermsId: '' as unknown as undefined,
      taxPositionId: '' as unknown as undefined,
      creditLimit: '' as unknown as undefined,
      defaultApAccountId: '' as unknown as undefined,
      defaultExpenseAccountId: '' as unknown as undefined,
    });

    expect(updated.tradingTermsId).toBeNull();
    expect(updated.taxPositionId).toBeNull();
    expect(updated.creditLimit).toBeNull();
    expect(updated.defaultApAccountId).toBeNull();
  });

  describe('Customer Trading Terms Mutation & Storage Verification', () => {
    it('correctly stores and persists customer-level trading terms override when updated', async () => {
      const [termGroup, termCust] = await pg.db
        .insert(tradingTerms)
        .values([
          {
            code: 'MUT_NET30',
            description: '30 Days Net',
            days: 30,
            type: 'days_after_invoice',
            source: 'app',
            isActive: true,
          },
          {
            code: 'MUT_NET60',
            description: '60 Days Net',
            days: 60,
            type: 'days_after_invoice',
            source: 'app',
            isActive: true,
          },
        ])
        .returning();

      const [group] = await pg.db
        .insert(customerGroups)
        .values({
          groupCode: 'GRP-MUT',
          name: 'Mutation Test Group',
          tradingTermsId: termGroup.tradingTermsId,
          creditLimit: '1000.00',
          isOnCreditHold: false,
          stateCode: CUSTOMER_STATE.ACTIVE,
        })
        .returning();

      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Mutation Test Co',
          headquartersAddressLine1: '1 Mutation Way',
          headquartersCountry: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [cust] = await pg.db
        .insert(customers)
        .values({
          organizationId: org.organizationId,
          customerNumber: 'CUST-MUT-01',
          customerGroupId: group.customerGroupId,
          tradingTermsId: null,
          creditLimit: null,
          currencyCode: 'AUD',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'test',
        })
        .returning();

      // Initial check: inherits from group
      const initial = await customersService.findOne(cust.customerId);
      expect(initial.tradingTermsId).toBeNull();
      expect(initial.effectiveTradingTermsId).toBe(termGroup.tradingTermsId);

      // Simulate UI selecting "NET60" override
      await customersWriteService.update(
        cust.customerId,
        { tradingTermsId: termCust.tradingTermsId },
        'admin',
        'admin',
      );

      // Verify directly in DB
      const [rowInDb] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerId, cust.customerId));
      expect(rowInDb.tradingTermsId).toBe(termCust.tradingTermsId);

      // Verify findOne reflects the change
      const afterUpdate = await customersService.findOne(cust.customerId);
      expect(afterUpdate.tradingTermsId).toBe(termCust.tradingTermsId);
      expect(afterUpdate.effectiveTradingTermsId).toBe(termCust.tradingTermsId);
      expect(afterUpdate.customerGroupTradingTermsId).toBe(
        termGroup.tradingTermsId,
      );
    });

    it('clears customer-level trading terms override and reverts to group inheritance when reset in UI (null or empty string)', async () => {
      const [termGroup, termCust] = await pg.db
        .insert(tradingTerms)
        .values([
          {
            code: 'REV_NET30',
            description: '30 Days Net',
            days: 30,
            type: 'days_after_invoice',
            source: 'app',
            isActive: true,
          },
          {
            code: 'REV_COD',
            description: 'COD',
            days: 0,
            type: 'immediate',
            source: 'app',
            isActive: true,
          },
        ])
        .returning();

      const [group] = await pg.db
        .insert(customerGroups)
        .values({
          groupCode: 'GRP-REV',
          name: 'Reversion Test Group',
          tradingTermsId: termGroup.tradingTermsId,
          creditLimit: '2000.00',
          isOnCreditHold: false,
          stateCode: CUSTOMER_STATE.ACTIVE,
        })
        .returning();

      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Reversion Test Co',
          headquartersAddressLine1: '2 Revert Rd',
          headquartersCountry: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      // Customer starts with explicit override
      const [cust] = await pg.db
        .insert(customers)
        .values({
          organizationId: org.organizationId,
          customerNumber: 'CUST-REV-01',
          customerGroupId: group.customerGroupId,
          tradingTermsId: termCust.tradingTermsId,
          creditLimit: null,
          currencyCode: 'AUD',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'test',
        })
        .returning();

      // 1. Reset by sending null (as when selecting Inherit in InheritedSelect)
      await customersWriteService.update(
        cust.customerId,
        { tradingTermsId: null as unknown as string },
        'admin',
        'admin',
      );

      const [dbAfterNull] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerId, cust.customerId));
      expect(dbAfterNull.tradingTermsId).toBeNull();

      const findAfterNull = await customersService.findOne(cust.customerId);
      expect(findAfterNull.tradingTermsId).toBeNull();
      expect(findAfterNull.effectiveTradingTermsId).toBe(
        termGroup.tradingTermsId,
      );

      // Re-set override
      await customersWriteService.update(
        cust.customerId,
        { tradingTermsId: termCust.tradingTermsId },
        'admin',
        'admin',
      );

      // 2. Reset by sending empty string (as can happen in forms)
      await customersWriteService.update(
        cust.customerId,
        { tradingTermsId: '' as unknown as string },
        'admin',
        'admin',
      );

      const [dbAfterEmpty] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerId, cust.customerId));
      expect(dbAfterEmpty.tradingTermsId).toBeNull();

      const findAfterEmpty = await customersService.findOne(cust.customerId);
      expect(findAfterEmpty.tradingTermsId).toBeNull();
      expect(findAfterEmpty.effectiveTradingTermsId).toBe(
        termGroup.tradingTermsId,
      );
    });

    it('validates and transforms tradingTermsId in UpdateCustomerDto via ValidationPipe', async () => {
      const pipe = new ValidationPipe({ whitelist: true, transform: true });

      // Valid UUID
      const validDto = await pipe.transform(
        { tradingTermsId: '11111111-1111-4111-8111-111111111111' },
        { type: 'body', metatype: UpdateCustomerDto },
      );
      expect(validDto.tradingTermsId).toBe(
        '11111111-1111-4111-8111-111111111111',
      );

      // Empty string -> transformed to null
      const emptyDto = await pipe.transform(
        { tradingTermsId: '' },
        { type: 'body', metatype: UpdateCustomerDto },
      );
      expect(emptyDto.tradingTermsId).toBeNull();

      // Null -> remains null
      const nullDto = await pipe.transform(
        { tradingTermsId: null },
        { type: 'body', metatype: UpdateCustomerDto },
      );
      expect(nullDto.tradingTermsId).toBeNull();
    });
  });
});
