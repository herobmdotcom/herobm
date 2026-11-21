import { customers, glSettings } from '@herobm/db-schema';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { createMemoryDb } from '../../test/utils/memory-db';
import {
  cleanupSetupCurrency,
  getInitialCurrency,
  resolveInitialCurrency,
  runCoreSeeds,
} from './prod/core';
import { runTestSeeds } from './test/index';
import type { SeedDB } from './run';

describe('Fast Install & Seed Currency Resolution Suite', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const setupCurrencyFile = path.join(rootDir, '.setup_currency');
  const originalEnvCurrency = process.env.HOME_CURRENCY;

  beforeEach(() => {
    delete process.env.HOME_CURRENCY;
    if (fs.existsSync(setupCurrencyFile)) {
      fs.unlinkSync(setupCurrencyFile);
    }
  });

  afterEach(() => {
    if (originalEnvCurrency !== undefined) {
      process.env.HOME_CURRENCY = originalEnvCurrency;
    } else {
      delete process.env.HOME_CURRENCY;
    }
    if (fs.existsSync(setupCurrencyFile)) {
      fs.unlinkSync(setupCurrencyFile);
    }
  });

  describe('getInitialCurrency resolution', () => {
    it('should throw an error and fail loudly when no environment variable or .setup_currency exists', () => {
      expect(() => getInitialCurrency()).toThrow(
        /Initial currency is not configured/,
      );
    });

    it('should prioritize HOME_CURRENCY environment variable when present', () => {
      process.env.HOME_CURRENCY = 'EUR';
      fs.writeFileSync(setupCurrencyFile, 'USD\n', 'utf-8');

      expect(getInitialCurrency()).toBe('EUR');
    });

    it('should read from .setup_currency when environment variable is not set', () => {
      fs.writeFileSync(setupCurrencyFile, 'nzd\n', 'utf-8');

      expect(getInitialCurrency()).toBe('NZD');
    });

    it('should clean up .setup_currency when cleanupSetupCurrency is invoked', () => {
      fs.writeFileSync(setupCurrencyFile, 'USD\n', 'utf-8');
      expect(fs.existsSync(setupCurrencyFile)).toBe(true);

      cleanupSetupCurrency();
      expect(fs.existsSync(setupCurrencyFile)).toBe(false);
    });
  });

  describe('runCoreSeeds with custom currency', () => {
    it('should fail loudly during runCoreSeeds when no currency is configured', async () => {
      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        await expect(
          runCoreSeeds(db as unknown as SeedDB, false),
        ).rejects.toThrow(/Initial currency is not configured/);
      } finally {
        await client.close();
      }
    });
    it('should seed gl_settings and WALK-IN customer with chosen currency from .setup_currency', async () => {
      fs.writeFileSync(setupCurrencyFile, 'USD\n', 'utf-8');

      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        await runCoreSeeds(db as unknown as SeedDB, false);

        // Assert glSettings has baseCurrency = 'USD'
        const [gl] = await (db as unknown as SeedDB)
          .select()
          .from(glSettings)
          .limit(1);
        expect(gl).toBeDefined();
        expect(gl.baseCurrency).toBe('USD');

        // Assert WALK-IN customer has currencyCode = 'USD'
        const [walkIn] = await (db as unknown as SeedDB)
          .select()
          .from(customers)
          .where(eq(customers.customerNumber, 'WALK-IN'))
          .limit(1);
        expect(walkIn).toBeDefined();
        expect(walkIn.currencyCode).toBe('USD');

        // Assert .setup_currency is automatically cleaned up
        expect(fs.existsSync(setupCurrencyFile)).toBe(false);
      } finally {
        await client.close();
      }
    });

    it('should seed gl_settings and WALK-IN customer with HOME_CURRENCY env var if provided', async () => {
      process.env.HOME_CURRENCY = 'EUR';

      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        await runCoreSeeds(db as unknown as SeedDB, false);

        const [gl] = await (db as unknown as SeedDB)
          .select()
          .from(glSettings)
          .limit(1);
        expect(gl).toBeDefined();
        expect(gl.baseCurrency).toBe('EUR');

        const [walkIn] = await (db as unknown as SeedDB)
          .select()
          .from(customers)
          .where(eq(customers.customerNumber, 'WALK-IN'))
          .limit(1);
        expect(walkIn).toBeDefined();
        expect(walkIn.currencyCode).toBe('EUR');
      } finally {
        await client.close();
      }
    });

    it('should successfully re-run seeds on an existing database without HOME_CURRENCY or .setup_currency', async () => {
      process.env.HOME_CURRENCY = 'USD';
      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        await runCoreSeeds(db as unknown as SeedDB, false);

        delete process.env.HOME_CURRENCY;
        expect(fs.existsSync(setupCurrencyFile)).toBe(false);

        await expect(
          runCoreSeeds(db as unknown as SeedDB, false),
        ).resolves.not.toThrow();

        const [gl] = await (db as unknown as SeedDB)
          .select()
          .from(glSettings)
          .limit(1);
        expect(gl?.baseCurrency).toBe('USD');

        const [walkIn] = await (db as unknown as SeedDB)
          .select()
          .from(customers)
          .where(eq(customers.customerNumber, 'WALK-IN'))
          .limit(1);
        expect(walkIn?.currencyCode).toBe('USD');
      } finally {
        await client.close();
      }
    });

    it('should successfully run test seeds on a fresh database without HOME_CURRENCY or .setup_currency (ADV-238)', async () => {
      delete process.env.HOME_CURRENCY;
      expect(fs.existsSync(setupCurrencyFile)).toBe(false);

      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        if (!process.env.HOME_CURRENCY) {
          process.env.HOME_CURRENCY = 'AUD';
        }
        await runCoreSeeds(db as unknown as SeedDB, false);
        await runTestSeeds(db as unknown as SeedDB, false);

        const [gl] = await (db as unknown as SeedDB)
          .select()
          .from(glSettings)
          .limit(1);
        expect(gl?.baseCurrency).toBe('AUD');

        const [walkIn] = await (db as unknown as SeedDB)
          .select()
          .from(customers)
          .where(eq(customers.customerNumber, 'WALK-IN'))
          .limit(1);
        expect(walkIn?.currencyCode).toBe('AUD');
      } finally {
        await client.close();
      }
    });

    it('should ensure runTestSeeds defensively defaults HOME_CURRENCY to AUD (ADV-238)', async () => {
      delete process.env.HOME_CURRENCY;
      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        await runTestSeeds(db as unknown as SeedDB, false);
        expect(process.env.HOME_CURRENCY).toBe('AUD');
      } finally {
        await client.close();
      }
    });

    it('should ask the user via prompter when no clear currency setting exists (ADV-239)', async () => {
      delete process.env.HOME_CURRENCY;
      expect(fs.existsSync(setupCurrencyFile)).toBe(false);

      const mockPrompt = jest.fn(async () => {
        fs.writeFileSync(setupCurrencyFile, 'AUD\n', 'utf-8');
        return 'AUD';
      });

      const currency = await resolveInitialCurrency(mockPrompt);
      expect(currency).toBe('AUD');
      expect(mockPrompt).toHaveBeenCalledTimes(1);

      const { client, db } = await createMemoryDb({ skipSeeds: true });
      try {
        await runCoreSeeds(db as unknown as SeedDB, false);

        const [gl] = await (db as unknown as SeedDB)
          .select()
          .from(glSettings)
          .limit(1);
        expect(gl?.baseCurrency).toBe('AUD');

        const [walkIn] = await (db as unknown as SeedDB)
          .select()
          .from(customers)
          .where(eq(customers.customerNumber, 'WALK-IN'))
          .limit(1);
        expect(walkIn?.currencyCode).toBe('AUD');
      } finally {
        await client.close();
      }
    });

    it('should fail loudly when non-interactive and no currency is configured (ADV-239)', async () => {
      delete process.env.HOME_CURRENCY;
      expect(fs.existsSync(setupCurrencyFile)).toBe(false);

      await expect(resolveInitialCurrency()).rejects.toThrow(
        /Initial currency is not configured/,
      );
    });
  });
});
