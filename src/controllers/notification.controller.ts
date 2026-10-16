import type { Request, Response } from 'express';
import { listForUser } from '../services/notification.service';
import { parseCategories, replacePreferences } from '../services/preference.service';

/** PUT /api/notifications/preferences. User id comes from the JWT only. */
export async function putPreferences(req: Request, res: Response) {
  const categories = parseCategories(req.body?.categories);
  const saved = await replacePreferences(req.userId!, categories);
  res.status(200).json(saved);
}

/** GET /api/notifications */
export async function getNotifications(req: Request, res: Response) {
  const notifications = await listForUser(req.userId!);
  res.status(200).json(notifications);
}
