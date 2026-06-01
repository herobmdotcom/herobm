import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Use pglite to avoid needing a real postgres DB for this script
  process.env.USE_PGLITE = 'true';
  process.env.JWT_SECRET = 'dummy_secret_for_openapi_generation';
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  const config = new DocumentBuilder()
    .setTitle('ModBM API')
    .setDescription('Core Forgeron API System endpoints')
    .setVersion('1.0')
    .addTag('Auth', 'Authentication and Authorization')
    .addTag('GL', 'General Ledger')
    .addTag('BankFeeds', 'Bank statement feeds')
    .addTag('Enrichment', 'External data enrichment')
    .addTag('Users', 'User management')
    .addTag('Roles', 'Role management')
    .addTag('System', 'System configuration')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outDir = path.resolve(__dirname, '../../../../docs/developers');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log('Written OpenAPI spec to', outPath);
  await app.close();
}
bootstrap().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
