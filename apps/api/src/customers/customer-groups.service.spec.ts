import { customerGroups, masterDataEvents } from '@herobm/db-schema';
import { CUSTOMER_STATE } from '@herobm/shared';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { CustomerGroupsService } from './customer-groups.service';
import { CreateCustomerGroupDto, UpdateCustomerGroupDto } from './dto';

describe('CustomerGroupsService', () => {
  const pg = setupPgliteSuite();
  let service: CustomerGroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerGroupsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<CustomerGroupsService>(CustomerGroupsService);

    await pg.db.delete(masterDataEvents);
    await pg.db.delete(customerGroups);
  });

  it('creates a customer group with default stateCode active when not specified', async () => {
    const group = await service.create({
      groupCode: 'GRP-DEF-01',
      name: 'Default Group',
    });

    expect(group.customerGroupId).toBeDefined();
    expect(group.groupCode).toBe('GRP-DEF-01');
    expect(group.stateCode).toBe(CUSTOMER_STATE.ACTIVE);
  });

  it('creates a customer group with explicit stateCode inactive', async () => {
    const group = await service.create({
      groupCode: 'GRP-INACT-01',
      name: 'Inactive Group',
      stateCode: CUSTOMER_STATE.INACTIVE,
    });

    expect(group.customerGroupId).toBeDefined();
    expect(group.stateCode).toBe(CUSTOMER_STATE.INACTIVE);
  });

  it('updates customer group stateCode from active to inactive and back to active', async () => {
    const group = await service.create({
      groupCode: 'GRP-TOGGLE-01',
      name: 'Toggle Group',
    });
    expect(group.stateCode).toBe(CUSTOMER_STATE.ACTIVE);

    const updatedInactive = await service.update(group.customerGroupId, {
      stateCode: CUSTOMER_STATE.INACTIVE,
    });
    expect(updatedInactive.stateCode).toBe(CUSTOMER_STATE.INACTIVE);

    const fetchedInactive = await service.findOne(group.customerGroupId);
    expect(fetchedInactive.stateCode).toBe(CUSTOMER_STATE.INACTIVE);

    const updatedActive = await service.update(group.customerGroupId, {
      stateCode: CUSTOMER_STATE.ACTIVE,
    });
    expect(updatedActive.stateCode).toBe(CUSTOMER_STATE.ACTIVE);

    const fetchedActive = await service.findOne(group.customerGroupId);
    expect(fetchedActive.stateCode).toBe(CUSTOMER_STATE.ACTIVE);
  });

  it('preserves stateCode across ValidationPipe whitelist transform', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const rawDto = {
      name: 'Whitelisted Name',
      stateCode: CUSTOMER_STATE.INACTIVE,
      unknownField: 'should be stripped',
    };

    const transformed = await pipe.transform(rawDto, {
      type: 'body',
      metatype: UpdateCustomerGroupDto,
    });

    expect(transformed.name).toBe('Whitelisted Name');
    expect(transformed.stateCode).toBe(CUSTOMER_STATE.INACTIVE);
    expect(
      (transformed as Record<string, unknown>).unknownField,
    ).toBeUndefined();
  });

  it('preserves isOnCreditHold across ValidationPipe whitelist transform', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const rawDto = {
      name: 'Credit Hold Group',
      isOnCreditHold: true,
      unknownField: 'should be stripped',
    };

    const transformed = await pipe.transform(rawDto, {
      type: 'body',
      metatype: UpdateCustomerGroupDto,
    });

    expect(transformed.name).toBe('Credit Hold Group');
    expect(transformed.isOnCreditHold).toBe(true);
    expect(
      (transformed as Record<string, unknown>).unknownField,
    ).toBeUndefined();
  });

  it('updates customer group isOnCreditHold and persists to database', async () => {
    const group = await service.create({
      groupCode: 'GRP-HOLD-01',
      name: 'Hold Test Group',
    });
    expect(group.isOnCreditHold).toBe(false);

    const updatedHold = await service.update(group.customerGroupId, {
      isOnCreditHold: true,
    });
    expect(updatedHold.isOnCreditHold).toBe(true);

    const fetchedHold = await service.findOne(group.customerGroupId);
    expect(fetchedHold.isOnCreditHold).toBe(true);

    const updatedUnhold = await service.update(group.customerGroupId, {
      isOnCreditHold: false,
    });
    expect(updatedUnhold.isOnCreditHold).toBe(false);

    const fetchedUnhold = await service.findOne(group.customerGroupId);
    expect(fetchedUnhold.isOnCreditHold).toBe(false);
  });

  it('creates customer group when dto has explicit undefined isOnCreditHold (ADV-225)', async () => {
    // Exactly replicates the failure mode: DTO instance containing undefined isOnCreditHold
    const dtoInstance = plainToInstance(CreateCustomerGroupDto, {
      groupCode: '4',
      name: 'Trade',
      isOnCreditHold: undefined,
    });

    const group = await service.create(dtoInstance);
    expect(group.customerGroupId).toBeDefined();
    expect(group.groupCode).toBe('4');
    expect(group.name).toBe('Trade');
    expect(group.isOnCreditHold).toBe(false);

    // Verify database row directly
    const fetched = await service.findOne(group.customerGroupId);
    expect(fetched.isOnCreditHold).toBe(false);
  });
});
