import { eq, sql, isNull, lte, and, or } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';
import crypto from 'crypto';
import { emailOutbox, appSettings, outbox, systemEvents } from './schema';
import { relayLogger as logger } from './logger';

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
      const rawKey = process.env.ENCRYPTION_KEY;
      if (!rawKey) {
        logger.error('ENCRYPTION_KEY environment variable is required to decrypt SMTP password.');
        return;
      }

      // Decrypt logic matching apps/api/src/common/encryption.service.ts
      try {
        const parts = settings.smtpPassEncrypted.split(':');
        if (parts.length === 3) {
          const [ivHex, authTagHex, encryptedHex] = parts;
          const iv = Buffer.from(ivHex, 'hex');
          const authTag = Buffer.from(authTagHex, 'hex');
          const encryptedText = Buffer.from(encryptedHex, 'hex');

          // The EncryptionService generates a 32-byte key
          let encryptionKey: Buffer;
          if (rawKey.length === 64) {
            encryptionKey = Buffer.from(rawKey, 'hex');
          } else {
            encryptionKey = crypto.scryptSync(rawKey, 'salt', 32);
          }

          const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
          decipher.setAuthTag(authTag);
          let decrypted = decipher.update(encryptedText, undefined, 'utf8');
          decrypted += decipher.final('utf8');
          smtpPass = decrypted;
        }
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
      logger.error({ err: err.message }, 'Failed to connect to SMTP server. Skipping batch.');
      return;
    }

    for (const email of pendingEmails) {
      try {
        logger.info(`Sending email ${email.id} to ${email.toAddress}`);

        const mailOptions: nodemailer.SendMailOptions = {
          from: settings.smtpFromAddress || 'noreply@modbm.com',
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

        if (email.entityType && email.entityId) {
          const payload = {
            emailId: email.id,
            toAddress: email.toAddress,
            subject: email.subject,
          };
          await db.insert(systemEvents).values({
            eventId: crypto.randomUUID(),
            entityType: email.entityType,
            entityId: email.entityId,
            eventType: 'email.sent',
            payload,
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

        if (status === 'failed' && email.entityType && email.entityId) {
          const payload = {
            emailId: email.id,
            toAddress: email.toAddress,
            subject: email.subject,
            error: err.message,
          };
          await db.insert(systemEvents).values({
            eventId: crypto.randomUUID(),
            entityType: email.entityType,
            entityId: email.entityId,
            eventType: 'email.failed',
            payload,
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

    // Close the connection pool to prevent leaks and libuv assertion failures on exit
    transporter.close();

  } catch (err: any) {
    logger.error({ err: err.message }, 'Error in email outbox poller');
  }
}
