import { Schema, model, type InferSchemaType } from "mongoose";

export const PLATFORMS = ["ios", "android"] as const;

export type Platform = (typeof PLATFORMS)[number];

const deviceTokenSchema = new Schema(
  {
    token: { type: String, required: true },
    userId: { type: String, required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
  },
  { collection: "device_tokens", timestamps: true, versionKey: false },
);

// A token belongs to a device, so it is unique; a user can have several.
deviceTokenSchema.index({ token: 1 }, { unique: true });
deviceTokenSchema.index({ userId: 1 });

export type DeviceTokenDoc = InferSchemaType<typeof deviceTokenSchema>;

export const DeviceToken = model("DeviceToken", deviceTokenSchema);
