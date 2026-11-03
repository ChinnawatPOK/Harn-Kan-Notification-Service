import type { DealClosedEvent } from "../dto/dealClosed.dto";
import type { DealCreatedEvent } from "../dto/dealCreated.dto";
import {
  toNotificationResponse,
  type CreateNotificationDto,
  type NotificationListResponseDto,
  type NotificationResponseDto,
} from "../dto/notification.dto";
import { NotFoundError } from "../errors";
import * as notificationRepository from "../repositories/notification.repository";
import * as preferenceRepository from "../repositories/preference.repository";

/** The caller's notifications, newest first, with how many are unread. */
export async function listForUser(
  userId: string,
): Promise<NotificationListResponseDto> {
  const [docs, unreadCount] = await Promise.all([
    notificationRepository.findByUserNewestFirst(userId),
    notificationRepository.countUnread(userId),
  ]);
  return { unreadCount, items: docs.map(toNotificationResponse) };
}

export async function markRead(
  userId: string,
  id: string,
): Promise<NotificationResponseDto> {
  const doc = await notificationRepository.markRead(userId, id);
  if (!doc) throw new NotFoundError("Notification not found");
  return toNotificationResponse(doc);
}

/**
 * Creates one notification per subscriber of the deal's category.
 *
 * Returns how many notifications were newly inserted. Throws on any error
 * other than duplicate keys, so the caller can requeue.
 */
export async function createForDeal(event: DealCreatedEvent): Promise<number> {
  const recipientIds = await preferenceRepository.findSubscriberIds(
    event.category,
    event.creatorId,
  );

  const docs: CreateNotificationDto[] = recipientIds.map((userId) => ({
    eventId: event.eventId,
    userId,
    type: "DEAL_CREATED",
    dealId: event.dealId,
    category: event.category,
    shopName: event.shopName,
    message: `New ${event.category} deal at ${event.shopName}`,
  }));

  return notificationRepository.insertManyIgnoringDuplicates(docs);
}

/**
 * Tells each participant in `participantIds` that the deal was cancelled or
 * expired and their money is being refunded. Preferences do not apply.
 *
 * Returns how many notifications were newly inserted. Throws on any error
 * other than duplicate keys, so the caller can requeue.
 */
export async function createForParticipants(
  event: DealClosedEvent,
): Promise<number> {
  const cancelled = event.eventType === "deal.cancelled";
  const message = cancelled
    ? `ดีล ${event.shopName} ถูกยกเลิก กำลังคืนเงินให้คุณ`
    : `ดีล ${event.shopName} หมดเวลา กำลังคืนเงินให้คุณ`;

  const docs: CreateNotificationDto[] = event.participantIds.map((userId) => ({
    eventId: event.eventId,
    userId,
    type: cancelled ? "DEAL_CANCELLED" : "DEAL_EXPIRED",
    dealId: event.dealId,
    category: event.category,
    shopName: event.shopName,
    message,
  }));

  return notificationRepository.insertManyIgnoringDuplicates(docs);
}
