import { eq, sql, isNull, lte, and, or } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';
import { emailOutbox, appSettings, outbox, systemEvents } from '@herobm/db-schema';
import { relayLogger as logger } from './logger';
import { deriveEncryptionKey, decrypt } from '@herobm/shared/node';

export async function pollEmailOutbox(db: any) {
  try {
    // Check if there are any pending emails
    const pendingEmails = await db
      .select()
      .from(emailOutbox)
      .where(
        and(
          eq(emailOutbox.status, 'pending'),
          or(
            isNull(emailOutbox.nextRetryAt),
            lte(emailOutbox.nextRetryAt, new Date())
          )
        )
      )
      .limit(50); // Process in batches of 50

    if (pendingEmails.length === 0) {
      return;
    }

    logger.debug(`Found ${pendingEmails.length} pending emails to process.`);

    // Fetch SMTP settings
    const settingsRows = await db.select().from(appSettings).limit(1);
    if (!settingsRows.length || !settingsRows[0].smtpHost) {
      logger.warn('SMTP settings are not fully configured in app_settings. Skipping email processing.');
      return;
    }
    const settings = settingsRows[0];

    // Decrypt the SMTP password
    // Need to use the same logic as EncryptionService in API
    let smtpPass = '';
    if (settings.smtpPassEncrypted) {
      let rawKey = process.env.ENCRYPTION_KEY;
      if (!rawKey) {
        logger.warn('ENCRYPTION_KEY is not set. Falling back to JWT_SECRET for development.');
        rawKey = process.env.JWT_SECRET;
      }
      if (!rawKey) {
        throw new Error('No encryption key configured');
      }

      // Decrypt logic using shared encryption primitives
      try {
        const encryptionKey = deriveEncryptionKey(rawKey);
        smtpPass = decrypt(settings.smtpPassEncrypted, encryptionKey);
      } catch (err) {
        logger.error({ err }, 'Failed to decrypt SMTP password. Check ENCRYPTION_KEY.');
        return;
      }
    }

    // Configure Nodemailer Transport
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: Number(settings.smtpPort) || 587,
      secure: Number(settings.smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: settings.smtpUser,
        pass: smtpPass,
      },
    });

    // Pre-flight check
    try {
      await transporter.verify();
      logger.debug('SMTP Server connection verified successfully.');
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to connect to SMTP server. Marking batch as failed.');
      for (const email of pendingEmails) {
        const retries = Number(email.retries || 0) + 1;
        const status = retries >= 5 ? 'failed' : 'pending';
        const nextRetryAt = new Date(Date.now() + Math.pow(2, retries - 1) * 60000);
        await db
          .update(emailOutbox)
          .set({
            retries: retries.toString(),
            status,
            lastError: 'SMTP Connection Failed: ' + err.message,
            nextRetryAt,
          })
          .where(eq(emailOutbox.id, email.id));
      }
      return;
    }

    const { 
      systemEvents, salesEvents, procurementEvents, masterDataEvents, 
      warehouseEvents, financialEvents, inventoryEvents, userEvents, 
      reconciliationEvents, groupEvents, emailEvents: dbEmailEvents, 
      businessReportEvents, integrationEvents 
    } = require('@herobm/db-schema');

    const getEventTable = (eType: string) => {
      if (['sales_order', 'sales_invoice', 'sales_return'].includes(eType)) return salesEvents;
      if (['purchase_order', 'purchase_invoice', 'purchase_return'].includes(eType)) return procurementEvents;
      if (['product', 'customer', 'supplier', 'product_supplier'].includes(eType)) return masterDataEvents;
      if (['shipment', 'transfer_order', 'warehouse', 'location', 'zone', 'bin'].includes(eType)) return warehouseEvents;
      if (['payment', 'csv_mapping_profile', 'tax_category', 'tax_position', 'tax_position_mapping', 'exchange_rate', 'cost_center', 'activity', 'gl_account'].includes(eType)) return financialEvents;
      if (['inventory_ledger'].includes(eType)) return inventoryEvents;
      if (['user'].includes(eType)) return userEvents;
      if (['reconciliation_rule', 'bank_statement_line', 'gl_match_group', 'gl_reconciliation'].includes(eType)) return reconciliationEvents;
      if (['product_group', 'customer_group', 'supplier_group'].includes(eType)) return groupEvents;
      if (['email'].includes(eType)) return dbEmailEvents;
      if (['business_report'].includes(eType)) return businessReportEvents;
      if (['integration'].includes(eType)) return integrationEvents;
      return systemEvents;
    };

    const emailEventsTable = getEventTable('email');

    for (const email of pendingEmails) {
      const [queuedEvent] = await db
        .select({ actor: emailEventsTable.actor })
        .from(emailEventsTable)
        .where(and(eq(emailEventsTable.entityId, email.id), eq(emailEventsTable.eventType, 'queued')))
        .limit(1);
      const actor = queuedEvent?.actor || null;
      try {
        logger.info(`Sending email ${email.id} to ${email.toAddress}`);

        const mailOptions: nodemailer.SendMailOptions = {
          from: settings.smtpFromAddress || 'noreply@herobm.com',
          to: email.toAddress,
          replyTo: email.replyTo || undefined,
          subject: email.subject,
          html: email.htmlBody,
          attachments: (email.attachments || []).map((att: any) => ({
            filename: att.filename,
            contentType: att.contentType,
            content: att.content ? Buffer.from(att.content, 'base64') : undefined,
          })),
        };

        await transporter.sendMail(mailOptions);

        // Strip payload from attachments array to keep only metadata
        const metadataAttachments = (email.attachments || []).map((att: any) => ({
          filename: att.filename,
          contentType: att.contentType,
        }));

        await db
          .update(emailOutbox)
          .set({
            status: 'sent',
            processedAt: new Date(),
            attachments: metadataAttachments,
          })
          .where(eq(emailOutbox.id, email.id));

        const attachmentNames = metadataAttachments.map((a: any) => a.filename);
        const payload: any = {
          emailId: email.id,
          toAddress: email.toAddress,
          subject: email.subject,
        };
        if (attachmentNames.length > 0) {
          payload.attachments = attachmentNames;
        }

        // Always log to the EMAIL generic entity
        await db.insert(emailEventsTable).values({
          eventId: crypto.randomUUID(),
          entityType: 'email',
          entityId: email.id,
          eventType: 'sent',
          payload,
          actor,
          createdOn: new Date()
        });
        
        if (email.entityType && email.entityId) {
          const dynamicTable = getEventTable(email.entityType);
          await db.insert(dynamicTable).values({
            eventId: crypto.randomUUID(),
            entityType: email.entityType,
            entityId: email.entityId,
            eventType: 'email.sent',
            payload,
            actor,
            createdOn: new Date()
          });
          await db.insert(outbox).values({
            outboxId: crypto.randomUUID(),
            entityType: email.entityType,
            entityId: email.entityId,
            eventType: 'email.sent',
            payload,
            createdOn: new Date()
          });
        }
        logger.info(`Successfully sent email ${email.id}`);
      } catch (err: any) {
        logger.error({ err: err.message, emailId: email.id }, 'Failed to send email');

        const retries = Number(email.retries || 0) + 1;
        const status = retries >= 5 ? 'failed' : 'pending';
        // Exponential backoff: 1m, 2m, 4m, 8m
        const nextRetryAt = new Date(Date.now() + Math.pow(2, retries - 1) * 60000);

        await db
          .update(emailOutbox)
          .set({
            retries: retries.toString(),
            status,
            lastError: err.message,
            nextRetryAt,
          })
          .where(eq(emailOutbox.id, email.id));

        if (status === 'failed') {
          const payload = {
            emailId: email.id,
            toAddress: email.toAddress,
            subject: email.subject,
            error: err.message,
          };

          // Always log to the EMAIL generic entity
          await db.insert(emailEventsTable).values({
            eventId: crypto.randomUUID(),
            entityType: 'email',
            entityId: email.id,
            eventType: 'failed',
            payload,
            actor,
            createdOn: new Date()
          });

          if (email.entityType && email.entityId) {
            const dynamicTable = getEventTable(email.entityType);
            await db.insert(dynamicTable).values({
              eventId: crypto.randomUUID(),
              entityType: email.entityType,
              entityId: email.entityId,
              eventType: 'email.failed',
              payload,
              actor,
              createdOn: new Date()
            });
            await db.insert(outbox).values({
              outboxId: crypto.randomUUID(),
              entityType: email.entityType,
              entityId: email.entityId,
              eventType: 'email.failed',
              payload,
              createdOn: new Date()
            });
          }
        }
      }
    }

    // Close the connection pool to prevent leaks and libuv assertion failures on exit
    if (typeof transporter?.close === 'function') {
      transporter.close();
    }

  } catch (err: any) {
    logger.error({ err: err.message }, 'Error in email outbox poller');
  }
}
