import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hexKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    this.key = Buffer.from(hexKey, 'hex');
    if (this.key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (got ${this.key.length}). Ensure it is a 64-character hex string.`,
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    if (tag.length !== TAG_LENGTH) throw new Error('Unexpected auth tag length');
    // Format: iv(12):tag(16):ciphertext — all hex
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid ciphertext format: expected iv:tag:data');
    const [ivHex, tagHex, dataHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    if (tag.length !== TAG_LENGTH) {
      throw new Error(`Auth tag length mismatch: expected ${TAG_LENGTH}, got ${tag.length}`);
    }
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  }
}
