import type { Channel, ConsumeMessage } from "amqplib";
import { ValidationError } from "../errors";
import { createForDeal } from "../services/notification.service";
import {
  parseDealCreated,
  type DealCreatedEvent,
} from "../dto/dealCreated.dto";

type AckChannel = Pick<Channel, "ack" | "nack">;

/**
 * Handles `deal.created` deliveries with manual ack:
 * - invalid message (bad JSON, missing field, unknown category): ack and drop
 * - fan-out succeeded (duplicates count as success): ack
 * - anything else (e.g. Mongo down): nack with requeue
 *
 */
export function createDealCreatedConsumer(
  handle: (event: DealCreatedEvent) => Promise<number> = createForDeal,
) {
  const inFlight = new Set<Promise<void>>();

  async function process(
    channel: AckChannel,
    msg: ConsumeMessage,
  ): Promise<void> {
    let event: DealCreatedEvent;
    try {
      event = parseDealCreated(msg.content);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      console.error(
        `[consumer] dropping invalid message ${msg.properties.messageId ?? ""}: ${err.message}`,
      );
      safely(() => channel.ack(msg));
      return;
    }

    try {
      const created = await handle(event);
      console.log(
        `[consumer] event ${event.eventId} (${event.category}) -> ${created} new notification(s)`,
      );
      safely(() => channel.ack(msg));
    } catch (err) {
      console.error(
        `[consumer] event ${event.eventId} failed, requeueing`,
        err,
      );
      safely(() => channel.nack(msg, false, true));
    }
  }

  return {
    onMessage(channel: AckChannel, msg: ConsumeMessage | null): Promise<void> {
      if (msg === null) {
        console.warn("[consumer] consumer was cancelled by the broker");
        return Promise.resolve();
      }
      const task = process(channel, msg).finally(() => inFlight.delete(task));
      inFlight.add(task);
      return task;
    },

    async drain(): Promise<void> {
      await Promise.allSettled([...inFlight]);
    },
  };
}

export type DealCreatedConsumer = ReturnType<typeof createDealCreatedConsumer>;

function safely(fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn(
      "[consumer] could not ack/nack, channel closed; message will be redelivered",
      err,
    );
  }
}
