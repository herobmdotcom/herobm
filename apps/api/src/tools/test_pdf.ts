import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { PdfTemplatesService } from '../pdf-templates/pdf-templates.service';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.join(__dirname, '../../../../' + (process.env.ENV_FILE || '.env')),
});

async function run() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const pdfTemplatesService = app.get(PdfTemplatesService);

  // order id from the outbox query
  const orderId = 'f3a7303a-2a49-4486-9968-e871579d06fe';
  const user = {
    userId: '1',
    organizationId: '1',
    email: 'test@example.com',
  } as Record<string, unknown>;

  try {
    const { pdfBuffer, fileName } = await pdfTemplatesService.runHook(
      'sales-order-quote',
      orderId,
      DATA_SOURCE_CONTEXT.SALES_ORDER,
      user,
      { quoteIntroText: 'Test' },
    );

    console.log('PDF Length:', pdfBuffer.length);
    console.log('File Name:', fileName);
    fs.writeFileSync('../../tmp/test_quote.pdf', pdfBuffer);
  } catch (e) {
    console.error(e);
  }

  await app.close();
}

run();
