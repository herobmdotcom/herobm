import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SetupService } from '../setup/setup.service';
import { ExecuteSetupDto } from '../setup/setup.dto';
import { Logger } from '@nestjs/common';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Interactive CLI Setup for HeroBM.
 * Uses built-in readline to gather settings without new dependencies.
 */
async function bootstrap() {
  const logger = new Logger('SetupCLI');
  const rl = readline.createInterface({ input, output });

  console.log('\n=================================');
  console.log('   HeroBM Platform CLI Setup');
  console.log('=================================\n');

  try {
    // 1. Gather Inputs
    const companyName =
      (await rl.question('Company Name [My Company]: ')) || 'My Company';

    console.log('\n--- Regional Settings ---');
    console.log(
      `Base Currency: ${process.env.NEXT_PUBLIC_HOME_CURRENCY || 'AUD'} (from Environment)`,
    );
    const fiscalMonth =
      (await rl.question('Fiscal Year Start Month (1-12) [7]: ')) || '7';

    // COA Presets (Manual list to avoid complex FS scanning in this script)
    console.log('\nChart of Accounts Presets:');
    console.log('  1. au_standard.json (Australia)');
    console.log('  2. generic.json     (Global)');
    const coaChoice = (await rl.question('Choose COA [1]: ')) || '1';
    const coaPreset = coaChoice === '2' ? 'generic.json' : 'au_standard.json';

    console.log('\n--- Operational Logic ---');
    console.log('Inventory Valuation:');
    console.log('  1. weighted_average');
    console.log('  2. fifo');
    console.log('  3. standard');
    const valChoice = (await rl.question('Choose method [1]: ')) || '1';
    let valuation = 'weighted_average';
    if (valChoice === '2') valuation = 'fifo';
    if (valChoice === '3') valuation = 'standard';

    console.log('\nInventory Accounting Mode:');
    console.log('  1. periodic (Current ModBM Approach)');
    console.log('  2. perpetual (ERP Standard with GL Postings)');
    const modeChoice = (await rl.question('Choose mode [1]: ')) || '1';
    const accountingMode = modeChoice === '2' ? 'perpetual' : 'periodic';

    console.log('\nNon-Stock Billing:');
    console.log('  1. per_shipment (Invoice as you ship)');
    console.log('  2. final_invoice (One invoice at the end)');
    const billChoice = (await rl.question('Choose mode [1]: ')) || '1';
    const billing = billChoice === '2' ? 'final_invoice' : 'per_shipment';

    const abmImport =
      (
        await rl.question('\nImport legacy data from ABM? (y/N): ')
      ).toLowerCase() === 'y';

    rl.close();

    // 2. Bootstrap NestJS
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    const setupService = app.get(SetupService);

    const dto: ExecuteSetupDto = {
      coaPreset,
      baseCurrency: process.env.HOME_CURRENCY || 'EUR',
      fiscalYearStartMonth: Number(fiscalMonth),
      inventoryValuationMethod: valuation,
      inventoryAccountingMode: accountingMode,
      nonStockBillingMode: billing,
      revenueRoutingPrecedence: 'product_first',
      expenseRoutingPrecedence: 'product_first',
      companyName,
      defaultLocationCode: 'HQ',
      defaultLocationName: 'Main Headquarters',
      abmImport,
    };

    logger.log(`Starting unified setup execution...`);

    await setupService.initializeSystem(dto);

    if (dto.abmImport) {
      logger.log(`Starting ABM Import sequence...`);
      await setupService.runEltCore(dto);
    }

    logger.log('✅ CLI Setup completed successfully.');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ CLI Setup failed:', error);
    process.exit(1);
  }
}

bootstrap().catch(console.error);
