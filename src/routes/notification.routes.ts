import { Router } from 'express';
import {
  deleteDevice,
  getNotifications,
  getPreferences,
  patchRead,
  putDevice,
  putPreferences,
} from '../controllers/notification.controller';
import { registerDeviceSchema } from '../dto/device.dto';
import { updatePreferencesSchema } from '../dto/preference.dto';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

export function notificationRoutes(jwtSecret: string): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret));
  router.get('/preferences', getPreferences);
  router.put('/preferences', validateBody(updatePreferencesSchema), putPreferences);
  router.put('/devices', validateBody(registerDeviceSchema), putDevice);
  router.delete('/devices/:token', deleteDevice);
  router.get('/', getNotifications);
  router.patch('/:id/read', patchRead);
  return router;
}
