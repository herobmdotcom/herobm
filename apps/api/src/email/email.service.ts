import { Injectable, Logger } from '@nestjs/common';
import { emailOutbox, outbox, systemEvents } from '../drizzle/schema';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { EntityType, EventType, EntityTypeValue } from '../common/event-types';
import { emitEvent } from '../common/emit-event';

export interface QueueEmailParams {
  entityType?: EntityTypeValue;
  entityId?: string;
  toAddress: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  attachments?: { filename: string; contentType: string; content?: string }[];
  actor?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Securely queues an email to be sent asynchronously by the outbox worker.
   * This must be called within an existing Drizzle transaction to ensure exactly-once delivery semantics.
   */
  async queueEmail(tx: DrizzleDB, params: QueueEmailParams): Promise<void> {
    this.logger.debug(
      `Queueing email to ${params.toAddress} (subject: ${params.subject})`,
    );

    const [insertedEmail] = await tx
      .insert(emailOutbox)
      .values({
        entityType: params.entityType,
        entityId: params.entityId,
        toAddress: params.toAddress,
        replyTo: params.replyTo,
        subject: params.subject,
        htmlBody: params.htmlBody,
        attachments: params.attachments || [],
        status: 'pending',
        retries: 0,
      })
      .returning({ id: emailOutbox.id });

    const payload = {
      emailId: insertedEmail.id,
      toAddress: params.toAddress,
      subject: params.subject,
    };

    // 1. Always log an event specifically for the EMAIL entity
    await emitEvent(tx, {
      entityType: EntityType.EMAIL,
      entityId: insertedEmail.id,
      eventType: EventType.QUEUED,
      entityDisplayName: `Email to ${params.toAddress}`,
      payload: payload,
      actor: params.actor,
    });
  }
}
