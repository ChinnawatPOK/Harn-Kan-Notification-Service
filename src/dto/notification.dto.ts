import type { Types } from 'mongoose';
import type { Category } from '../constants/categories';

/** One item of GET /api/notifications. */
export interface NotificationResponseDto {
  id: string;
  eventId: string;
  userId: string;
  dealId: string;
  category: Category;
  shopName: string;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** What the fan-out writes for one recipient. */
export interface CreateNotificationDto {
  eventId: string;
  userId: string;
  dealId: string;
  category: Category;
  shopName: string;
  message: string;
}

export function toNotificationResponse(doc: {
  _id: Types.ObjectId;
  eventId: string;
  userId: string;
  dealId: string;
  category: string;
  shopName: string;
  message: string;
  read?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationResponseDto {
  return {
    id: String(doc._id),
    eventId: doc.eventId,
    userId: doc.userId,
    dealId: doc.dealId,
    category: doc.category as Category,
    shopName: doc.shopName,
    message: doc.message,
    read: doc.read ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
