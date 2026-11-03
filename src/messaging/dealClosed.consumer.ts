import { parseDealClosed, type DealClosedEvent } from "../dto/dealClosed.dto";
import { createForParticipants } from "../services/notification.service";
import { createConsumer } from "./consumer";

/**
 * `deal.cancelled` and `deal.expired`: notifies the participants being
 * refunded. An empty `participantIds` is acked with nothing created.
 */
export function createDealClosedConsumer(
  handle: (event: DealClosedEvent) => Promise<number> = createForParticipants,
) {
  return createConsumer({ name: "deal.closed", parse: parseDealClosed, handle });
}
