import type { Channel, ConsumeMessage } from "amqplib";
import type { InsertedNotification } from "../dto/notification.dto";
import { ValidationError } from "../errors";

export type AckChannel = Pick<Channel, "ack" | "nack">;

/**
 * Handles deliveries with manual ack:
 * - invalid message (bad JSON, missing field, unknown value): ack and drop
 * - `handle` throws ValidationError (retrying cannot help): ack and drop
 * - handled (duplicates count as success): ack
 * - anything else (e.g. Mongo down): nack with requeue
 *
 * `afterAck` runs only once the message is acked, with the notifications
 * created this time, so its failures never cause a redelivery.
 */
export function createConsumer<
  E extends { eventId: string; occurredAt: string },
>(options: {
  /** Log prefix, e.g. the routing key. */
  name: string;
  /** Throws ValidationError for a message that can never be handled. */
  parse: (content: Buffer) => E;
  /** Returns the notifications newly created (none for a duplicate). */
  handle: (event: E) => Promise<InsertedNotification[]>;
  afterAck?: (created: InsertedNotification[]) => Promise<unknown>;
  retry?: { delayMs: number; maxAgeMs: number };
}) {
  const { name, parse, handle, afterAck, retry } = options;
  const inFlight = new Set<Promise<void>>();

  async function process(
    channel: AckChannel,
    msg: ConsumeMessage,
  ): Promise<void> {
    let event: E;
    try {
      event = parse(msg.content);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      console.error(
        `[${name}] dropping invalid message ${msg.properties.messageId ?? ""}: ${err.message}`,
      );
      safely(() => channel.ack(msg));
      return;
    }

    let created: InsertedNotification[];
    try {
      created = await handle(event);
      console.log(
        `[${name}] event ${event.eventId} -> ${created.length} new notification(s)`,
      );
      safely(() => channel.ack(msg));
    } catch (err) {
      if (err instanceof ValidationError) {
        console.error(
          `[${name}] dropping event ${event.eventId}: ${err.message}`,
        );
        safely(() => channel.ack(msg));
        return;
      }
      if (retry && Date.now() - Date.parse(event.occurredAt) > retry.maxAgeMs) {
        console.error(
          `[${name}] dropping event ${event.eventId}, too old to retry`,
          err,
        );
        safely(() => channel.ack(msg));
        return;
      }
      console.error(`[${name}] event ${event.eventId} failed, requeueing`, err);
      if (retry)
        await new Promise((resolve) => setTimeout(resolve, retry.delayMs));
      safely(() => channel.nack(msg, false, true));
      return;
    }

    if (afterAck && created.length > 0) {
      await afterAck(created).catch((err) =>
        console.error(
          `[${name}] after-ack step failed for ${event.eventId}`,
          err,
        ),
      );
    }
  }

  return {
    onMessage(channel: AckChannel, msg: ConsumeMessage | null): Promise<void> {
      if (msg === null) {
        console.warn(`[${name}] consumer was cancelled by the broker`);
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

export type Consumer = ReturnType<typeof createConsumer>;

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
