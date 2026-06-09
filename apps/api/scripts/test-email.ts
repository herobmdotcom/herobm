import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);
  
  await emailService.queueEmail({
    toAddress: 'test@example.com',
    subject: 'Integration Test Email',
    htmlBody: '<p>This is a test of the email outbox relay system.</p>',
    retries: 0,
  });

  console.log('Test email queued successfully.');
  await app.close();
}

bootstrap().catch(console.error);
