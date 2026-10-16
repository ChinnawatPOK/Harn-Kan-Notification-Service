import type { Category } from "../constants/categories";
import { Preference } from "../models/preference.model";

export async function upsertCategories(userId: string, categories: Category[]) {
  const doc = await Preference.findOneAndUpdate(
    { userId },
    { $set: { categories } },
    { upsert: true, returnDocument: "after", runValidators: true, lean: true },
  );
  return doc!;
}

export async function findSubscriberIds(
  category: Category,
  excludeUserId: string,
): Promise<string[]> {
  const docs = await Preference.find(
    { categories: category, userId: { $ne: excludeUserId } },
    { userId: 1, _id: 0 },
  ).lean();
  return docs.map((d) => d.userId);
}
