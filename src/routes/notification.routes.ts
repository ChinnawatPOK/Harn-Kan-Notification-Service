import { Router } from 'express';
import { getNotifications, putPreferences } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth';

export function notificationRoutes(jwtSecret: string): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret));
  router.put('/preferences', putPreferences);
  router.get('/', getNotifications);
  return router;
}
