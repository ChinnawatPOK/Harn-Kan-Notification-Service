import {
  parseDealCreated,
  type DealCreatedEvent,
} from "../dto/dealCreated.dto";
import type { InsertedNotification } from "../dto/notification.dto";
import { createForDeal } from "../services/notification.service";
import { createConsumer } from "./consumer";

/**
 * `deal.created`: notifies everyone subscribed to the deal's category.
 * Inbox only in this phase; no push until deals are filtered by distance.
 */
export function createDealCreatedConsumer(
  handle: (event: DealCreatedEvent) => Promise<InsertedNotification[]> = createForDeal,
) {
  return createConsumer({ name: "deal.created", parse: parseDealCreated, handle });
}
