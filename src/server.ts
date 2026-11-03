import type { Server } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config/env';
import { connectMongo, disconnectMongo } from './db/mongo';
import { createDealClosedConsumer } from './messaging/dealClosed.consumer';
import { createDealCreatedConsumer } from './messaging/dealCreated.consumer';
import { startRabbit, type RabbitHandle } from './messaging/rabbit';
import { createExpoPushSender } from './push/pushSender';
import { createForParticipants } from './services/notification.service';
import { pushNotifications } from './services/push.service';

/**
 * Startup order: Mongo + indexes, then RabbitMQ + consumer, then HTTP.
 * On SIGTERM/SIGINT: stop HTTP, cancel the consumer and let in-flight
 * messages finish, then close RabbitMQ and Mongo. Unacked messages go back
 * to the queue.
 */
async function main() {
  const config = loadConfig();

  let server: Server | undefined;
  let rabbit: RabbitHandle | undefined;
  let shuttingDown = false;

  async function shutdown(reason: string, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] shutting down (${reason})`);

    const timer = setTimeout(() => {
      console.error('[server] shutdown timed out, forcing exit');
      process.exit(1);
    }, 15_000);
    timer.unref();

    try {
      if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
      await rabbit?.stop();
      await disconnectMongo();
    } catch (err) {
      console.error('[server] error during shutdown', err);
      exitCode = 1;
    }
    process.exit(exitCode);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await connectMongo(config.mongoUri);

  const push = createExpoPushSender(config.push.expoAccessToken);

  rabbit = await startRabbit(
    config.rabbit,
    {
      dealCreated: createDealCreatedConsumer(),
      dealClosed: createDealClosedConsumer(
        createForParticipants,
        (created) => pushNotifications(push, created),
      ),
    },
    (err) => {
      console.error('[rabbit] gave up reconnecting', err);
      void shutdown('RabbitMQ unavailable', 1);
    },
  );

  const app = createApp({ jwtSecret: config.jwtSecret });
  server = app.listen(config.port, () => {
    console.log(`[server] Notification Service listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
