import type { Channel, ConsumeMessage } from "amqplib";
import { ValidationError } from "../errors";

export type AckChannel = Pick<Channel, "ack" | "nack">;

/**
 * Handles deliveries with manual ack:
 * - invalid message (bad JSON, missing field, unknown value): ack and drop
 * - handled (duplicates count as success): ack
 * - anything else (e.g. Mongo down): nack with requeue
 */
export function createConsumer<E extends { eventId: string }>(options: {
  /** Log prefix, e.g. the routing key. */
  name: string;
  /** Throws ValidationError for a message that can never be handled. */
  parse: (content: Buffer) => E;
  /** Returns how many notifications were newly created. */
  handle: (event: E) => Promise<number>;
}) {
  const { name, parse, handle } = options;
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

    try {
      const created = await handle(event);
      console.log(
        `[${name}] event ${event.eventId} -> ${created} new notification(s)`,
      );
      safely(() => channel.ack(msg));
    } catch (err) {
      console.error(`[${name}] event ${event.eventId} failed, requeueing`, err);
      safely(() => channel.nack(msg, false, true));
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
