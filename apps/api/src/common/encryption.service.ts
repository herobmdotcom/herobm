import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!rawKey) {
      this.logger.warn(
        'ENCRYPTION_KEY is not set. Falling back to JWT_SECRET hash for development.',
      );
      const jwtSecret = this.configService.get<string>(
        'JWT_SECRET',
        'fallback_secret',
      );
      this.key = crypto.createHash('sha256').update(jwtSecret).digest();
    } else {
      // Ensure the key is exactly 32 bytes for aes-256-gcm
      this.key = crypto.createHash('sha256').update(rawKey).digest();
    }
  }

  /**
   * Encrypts a string and returns a colon-separated payload: iv:authTag:encryptedData
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts a colon-separated payload: iv:authTag:encryptedData
   */
  decrypt(payload: string): string {
    try {
      const parts = payload.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted payload format');
      }

      const [ivHex, authTagHex, encryptedHex] = parts;

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Failed to decrypt payload: ${error}`);
      return '';
    }
  }

  /**
   * Utility to encrypt all string values in an object at the top level
   */
  encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const encrypted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.length > 0) {
        encrypted[key] = this.encrypt(value);
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }

  /**
   * Utility to decrypt all string values in an object at the top level
   */
  decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const decrypted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.includes(':')) {
        const dec = this.decrypt(value);
        decrypted[key] = dec || value; // fallback to original if decryption fails
      } else {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }
}
