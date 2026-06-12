import { Injectable, Logger } from '@nestjs/common';
import {
  emailOutbox,
  outbox,
  systemEvents,
} from '../drizzle/modbm-core-schema';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { EntityType, EventType } from '../common/event-types';
import { emitEvent } from '../common/emit-event';

export interface QueueEmailParams {
  entityType?: string;
  entityId?: string;
  toAddress: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  attachments?: { filename: string; contentType: string; content?: string }[];
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
    });

    // 2. Optional event logging if linked to an entity
    if (params.entityType && params.entityId) {
      // @sync-ignore
      await emitEvent(tx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entityType: params.entityType as any,
        entityId: params.entityId,
        eventType: `email.${EventType.QUEUED}`,
        entityDisplayName: `Email to ${params.toAddress}`,
        payload: payload,
      });
    }
  }
}
