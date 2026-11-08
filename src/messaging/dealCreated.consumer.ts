import {
  parseDealCreated,
  type DealCreatedEvent,
} from "../dto/dealCreated.dto";
import type { InsertedNotification } from "../dto/notification.dto";
import { createConsumer } from "./consumer";

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
  });
}
