import {
  parseDealCreated,
  type DealCreatedEvent,
} from "../dto/dealCreated.dto";
import type { InsertedNotification } from "../dto/notification.dto";
import { createConsumer } from "./consumer";

const RETRY_DELAY_MS = 5_000;
const MAX_RETRY_AGE_MS = 30 * 60 * 1_000;

/**
 * `deal.created`: notifies users near the deal who subscribe to its category.
 * `push`, when given, sends the new notifications to devices after the ack.
 */
export function createDealCreatedConsumer(
  handle: (event: DealCreatedEvent) => Promise<InsertedNotification[]>,
  push?: (created: InsertedNotification[]) => Promise<unknown>,
) {
  return createConsumer({
    name: "deal.created",
    parse: parseDealCreated,
    handle,
    afterAck: push,
    retry: { delayMs: RETRY_DELAY_MS, maxAgeMs: MAX_RETRY_AGE_MS },
  });
}
