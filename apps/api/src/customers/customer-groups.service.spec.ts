import { Test, TestingModule } from '@nestjs/testing';
import { CustomerGroupsService } from './customer-groups.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { customerGroups, masterDataEvents } from '@herobm/db-schema';
import { CUSTOMER_STATE } from '@herobm/shared';
import { ValidationPipe } from '@nestjs/common';
import { UpdateCustomerGroupDto, CreateCustomerGroupDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

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
});
