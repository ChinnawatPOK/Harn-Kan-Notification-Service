import mongoose from 'mongoose';
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
  await Promise.all([Preference.createIndexes(), Notification.createIndexes()]);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  console.log('[mongo] disconnected');
}
