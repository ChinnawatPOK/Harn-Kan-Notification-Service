import type { Request, Response } from 'express';
import type { UpdatePreferencesDto } from '../dto/preference.dto';
import { listForUser } from '../services/notification.service';
import { replacePreferences } from '../services/preference.service';

export async function putPreferences(req: Request<unknown, unknown, UpdatePreferencesDto>, res: Response) {
  const saved = await replacePreferences(req.userId!, req.body);
  res.status(200).json(saved);
}

export async function getNotifications(req: Request, res: Response) {
  const notifications = await listForUser(req.userId!);
  res.status(200).json(notifications);
}
