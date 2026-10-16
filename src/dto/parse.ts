import type { z } from 'zod';
import { ValidationError } from '../errors';

/**
 * Runs a zod schema and returns the parsed value. On failure throws a
 * ValidationError carrying the first issue's message, so HTTP answers 400
 * and the consumer acks and drops.
 */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}
