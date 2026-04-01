import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GlService } from '../src/gl/gl.service';

/**
 * REPRODUCTION SCRIPT
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const glService = app.get(GlService);

  const entryId = '312ce7ac-1568-456b-9e08-8bfe325f43fc';
  console.log(`Testing getJournalEntry for: ${entryId}`);

  try {
    const result = await glService.getJournalEntry(entryId);
    console.log('SUCCESS!');
    console.log(`Header: ${JSON.stringify(result, (k, v) => k === 'lines' ? undefined : v, 2)}`);
    console.log(`Lines Count: ${result.lines.length}`);
    if (result.lines.length > 0) {
      console.log(`First Line Party Details: Type=${result.lines[0].partyType}, ID=${result.lines[0].partyId}, Name=${result.lines[0].partyName}`);
    }
  } catch (err) {
    console.error('FAILED!');
    console.error(err);
  } finally {
    await app.close();
  }
}

run();
