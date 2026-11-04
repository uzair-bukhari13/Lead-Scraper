import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const createEncryptedFile = (path, keyHex) => {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex || '')) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must contain 64 hex characters'
    );
  }

  const key = Buffer.from(keyHex, 'hex');

  const read = (fallback = {}) => {
    try {
      const blob = JSON.parse(readFileSync(path, 'utf8'));
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(blob.iv, 'base64')
      );

      decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));

      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(blob.data, 'base64')),
        decipher.final()
      ]);

      return JSON.parse(plaintext.toString('utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return fallback;
      }

      throw new Error(`Cannot decrypt ${path}: ${error.message}`);
    }
  };

  const write = object => {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([
      cipher.update(JSON.stringify(object), 'utf8'),
      cipher.final()
    ]);
    const payload = JSON.stringify({
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64')
    });
    const tempPath = `${path}.${process.pid}.tmp`;

    writeFileSync(tempPath, payload, { mode: 0o600 });
    renameSync(tempPath, path);
  };

  return Object.freeze({
    read,
    write
  });
};
