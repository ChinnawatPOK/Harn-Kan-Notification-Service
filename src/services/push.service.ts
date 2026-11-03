import type { NotificationType } from "../constants/notificationTypes";
import type { InsertedNotification } from "../dto/notification.dto";
import type { PushMessage, PushSender } from "../push/pushSender";
import * as deviceTokenRepository from "../repositories/deviceToken.repository";

const TITLES: Record<NotificationType, string> = {
  DEAL_CREATED: "ดีลใหม่",
  DEAL_CANCELLED: "ดีลถูกยกเลิก",
  DEAL_EXPIRED: "ดีลหมดเวลา",
};

export interface PushSummary {
  sent: number;
  failed: number;
  removed: number;
}

/**
 * Best-effort push for notifications already saved in the inbox: one message
 * per device of each recipient. Tokens Expo reports as DeviceNotRegistered
 * are deleted. Never throws, since the inbox is the source of truth.
 */
export async function pushNotifications(
  sender: PushSender,
  notifications: InsertedNotification[],
): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, failed: 0, removed: 0 };
  try {
    const userIds = [...new Set(notifications.map((n) => n.userId))];
    const devices = await deviceTokenRepository.findByUserIds(userIds);
    if (devices.length === 0) return summary;

    const messages: PushMessage[] = notifications.flatMap((n) =>
      devices
        .filter((d) => d.userId === n.userId)
        .map((d) => ({
          to: d.token,
          title: TITLES[n.type],
          body: n.message,
          data: { type: n.type, dealId: n.dealId, notificationId: String(n._id) },
        })),
    );

    const results = await sender.send(messages);
    const unregistered = new Set<string>();
    for (const result of results) {
      if (result.ok) {
        summary.sent++;
        continue;
      }
      summary.failed++;
      if (result.error === "DeviceNotRegistered") unregistered.add(result.token);
      else console.warn(`[push] ${result.token} failed: ${result.error}`);
    }
    summary.removed = await deviceTokenRepository.deleteTokens([...unregistered]);

    console.log(
      `[push] sent ${summary.sent}, failed ${summary.failed}, removed ${summary.removed} token(s)`,
    );
  } catch (err) {
    console.error("[push] failed, notifications stay in the inbox", err);
  }
  return summary;
}
