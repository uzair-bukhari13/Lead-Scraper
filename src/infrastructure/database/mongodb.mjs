import mongoose from 'mongoose';

export const connectMongoDatabase = async ({ uri, databaseName }) => {
  await mongoose.connect(uri, {
    dbName: databaseName,
    serverSelectionTimeoutMS: 10_000
  });

  const disconnect = () => mongoose.disconnect();

  return Object.freeze({
    connection: mongoose.connection,
    disconnect
  });
};
