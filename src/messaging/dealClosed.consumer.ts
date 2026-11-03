import { parseDealClosed, type DealClosedEvent } from "../dto/dealClosed.dto";
import type { InsertedNotification } from "../dto/notification.dto";
import { createForParticipants } from "../services/notification.service";
import { createConsumer } from "./consumer";

/**
 * `deal.cancelled` and `deal.expired`: notifies the participants being
 * refunded. An empty `participantIds` is acked with nothing created.
 * `push`, when given, sends the new notifications to devices after the ack.
 */
export function createDealClosedConsumer(
  handle: (event: DealClosedEvent) => Promise<InsertedNotification[]> = createForParticipants,
  push?: (created: InsertedNotification[]) => Promise<unknown>,
) {
  return createConsumer({
    name: "deal.closed",
    parse: parseDealClosed,
    handle,
    afterAck: push,
  });
}
