import { isValidObjectId, type Types } from "mongoose";
import type {
  CreateNotificationDto,
  InsertedNotification,
} from "../dto/notification.dto";
import { Notification } from "../models/notification.model";

const DUPLICATE_KEY = 11000;

/** The user's notifications, newest first. Served by { userId, createdAt: -1 }. */
export async function findByUserNewestFirst(userId: string) {
  return Notification.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function countUnread(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, read: false });
}

/**
 * Sets `read: true` on one of the user's notifications. Returns null when
 * the id is malformed, unknown, or belongs to someone else.
 */
export async function markRead(userId: string, id: string) {
  if (!isValidObjectId(id)) return null;
  return Notification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { read: true } },
    { returnDocument: "after", lean: true },
  );
}

/**
 * Inserts all documents, skipping any that already exist. `ordered: false`
 * keeps going past duplicates, and the unique (eventId, userId) index rejects
 * them, so a redelivery fills in only what is missing.
 *
 * Returns only the newly inserted notifications, so a redelivery does not
 * push again. Throws on any error other than duplicate keys.
 */
export async function insertManyIgnoringDuplicates(
  docs: CreateNotificationDto[],
): Promise<InsertedNotification[]> {
  if (docs.length === 0) return [];
  try {
    const inserted = await Notification.insertMany(docs, { ordered: false });
    return inserted.map(toInserted);
  } catch (err) {
    if (isOnlyDuplicateKeyErrors(err)) {
      const inserted =
        (err as { insertedDocs?: Parameters<typeof toInserted>[0][] })
          .insertedDocs ?? [];
      return inserted.map(toInserted);
    }
    throw err;
  }
}

function toInserted(doc: {
  toObject(): CreateNotificationDto & { _id: Types.ObjectId };
}): InsertedNotification {
  const { _id, eventId, userId, type, dealId, category, shopName, message } =
    doc.toObject();
  return { _id, eventId, userId, type, dealId, category, shopName, message };
}

function isOnlyDuplicateKeyErrors(err: unknown): boolean {
  const writeErrors = (err as { writeErrors?: unknown })?.writeErrors;
  if (!Array.isArray(writeErrors) || writeErrors.length === 0) return false;
  return writeErrors.every((e) => (e?.code ?? e?.err?.code) === DUPLICATE_KEY);
}
