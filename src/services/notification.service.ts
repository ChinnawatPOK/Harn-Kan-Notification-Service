import type { DealCreatedEvent } from "../dto/dealCreated.dto";
import {
  toNotificationResponse,
  type CreateNotificationDto,
  type NotificationResponseDto,
} from "../dto/notification.dto";
import * as notificationRepository from "../repositories/notification.repository";
import * as preferenceRepository from "../repositories/preference.repository";

/** The caller's notifications, newest first. */
export async function listForUser(
  userId: string,
): Promise<NotificationResponseDto[]> {
  const docs = await notificationRepository.findByUserNewestFirst(userId);
  return docs.map(toNotificationResponse);
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
    dealId: event.dealId,
    category: event.category,
    shopName: event.shopName,
    message: `New ${event.category} deal at ${event.shopName}`,
  }));

  return notificationRepository.insertManyIgnoringDuplicates(docs);
}
