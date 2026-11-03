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

/** Parses a RabbitMQ message body as a JSON object, then runs the schema. */
export function parseMessage<S extends z.ZodType>(schema: S, content: Buffer): z.output<S> {
  let body: unknown;
  try {
    body = JSON.parse(content.toString('utf8'));
  } catch {
    throw new ValidationError('Message body is not valid JSON');
  }
  if (Array.isArray(body)) {
    throw new ValidationError('Message body must be a JSON object');
  }
  return parseOrThrow(schema, body);
}
