import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Inject,
  UseGuards,
  NotFoundException,
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
import { emailOutbox } from '../drizzle/herobm-core-schema';
import { eq, and, desc } from 'drizzle-orm';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { SystemResource } from '@herobm/shared';

@ApiTags('System')
@ApiBearerAuth()
@Controller('emails')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
export class EmailController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

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
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'failed')))
      .returning();

    if (!updated) {
      throw new BadRequestException('Email not found or not in failed state');
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
  async dismissEmail(@Param('id') id: string) {
    const [updated] = await this.db
      .update(emailOutbox)
      .set({ status: 'dismissed' })
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'failed')))
      .returning();

    if (!updated) {
      throw new BadRequestException('Email not found or not in failed state');
    }

    return updated;
  }
}
