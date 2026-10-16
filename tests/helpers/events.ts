import type { DealCreatedEvent } from '../../src/dto/dealCreated.dto';

export function dealCreated(overrides: Partial<DealCreatedEvent> = {}): DealCreatedEvent {
  return {
    eventId: 'evt-1',
    eventType: 'deal.created',
    occurredAt: '2026-10-16T10:00:00.000Z',
    dealId: 'deal-1',
    creatorId: 'creator',
    category: 'DRINK',
    shopName: 'Cafe Amazon',
    lat: 13.7563,
    lng: 100.5018,
    ...overrides,
  };
}
