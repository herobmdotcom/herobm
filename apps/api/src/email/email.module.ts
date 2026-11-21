import { Global, Module } from '@nestjs/common';
import { EncryptionService } from '../common/encryption.service';
import { SettingsModule } from '../settings/settings.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [EmailController],
  providers: [EmailService, EncryptionService],
  exports: [EmailService],
})
export class EmailModule {}
