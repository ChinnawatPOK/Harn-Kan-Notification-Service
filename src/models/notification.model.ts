import { Schema, model, type InferSchemaType } from "mongoose";
import { CATEGORIES } from "../constants/categories";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes";

const notificationSchema = new Schema(
  {
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "DEAL_CREATED" },
    dealId: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    shopName: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { collection: "notifications", timestamps: true, versionKey: false },
);

notificationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export const Notification = model("Notification", notificationSchema);
