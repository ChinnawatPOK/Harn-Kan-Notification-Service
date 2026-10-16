import { CATEGORIES, isCategory, type Category } from '../constants/categories';
import { ValidationError } from '../errors';

/** The `deal.created` contract from the Deal spec. All fields are required. */
export interface DealCreatedEvent {
  eventId: string;
  eventType: 'deal.created';
  occurredAt: string;
  dealId: string;
  creatorId: string;
  category: Category;
  shopName: string;
  /** Sent for the 500 m radius filter in a later round; not used now. */
  lat: number;
  lng: number;
}

/**
 * Parses and validates a message body. Throws ValidationError for anything
 * a redelivery cannot fix. Unknown fields are ignored. Ids are normalised to
 * strings so they compare equal to the JWT `id` stored on preferences.
 */
export function parseDealCreated(content: Buffer): DealCreatedEvent {
  let body: unknown;
  try {
    body = JSON.parse(content.toString('utf8'));
  } catch {
    throw new ValidationError('Message body is not valid JSON');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Message body must be a JSON object');
  }
  const e = body as Record<string, unknown>;

  const event = {
    eventId: requireString(e, 'eventId'),
    eventType: requireString(e, 'eventType'),
    occurredAt: requireString(e, 'occurredAt'),
    dealId: requireId(e, 'dealId'),
    creatorId: requireId(e, 'creatorId'),
    category: requireString(e, 'category'),
    shopName: requireString(e, 'shopName'),
    lat: requireNumber(e, 'lat'),
    lng: requireNumber(e, 'lng'),
  };

  if (event.eventType !== 'deal.created') {
    throw new ValidationError(`Unexpected eventType "${event.eventType}"`);
  }
  if (!isCategory(event.category)) {
    throw new ValidationError(`Invalid category "${event.category}". Allowed: ${CATEGORIES.join(', ')}`);
  }

  return { ...event, eventType: 'deal.created', category: event.category };
}

function requireString(e: Record<string, unknown>, field: string): string {
  const value = e[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`Field "${field}" is required and must be a non-empty string`);
  }
  return value;
}

function requireId(e: Record<string, unknown>, field: string): string {
  const value = e[field];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return requireString(e, field);
}

function requireNumber(e: Record<string, unknown>, field: string): number {
  const value = e[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`Field "${field}" is required and must be a number`);
  }
  return value;
}
