import * as amqp from 'amqplib';
import type { Config } from '../config/env';
import type { DealCreatedConsumer } from './dealCreated.consumer';

export const EXCHANGE = 'harnkan.events';
export const QUEUE = 'notification.deal-created';
export const ROUTING_KEY = 'deal.created';
const PREFETCH = 10;

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
  consumer: DealCreatedConsumer,
  onFatal: (err: Error) => void,
): Promise<RabbitHandle> {
  let channel: amqp.Channel | undefined;
  let consumerTag: string | undefined;
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
          await ch.assertQueue(QUEUE, { durable: true, exclusive: false, autoDelete: false });
          await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
          await ch.prefetch(PREFETCH);

          const ok = await ch.consume(QUEUE, (msg) => void consumer.onMessage(ch, msg), { noAck: false });
          channel = ch;
          consumerTag = ok.consumerTag;
          console.log(`[rabbit] consuming ${QUEUE} (bound to ${EXCHANGE} / ${ROUTING_KEY})`);
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
      if (channel && consumerTag) {
        await channel.cancel(consumerTag).catch(() => undefined);
      }
      await consumer.drain();
      await channel?.close().catch(() => undefined);
      await connection.close().catch(() => undefined);
      console.log('[rabbit] closed');
    },
  };
}
