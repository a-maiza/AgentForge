import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

function makeService(hexKey?: string): EncryptionService {
  const key = hexKey ?? 'a'.repeat(64); // 32-byte key in hex
  const config = { getOrThrow: () => key } as unknown as ConfigService;
  return new EncryptionService(config);
}

async function makeModule(hexKey = 'a'.repeat(64)): Promise<EncryptionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EncryptionService,
      { provide: ConfigService, useValue: { getOrThrow: () => hexKey } },
    ],
  }).compile();
  return module.get<EncryptionService>(EncryptionService);
}

describe('EncryptionService', () => {
  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts a valid 64-char hex key', () => {
      expect(() => makeService('a'.repeat(64))).not.toThrow();
    });

    it('works via NestJS testing module', async () => {
      const service = await makeModule();
      expect(service).toBeDefined();
    });
  });

  // ─── Round-trip ──────────────────────────────────────────────────────────────

  describe('encrypt / decrypt round-trip', () => {
    let service: EncryptionService;
    beforeEach(() => {
      service = makeService();
    });

    it('round-trips ASCII plaintext', () => {
      const plain = 'sk-secretkey123';
      const cipher = service.encrypt(plain);
      expect(service.decrypt(cipher)).toBe(plain);
    });

    it('round-trips unicode plaintext', () => {
      const plain = 'こんにちは 🔐';
      expect(service.decrypt(service.encrypt(plain))).toBe(plain);
    });

    it('produces different ciphertexts for same plaintext (IV randomness)', () => {
      const c1 = service.encrypt('test');
      const c2 = service.encrypt('test');
      expect(c1).not.toBe(c2);
    });
  });

  // ─── Format validation ────────────────────────────────────────────────────────

  describe('decrypt format validation', () => {
    let service: EncryptionService;
    beforeEach(() => {
      service = makeService();
    });

    it('throws on missing segments', () => {
      expect(() => service.decrypt('onlyone')).toThrow();
      expect(() => service.decrypt('two:segments')).toThrow();
    });

    it('throws on tampered ciphertext', () => {
      const cipher = service.encrypt('data');
      const parts = cipher.split(':');
      parts[2] = 'deadbeef' + parts[2]!.slice(8);
      expect(() => service.decrypt(parts.join(':'))).toThrow();
    });
  });
});
