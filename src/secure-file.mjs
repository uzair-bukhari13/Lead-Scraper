import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class EncryptedFile {
  constructor(path, keyHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex || '')) throw new Error('TOKEN_ENCRYPTION_KEY must contain 64 hex characters');
    this.path = path;
    this.key = Buffer.from(keyHex, 'hex');
  }
  read(fallback = {}) {
    try {
      const blob = JSON.parse(readFileSync(this.path, 'utf8'));
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(blob.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]);
      return JSON.parse(plaintext.toString('utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return fallback;
      // Fail closed if the key is wrong or the file is corrupted.
      throw new Error(`Cannot decrypt ${this.path}: ${error.message}`);
    }
  }
  write(object) {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(object), 'utf8'), cipher.final()]);
    const payload = JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
    const temp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temp, payload, { mode: 0o600 });
    renameSync(temp, this.path);
  }
}
