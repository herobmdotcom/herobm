import { Module, Global } from '@nestjs/common';
import { DocumentDispatchService } from './document-dispatch.service';
import { PdfTemplatesModule } from '../pdf-templates/pdf-templates.module';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [PdfTemplatesModule, EmailModule],
  providers: [DocumentDispatchService],
  exports: [DocumentDispatchService],
})
export class NotificationsModule {}
