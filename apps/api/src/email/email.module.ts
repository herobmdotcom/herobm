import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { SettingsModule } from '../settings/settings.module';
import { EncryptionService } from '../common/encryption.service';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [EmailController],
  providers: [EmailService, EncryptionService],
  exports: [EmailService],
})
export class EmailModule {}
