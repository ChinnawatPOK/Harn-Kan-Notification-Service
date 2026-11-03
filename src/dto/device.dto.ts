import { Expo } from "expo-server-sdk";
import { z } from "zod";
import { PLATFORMS, type Platform } from "../models/deviceToken.model";

/** Body of PUT /api/notifications/devices. */
export const registerDeviceSchema = z.object(
  {
    token: z
      .string({ error: 'Field "token" is required and must be a string' })
      .refine((v) => Expo.isExpoPushToken(v), {
        error: 'Field "token" must be an Expo push token, e.g. ExponentPushToken[...]',
      }),
    platform: z.enum(PLATFORMS, {
      error: `Field "platform" must be one of: ${PLATFORMS.join(", ")}`,
    }),
  },
  { error: "Request body must be a JSON object" },
);

export type RegisterDeviceDto = z.output<typeof registerDeviceSchema>;

/** Response of PUT /api/notifications/devices. */
export interface DeviceResponseDto {
  token: string;
  userId: string;
  platform: Platform;
  updatedAt: Date;
}

export function toDeviceResponse(doc: {
  token: string;
  userId: string;
  platform: string;
  updatedAt: Date;
}): DeviceResponseDto {
  return {
    token: doc.token,
    userId: doc.userId,
    platform: doc.platform as Platform,
    updatedAt: doc.updatedAt,
  };
}
