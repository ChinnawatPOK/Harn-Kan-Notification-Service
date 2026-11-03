import type { Request, Response } from "express";
import type { RegisterDeviceDto } from "../dto/device.dto";
import type { UpdatePreferencesDto } from "../dto/preference.dto";
import { registerDevice, unregisterDevice } from "../services/device.service";
import { listForUser, markRead } from "../services/notification.service";
import {
  getPreferences as loadPreferences,
  replacePreferences,
} from "../services/preference.service";

export async function putPreferences(
  req: Request<unknown, unknown, UpdatePreferencesDto>,
  res: Response,
) {
  const saved = await replacePreferences(req.userId!, req.body);
  res.status(200).json(saved);
}

export async function getPreferences(req: Request, res: Response) {
  const preferences = await loadPreferences(req.userId!);
  res.status(200).json(preferences);
}

export async function getNotifications(req: Request, res: Response) {
  const notifications = await listForUser(req.userId!);
  res.status(200).json(notifications);
}

export async function patchRead(req: Request<{ id: string }>, res: Response) {
  const notification = await markRead(req.userId!, req.params.id);
  res.status(200).json(notification);
}

export async function putDevice(
  req: Request<unknown, unknown, RegisterDeviceDto>,
  res: Response,
) {
  const device = await registerDevice(req.userId!, req.body);
  res.status(200).json(device);
}

export async function deleteDevice(
  req: Request<{ token: string }>,
  res: Response,
) {
  await unregisterDevice(req.userId!, req.params.token);
  res.status(204).end();
}
