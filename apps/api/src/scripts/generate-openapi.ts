import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../app.module');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const fs = require('fs');

async function generateDocs() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('ModBM API')
    .setDescription('Core API System endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = path.resolve(
    __dirname,
    '../../../../apps/ops-portal/public/openapi.json',
  );
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
  await app.close();
  console.log('Successfully generated openapi.json at', outPath);
  process.exit(0);
}

generateDocs().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
