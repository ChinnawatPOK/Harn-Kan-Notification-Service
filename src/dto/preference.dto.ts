import { z } from "zod";
import { CATEGORIES, type Category } from "../constants/categories";

const NOT_STRING_ARRAY = "categories must be an array of strings";

/**
 * Body of PUT /api/notifications/preferences. An empty array is valid and
 * turns off all notifications. Values must match exactly (no case
 * conversion). Duplicates are removed.
 */
export const updatePreferencesSchema = z
  .object(
    {
      categories: z.array(
        z.enum(CATEGORIES, {
          error: (issue) =>
            typeof issue.input === "string"
              ? `Invalid category "${issue.input}". Allowed: ${CATEGORIES.join(", ")}`
              : NOT_STRING_ARRAY,
        }),
        { error: NOT_STRING_ARRAY },
      ),
    },
    { error: NOT_STRING_ARRAY },
  )
  .transform(({ categories }) => ({ categories: [...new Set(categories)] }));

export type UpdatePreferencesDto = z.output<typeof updatePreferencesSchema>;

/** Response of PUT /api/notifications/preferences. */
export interface PreferenceResponseDto {
  userId: string;
  categories: Category[];
  updatedAt: Date;
}

export function toPreferenceResponse(doc: {
  userId: string;
  categories: string[];
  updatedAt: Date;
}): PreferenceResponseDto {
  return {
    userId: doc.userId,
    categories: doc.categories as Category[],
    updatedAt: doc.updatedAt,
  };
}
