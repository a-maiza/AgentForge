import { createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Decrypt an AES-256-GCM ciphertext stored by the NestJS EncryptionService.
 * Format: `{ivHex}:{tagHex}:{ciphertextHex}`
 */
export function decryptApiKey(encrypted: string, hexKey: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted key format');
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];

  const key = Buffer.from(hexKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}
