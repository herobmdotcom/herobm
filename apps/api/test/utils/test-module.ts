import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DRIZZLE } from '../../src/drizzle/drizzle.module';
import { AppConfigService } from '../../src/settings/app-config.service';
import { GlService } from '../../src/gl/gl.service';
import { MockDrizzle } from './mock-drizzle';

export class MockAppConfigService {
  private config = {
    inventoryAccountingMode: 'perpetual',
    valuationMethod: 'standard',
    revenueRoutingPrecedence: 'product_first',
    expenseRoutingPrecedence: 'product_first',
  };

  inventoryAccountingMode = jest
    .fn()
    .mockImplementation(() => this.config.inventoryAccountingMode);
  valuationMethod = jest
    .fn()
    .mockImplementation(() => this.config.valuationMethod);
  revenueRoutingPrecedence = jest
    .fn()
    .mockImplementation(() => this.config.revenueRoutingPrecedence);
  expenseRoutingPrecedence = jest
    .fn()
    .mockImplementation(() => this.config.expenseRoutingPrecedence);

  defaultInventoryAccountId = jest
    .fn()
    .mockImplementation(() => 'gl-inv-default');
  defaultGrniAccountId = jest.fn().mockImplementation(() => 'gl-grni-default');
  defaultCogsAccountId = jest.fn().mockImplementation(() => 'gl-cogs-default');
  defaultShrinkageAccountId = jest
    .fn()
    .mockImplementation(() => 'gl-shrink-default');
  defaultInventoryAdjustmentAccountId = jest
    .fn()
    .mockImplementation(() => 'gl-adj-default');

  setConfig(key: keyof typeof this.config, value: string) {
    this.config[key] = value;
  }
}

export class MockGlService {
  postJournalEntry = jest
    .fn()
    .mockResolvedValue({ journalEntryId: 'mock-je-id' });
  getSettings = jest.fn().mockResolvedValue({
    defaultArAccountId: 'gl-ar-default',
    defaultRevenueAccountId: 'gl-rev-default',
    defaultApAccountId: 'gl-ap-default',
    defaultExpenseAccountId: 'gl-exp-default',
  });
}

/**
 * Helper to bootstrap a TestingModuleBuilder with standardized core mocks
 * to prevent cascading DI failures.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupTestModule(providers: any[] = []): TestingModuleBuilder {
  return Test.createTestingModule({
    providers: [
      { provide: DRIZZLE, useClass: MockDrizzle },
      { provide: AppConfigService, useClass: MockAppConfigService },
      { provide: GlService, useClass: MockGlService },
      ...providers,
    ],
  });
}
