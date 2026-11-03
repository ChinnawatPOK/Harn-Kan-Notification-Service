import mongoose from 'mongoose';
import { DeviceToken } from '../models/deviceToken.model';
import { Notification } from '../models/notification.model';
import { Preference } from '../models/preference.model';

/**
 * Connects to Mongo and builds indexes before returning. autoIndex is off so
 * the unique (eventId, userId) index exists before the consumer starts,
 * rather than being built in the background while messages arrive.
 */
export async function connectMongo(uri: string): Promise<void> {
  await mongoose.connect(uri, { autoIndex: false });
  await ensureIndexes();
  console.log('[mongo] connected, indexes ensured');
}

export async function ensureIndexes(): Promise<void> {
  const migration = await Preference.collection.updateMany(
    { notification_prefs: { $exists: false }, categories: { $exists: true } },
    { $rename: { categories: 'notification_prefs' } },
  );
  if (migration.modifiedCount > 0) {
    console.log(`[mongo] migrated ${migration.modifiedCount} notification preferences`);
  }

  await Promise.all([
    Preference.createIndexes(),
    Notification.createIndexes(),
    DeviceToken.createIndexes(),
  ]);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  console.log('[mongo] disconnected');
}
