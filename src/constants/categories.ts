/** Deal categories from the Deal spec: uppercase, exact match, no case conversion. */
export const CATEGORIES = ['DRINK', 'FOOD'] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}
