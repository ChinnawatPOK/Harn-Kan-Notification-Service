import { Notification } from '../models/notification.model';
import { Preference } from '../models/preference.model';
import type { DealCreatedEvent } from '../messaging/dealCreated.event';

const DUPLICATE_KEY = 11000;

/** The caller's notifications, newest first. */
export async function listForUser(userId: string) {
  const docs = await Notification.find({ userId }).sort({ createdAt: -1 }).lean();
  return docs.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
}

/**
 * Creates one notification per subscriber of the deal's category, skipping
 * the creator. Idempotent: the unique (eventId, userId) index plus
 * `ordered: false` means a redelivery fills in whatever is missing and the
 * duplicates are rejected, so a crash halfway through never loses users.
 *
 * Returns how many notifications were newly inserted. Throws on any error
 * other than duplicate keys, so the caller can requeue.
 */
export async function createForDeal(event: DealCreatedEvent): Promise<number> {
  const recipients = await Preference.find(
    { categories: event.category, userId: { $ne: event.creatorId } },
    { userId: 1, _id: 0 },
  ).lean();

  if (recipients.length === 0) return 0;

  const docs = recipients.map(({ userId }) => ({
    eventId: event.eventId,
    userId,
    dealId: event.dealId,
    category: event.category,
    shopName: event.shopName,
    message: `New ${event.category} deal at ${event.shopName}`,
    read: false,
  }));

  try {
    const inserted = await Notification.insertMany(docs, { ordered: false });
    return inserted.length;
  } catch (err) {
    if (isOnlyDuplicateKeyErrors(err)) {
      return docs.length - (err as { writeErrors: unknown[] }).writeErrors.length;
    }
    throw err;
  }
}

function isOnlyDuplicateKeyErrors(err: unknown): boolean {
  const writeErrors = (err as { writeErrors?: unknown })?.writeErrors;
  if (!Array.isArray(writeErrors) || writeErrors.length === 0) return false;
  return writeErrors.every((e) => (e?.code ?? e?.err?.code) === DUPLICATE_KEY);
}
