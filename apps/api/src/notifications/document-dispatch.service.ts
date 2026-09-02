import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { PdfTemplatesService } from '../pdf-templates/pdf-templates.service';
import { EmailService } from '../email/email.service';
import { AppConfigService } from '../settings/app-config.service';
import type { JwtUser } from '../auth/auth-user.decorator';
import { EntityTypeValue } from '../common/event-types';

export interface DispatchDocumentDto {
  /** ID to pass to the hook (e.g. SalesOrderId) */
  targetId: string;
  /** The hook to run (e.g. sales-order-quote) */
  hookSlug: string;
  /** The context for the hook (e.g. sales_order) */
  contextSlug: string;
  /** The entity type for the email log (e.g. sales_order) */
  entityType: string;
  /** The entity ID for the email log (e.g. SalesOrderId) */
  entityId: string;
  emailAddress: string;
  subject: string;
  body: string;
  customPdfText?: string;
  fallbackFileName?: string;
}

@Injectable()
export class DocumentDispatchService {
  private readonly logger = new Logger(DocumentDispatchService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly pdfTemplatesService: PdfTemplatesService,
    private readonly emailService: EmailService,
    private readonly appConfigService: AppConfigService,
  ) {}

  async emailDocument(dto: DispatchDocumentDto, user: JwtUser) {
    if (!this.appConfigService.isSmtpConfigured()) {
      throw new BadRequestException(
        'SMTP settings are not configured. Please configure SMTP settings in Admin Settings before sending emails.',
      );
    }

    // 1. Generate PDF using the standard hook
    const { pdfBuffer, fileName } = await this.pdfTemplatesService.runHook(
      dto.hookSlug,
      dto.targetId,
      dto.contextSlug,
      user,
      { customPdfText: dto.customPdfText },
    );

    const base64Pdf = pdfBuffer.toString('base64');

    // 2. Queue email
    await this.db.transaction(async (tx) => {
      await this.emailService.queueEmail(tx, {
        entityType: dto.entityType as EntityTypeValue,
        entityId: dto.entityId,
        toAddress: dto.emailAddress,
        subject: dto.subject,
        htmlBody: dto.body?.replace(/\n/g, '<br />') || '', // The macro text goes here, convert newlines to HTML
        attachments: [
          {
            filename: fileName || dto.fallbackFileName || `Document.pdf`,
            contentType: 'application/pdf',
            content: base64Pdf,
          },
        ],
        actor: user.username,
      });
    });

    return { success: true };
  }
}
