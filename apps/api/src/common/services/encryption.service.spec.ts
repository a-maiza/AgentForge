import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

function makeService(hexKey?: string): EncryptionService {
  const key = hexKey ?? 'a'.repeat(64); // 32-byte key
  const config = { getOrThrow: () => key } as unknown as ConfigService;
  return new EncryptionService(config);
}

describe('EncryptionService', () => {
  describe('constructor', () => {
    it('accepts a valid 64-char hex key', () => {
      expect(() => makeService()).not.toThrow();
    });

    it('throws when key decodes to fewer than 32 bytes', () => {
      expect(() => makeService('a'.repeat(62))).toThrow(/exactly 32 bytes/);
    });

    it('throws when key decodes to more than 32 bytes', () => {
      expect(() => makeService('a'.repeat(66))).toThrow(/exactly 32 bytes/);
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('round-trips ASCII plaintext', () => {
      const svc = makeService();
      const plaintext = 'hello world';
      expect(svc.decrypt(svc.encrypt(plaintext))).toBe(plaintext);
    });

    it('round-trips unicode plaintext', () => {
      const svc = makeService();
      const plaintext = '🔐 secret données';
      expect(svc.decrypt(svc.encrypt(plaintext))).toBe(plaintext);
    });

    it('round-trips empty string', () => {
      const svc = makeService();
      expect(svc.decrypt(svc.encrypt(''))).toBe('');
    });
  });

  describe('encrypt', () => {
    it('produces a string with format iv:tag:ciphertext (three colon-separated hex segments)', () => {
      const svc = makeService();
      const result = svc.encrypt('test');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]{24}$/); // 12 bytes → 24 hex chars
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes → 32 hex chars
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('generates a unique IV on each call (no IV reuse)', () => {
      const svc = makeService();
      const ivs = new Set<string>();
      for (let i = 0; i < 20; i++) {
        ivs.add(svc.encrypt('same plaintext').split(':')[0]!);
      }
      expect(ivs.size).toBe(20);
    });

    it('produces different ciphertexts for the same plaintext on each call', () => {
      const svc = makeService();
      const c1 = svc.encrypt('same');
      const c2 = svc.encrypt('same');
      expect(c1).not.toBe(c2);
    });
  });

  describe('decrypt', () => {
    it('throws on malformed ciphertext (not three segments)', () => {
      const svc = makeService();
      expect(() => svc.decrypt('onlyone')).toThrow(/Invalid ciphertext format/);
      expect(() => svc.decrypt('a:b')).toThrow(/Invalid ciphertext format/);
      expect(() => svc.decrypt('a:b:c:d')).toThrow(/Invalid ciphertext format/);
    });

    it('throws when the auth tag is tampered (GCM authentication failure)', () => {
      const svc = makeService();
      const encrypted = svc.encrypt('sensitive');
      const parts = encrypted.split(':');
      // Flip the first byte of the tag
      const tamperedTag = (Number.parseInt(parts[1]!.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0') + parts[1]!.slice(2);
      const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;
      expect(() => svc.decrypt(tampered)).toThrow();
    });

    it('throws when the ciphertext body is tampered (GCM authentication failure)', () => {
      const svc = makeService();
      const encrypted = svc.encrypt('sensitive data');
      const parts = encrypted.split(':');
      // Flip last byte of ciphertext
      const ct = parts[2]!;
      const tamperedCt = ct.slice(0, -2) + (Number.parseInt(ct.slice(-2), 16) ^ 0xff).toString(16).padStart(2, '0');
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCt}`;
      expect(() => svc.decrypt(tampered)).toThrow();
    });

    it('throws when auth tag buffer length is wrong (not 16 bytes)', () => {
      const svc = makeService();
      const encrypted = svc.encrypt('value');
      const [iv, , data] = encrypted.split(':') as [string, string, string];
      // Use a 15-byte (30-char) tag instead of 16-byte
      const shortTag = 'a'.repeat(30);
      expect(() => svc.decrypt(`${iv}:${shortTag}:${data}`)).toThrow(/Auth tag length mismatch/);
    });
  });
});
