import { isCategory, type Category } from '../constants/categories';
import { ValidationError } from '../errors';
import { Preference } from '../models/preference.model';

export interface PreferenceView {
  userId: string;
  categories: Category[];
  updatedAt: Date;
}

/**
 * Validates and dedupes the categories. An empty array is valid and turns
 * off all notifications. Values must match exactly (no case conversion).
 */
export function parseCategories(input: unknown): Category[] {
  if (!Array.isArray(input)) {
    throw new ValidationError('categories must be an array of strings');
  }
  for (const value of input) {
    if (typeof value !== 'string') {
      throw new ValidationError('categories must be an array of strings');
    }
    if (!isCategory(value)) {
      throw new ValidationError(`Invalid category "${value}". Allowed: DRINK, FOOD`);
    }
  }
  return [...new Set(input as Category[])];
}

/**
 * Replaces the user's whole set (last write wins). Applies to future deals
 * only and never deletes notifications already received.
 */
export async function replacePreferences(userId: string, categories: Category[]): Promise<PreferenceView> {
  const doc = await Preference.findOneAndUpdate(
    { userId },
    { $set: { categories } },
    { upsert: true, returnDocument: 'after', runValidators: true, lean: true },
  );

  return {
    userId: doc!.userId,
    categories: doc!.categories as Category[],
    updatedAt: doc!.updatedAt,
  };
}
