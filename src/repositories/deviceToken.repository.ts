import { DeviceToken, type Platform } from "../models/deviceToken.model";

/**
 * Saves the token for this user. A token registered earlier by another
 * user (account switch on the same device) moves to this user.
 */
export async function upsert(token: string, userId: string, platform: Platform) {
  const doc = await DeviceToken.findOneAndUpdate(
    { token },
    { $set: { userId, platform } },
    { upsert: true, returnDocument: "after", runValidators: true, lean: true },
  );
  return doc!;
}

/** Removes the token only if it belongs to this user. */
export async function deleteForUser(userId: string, token: string): Promise<void> {
  await DeviceToken.deleteOne({ token, userId });
}

export async function findByUserIds(userIds: string[]) {
  if (userIds.length === 0) return [];
  return DeviceToken.find({ userId: { $in: userIds } }, { token: 1, userId: 1, _id: 0 }).lean();
}

export async function deleteTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const result = await DeviceToken.deleteMany({ token: { $in: tokens } });
  return result.deletedCount;
}
