import {
  parseDealCreated,
  type DealCreatedEvent,
} from "../dto/dealCreated.dto";
import { createForDeal } from "../services/notification.service";
import { createConsumer } from "./consumer";

/** `deal.created`: notifies everyone subscribed to the deal's category. */
export function createDealCreatedConsumer(
  handle: (event: DealCreatedEvent) => Promise<number> = createForDeal,
) {
  return createConsumer({ name: "deal.created", parse: parseDealCreated, handle });
}
