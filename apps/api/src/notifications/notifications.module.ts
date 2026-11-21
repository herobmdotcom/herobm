import { Global, Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PdfTemplatesModule } from '../pdf-templates/pdf-templates.module';
import { DocumentDispatchService } from './document-dispatch.service';

@Global()
@Module({
  imports: [PdfTemplatesModule, EmailModule],
  providers: [DocumentDispatchService],
  exports: [DocumentDispatchService],
})
export class NotificationsModule {}
