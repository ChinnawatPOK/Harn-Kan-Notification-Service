import type { Category } from "../constants/categories";
import { Preference } from "../models/preference.model";

export async function upsertCategories(userId: string, categories: Category[]) {
  const doc = await Preference.findOneAndUpdate(
    { userId },
    { $set: { notification_prefs: categories } },
    { upsert: true, returnDocument: "after", runValidators: true, lean: true },
  );
  return doc!;
}

export async function findByUserId(userId: string) {
  return Preference.findOne({ userId }).lean();
}

export async function findSubscriberIdsAmong(
  category: Category,
  userIds: string[],
  excludeUserId: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const docs = await Preference.find(
    { notification_prefs: category, userId: { $in: userIds, $ne: excludeUserId } },
    { userId: 1, _id: 0 },
  ).lean();
  return docs.map((d) => d.userId);
}
