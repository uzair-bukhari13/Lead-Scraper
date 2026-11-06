import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from 'node:crypto';

const encrypt = (value, key) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final()
  ]);

  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  };
};

const decrypt = (value, key) => {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(value.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.data, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString('utf8'));
};

export const createEncryptedMongoStore = ({
  collection,
  keyHex,
  documentId = 'upwork-oauth'
}) => {
  if (!collection) {
    throw new Error('MongoDB collection is required');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex || '')) {
    throw new Error('TOKEN_ENCRYPTION_KEY must contain 64 hex characters');
  }

  const key = Buffer.from(keyHex, 'hex');

  const get = async field => {
    const document = await collection.findOne({ _id: documentId });
    const encrypted = document?.[field];
    return encrypted ? decrypt(encrypted, key) : undefined;
  };

  const set = async (field, value) => {
    await collection.updateOne(
      { _id: documentId },
      {
        $set: {
          [field]: encrypt(value, key),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  };

  const remove = async field => {
    await collection.updateOne(
      { _id: documentId },
      { $unset: { [field]: '' }, $set: { updatedAt: new Date() } }
    );
  };

  const clear = async () => {
    await collection.deleteOne({ _id: documentId });
  };

  return Object.freeze({ get, set, remove, clear });
};
