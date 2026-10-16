import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../../src/db/mongo';

/** Starts an in-memory Mongo for the test file and clears it between tests. */
export function useTestDb() {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await connectMongo(mongo.getUri('notification_db'));
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await disconnectMongo();
    await mongo.stop();
  });
}
