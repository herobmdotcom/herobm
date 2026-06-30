import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a 32-byte encryption key from a raw string using SHA-256.
 * The resulting key can be used for AES-256-GCM.
 */
export function deriveEncryptionKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a string and returns a colon-separated payload: iv:authTag:encryptedData
 * @param text The string to encrypt
 * @param key The 32-byte encryption key (e.g. from deriveEncryptionKey)
 */
export function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a colon-separated payload: iv:authTag:encryptedData
 * @param payload The encrypted string payload
 * @param key The 32-byte encryption key (e.g. from deriveEncryptionKey)
 */
export function decrypt(payload: string, key: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
