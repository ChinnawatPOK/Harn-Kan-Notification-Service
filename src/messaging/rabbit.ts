import * as amqp from 'amqplib';
import type { Config } from '../config/env';
import type { Consumer } from './consumer';

export const EXCHANGE = 'harnkan.events';
const PREFETCH = 10;

/** The queues this service owns and the routing keys bound to each. */
export const QUEUES = {
  dealCreated: { queue: 'notification.deal-created', routingKeys: ['deal.created'] },
  dealClosed: { queue: 'notification.deal-closed', routingKeys: ['deal.cancelled', 'deal.expired'] },
} as const;

export type Consumers = Record<keyof typeof QUEUES, Consumer>;

export interface RabbitHandle {
  /** Cancels the consumer, waits for in-flight messages, then closes. */
  stop(): Promise<void>;
}

/**
 * Connects with amqplib's built-in recovery (amqplib does not reconnect
 * otherwise). `setup` runs after every (re)connect and re-declares the
 * topology and the consumer. At startup it retries with backoff, since
 * RabbitMQ boots slower; once connected it keeps retrying forever.
 */
export async function startRabbit(
  config: Config['rabbit'],
  consumers: Consumers,
  onFatal: (err: Error) => void,
): Promise<RabbitHandle> {
  let channel: amqp.Channel | undefined;
  let consumerTags: string[] = [];
  let stopping = false;

  const connection = await amqp.connect(
    {
      protocol: 'amqp',
      hostname: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
    },
    {
      recovery: {
        initialDelay: 500,
        maxDelay: 10_000,
        initialMaxRetries: 10,
        maxRetries: Infinity,
        async setup(model: amqp.ChannelModel) {
          const ch = await model.createChannel();
          ch.on('error', (err) => console.error('[rabbit] channel error', err));

          await ch.assertExchange(EXCHANGE, 'topic', { durable: true, autoDelete: false });
          await ch.prefetch(PREFETCH);

          const tags: string[] = [];
          for (const [key, { queue, routingKeys }] of Object.entries(QUEUES)) {
            const consumer = consumers[key as keyof typeof QUEUES];
            await ch.assertQueue(queue, { durable: true, exclusive: false, autoDelete: false });
            for (const routingKey of routingKeys) {
              await ch.bindQueue(queue, EXCHANGE, routingKey);
            }
            const ok = await ch.consume(queue, (msg) => void consumer.onMessage(ch, msg), {
              noAck: false,
            });
            tags.push(ok.consumerTag);
            console.log(`[rabbit] consuming ${queue} (bound to ${EXCHANGE} / ${routingKeys.join(', ')})`);
          }
          channel = ch;
          consumerTags = tags;
        },
      },
    },
  );

  connection.on('disconnect', (err) => {
    if (!stopping) console.warn('[rabbit] disconnected, will reconnect:', err?.message);
  });
  connection.on('reconnect-scheduled', ({ attempt, delay, error }) => {
    console.warn(`[rabbit] reconnect attempt ${attempt} in ${delay}ms (${error.message})`);
  });
  connection.on('reconnect-failed', (err) => onFatal(err));
  connection.on('error', (err) => console.error('[rabbit] connection error', err));

  return {
    async stop() {
      stopping = true;
      if (channel) {
        await Promise.all(
          consumerTags.map((consumerTag) =>
            channel!.cancel(consumerTag).catch(() => undefined),
          ),
        );
      }
      await Promise.all(Object.values(consumers).map((consumer) => consumer.drain()));
      await channel?.close().catch(() => undefined);
      await connection.close().catch(() => undefined);
      console.log('[rabbit] closed');
    },
  };
}
