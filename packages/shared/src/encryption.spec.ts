import * as fs from 'fs';
import * as path from 'path';
import { deriveEncryptionKey, encrypt, decrypt } from './encryption';

describe('Encryption Utilities', () => {
  it('should encrypt and decrypt correctly', () => {
    const rawKey = 'my-super-secret-password-12345';
    const key = deriveEncryptionKey(rawKey);
    const plaintext = 'this is a secret message';
    
    const ciphertext = encrypt(plaintext, key);
    expect(ciphertext).toContain(':');
    
    const decrypted = decrypt(ciphertext, key);
    expect(decrypted).toBe(plaintext);
  });
});
