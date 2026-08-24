import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encrypt, decrypt, deriveEncryptionKey } from '@herobm/shared/node';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (rawKey) {
      this.key = deriveEncryptionKey(rawKey);
    } else if (jwtSecret) {
      this.logger.warn(
        'ENCRYPTION_KEY is not set. Falling back to JWT_SECRET hash for development.',
      );
      this.key = deriveEncryptionKey(jwtSecret);
    } else {
      throw new Error(
        'Neither ENCRYPTION_KEY nor JWT_SECRET is configured. Cannot initialize EncryptionService.',
      );
    }
  }

  /**
   * Encrypts a string and returns a colon-separated payload: iv:authTag:encryptedData
   */
  encrypt(text: string): string {
    return encrypt(text, this.key);
  }

  /**
   * Decrypts a colon-separated payload: iv:authTag:encryptedData
   */
  decrypt(payload: string): string {
    try {
      return decrypt(payload, this.key);
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
