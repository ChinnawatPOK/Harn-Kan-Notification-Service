import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { errorHandler, notFound } from './middleware/errorHandler';
import { notificationRoutes } from './routes/notification.routes';

/** Builds the Express app without listening, so tests can use it directly. */
export function createApp({ jwtSecret }: { jwtSecret: string }): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/notifications', notificationRoutes(jwtSecret));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
