import { Router } from 'express';
import {
  getNotifications,
  getPreferences,
  patchRead,
  putPreferences,
} from '../controllers/notification.controller';
import { updatePreferencesSchema } from '../dto/preference.dto';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

export function notificationRoutes(jwtSecret: string): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret));
  router.get('/preferences', getPreferences);
  router.put('/preferences', validateBody(updatePreferencesSchema), putPreferences);
  router.get('/', getNotifications);
  router.patch('/:id/read', patchRead);
  return router;
}
