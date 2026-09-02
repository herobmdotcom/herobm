import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { emailOutbox } from '@herobm/db-schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { SystemResource } from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { EventType, EntityType } from '../common/event-types';
import { AppConfigService } from '../settings/app-config.service';
import { EncryptionService } from '../common/encryption.service';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@ApiTags('System')
@ApiBearerAuth()
@Controller('emails')
@CasbinResource(SystemResource.SETTINGS)
export class EmailController {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private appConfigService: AppConfigService,
    private encryptionService: EncryptionService,
  ) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List emails',
    description: 'List emails in the outbox queue.',
  })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({
    description: 'List of emails',
    schema: { type: 'array', items: { type: 'object' } },
  })
  async listEmails(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('status') status?: string,
  ) {
    const conditions = [];
    if (entityType) conditions.push(eq(emailOutbox.entityType, entityType));
    if (entityId) conditions.push(eq(emailOutbox.entityId, entityId));
    if (status) {
      conditions.push(
        eq(
          emailOutbox.status,
          status as unknown as
            | 'pending'
            | 'sending'
            | 'sent'
            | 'failed'
            | 'dismissed',
        ),
      );
    }

    return this.db
      .select({
        id: emailOutbox.id,
        entityType: emailOutbox.entityType,
        entityId: emailOutbox.entityId,
        toAddress: emailOutbox.toAddress,
        subject: emailOutbox.subject,
        status: emailOutbox.status,
        retries: emailOutbox.retries,
        lastError: emailOutbox.lastError,
        nextRetryAt: emailOutbox.nextRetryAt,
        createdAt: emailOutbox.createdAt,
        processedAt: emailOutbox.processedAt,
        attachments: emailOutbox.attachments,
      })
      .from(emailOutbox)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(100);
  }

  @Post(':id/retry')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Retry a failed email',
    description: 'Retry sending a failed email.',
  })
  @ApiBody({ schema: { type: 'object', properties: {} }, required: false })
  @ApiCreatedResponse({
    description: 'Email updated',
    schema: { type: 'object', properties: {} },
  })
  async retryEmail(@Param('id') id: string) {
    const [updated] = await this.db
      .update(emailOutbox)
      .set({
        status: 'pending',
        retries: 0,
        lastError: null,
        nextRetryAt: null,
      })
      .where(
        and(
          eq(emailOutbox.id, id),
          or(
            eq(emailOutbox.status, 'failed'),
            eq(emailOutbox.status, 'pending'),
          ),
        ),
      )
      .returning();

    if (!updated) {
      throw new BadRequestException(
        'Email not found or not in a retryable state',
      );
    }

    return updated;
  }

  @Post(':id/dismiss')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Dismiss a failed email',
    description: 'Dismiss a failed email so it is no longer shown as an error.',
  })
  @ApiBody({ schema: { type: 'object', properties: {} }, required: false })
  @ApiCreatedResponse({
    description: 'Email dismissed',
    schema: { type: 'object', properties: {} },
  })
  async dismissEmail(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const updated = await this.db.transaction(async (tx) => {
      const [updatedEmail] = await tx
        .update(emailOutbox)
        .set({ status: 'dismissed' })
        .where(
          and(
            eq(emailOutbox.id, id),
            or(
              eq(emailOutbox.status, 'failed'),
              eq(emailOutbox.status, 'pending'),
            ),
          ),
        )
        .returning();

      if (!updatedEmail) {
        throw new BadRequestException(
          'Email not found or not in a dismissible state',
        );
      }

      const payload = {
        emailId: updatedEmail.id,
        toAddress: updatedEmail.toAddress,
        subject: updatedEmail.subject,
      };

      // 1. Log to EMAIL generic entity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required because Drizzle transactions have complex inferred types
      await emitEvent(tx as any, {
        entityType: EntityType.EMAIL,
        entityId: updatedEmail.id,
        eventType: EventType.DISMISSED,
        entityDisplayName: `Email to ${updatedEmail.toAddress}`,
        payload,
        actor: user.userId,
      });

      // 2. Log to business entity if present
      if (updatedEmail.entityType && updatedEmail.entityId) {
        // @sync-ignore - Dynamic dispatch is intentional for emails mapped to other entities
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required because Drizzle transactions have complex inferred types
        await emitEvent(tx as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB entity type enum mappings are complex
          entityType: updatedEmail.entityType as any,
          entityId: updatedEmail.entityId,
          eventType: `email.${EventType.DISMISSED}`,
          entityDisplayName: `Email to ${updatedEmail.toAddress}`,
          payload,
          actor: user.userId,
        });
      }

      return updatedEmail;
    });

    return updated;
  }

  @Get('test-connection')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'test-connection',
    description: 'Test SMTP connection',
  })
  @ApiOkResponse({ schema: { type: 'object', properties: {} } })
  async testConnection() {
    const settings = this.appConfigService.getAppSettingsRaw();
    if (!settings || !settings.smtpHost) {
      throw new BadRequestException('SMTP configuration is missing.');
    }

    let smtpPass = '';
    if (settings.smtpPassEncrypted) {
      smtpPass = this.encryptionService.decrypt(settings.smtpPassEncrypted);
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: Number(settings.smtpPort) || 587,
      secure: Number(settings.smtpPort) === 465,
      auth: {
        user: settings.smtpUser,
        pass: smtpPass,
      },
    } as SMTPTransport.Options);

    try {
      await transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`SMTP connection failed: ${message}`);
    }
  }
}
