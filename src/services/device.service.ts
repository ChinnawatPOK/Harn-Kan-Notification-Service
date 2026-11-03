import {
  toDeviceResponse,
  type DeviceResponseDto,
  type RegisterDeviceDto,
} from "../dto/device.dto";
import * as deviceTokenRepository from "../repositories/deviceToken.repository";

export async function registerDevice(
  userId: string,
  dto: RegisterDeviceDto,
): Promise<DeviceResponseDto> {
  const doc = await deviceTokenRepository.upsert(dto.token, userId, dto.platform);
  return toDeviceResponse(doc);
}

/** Idempotent: an unknown token, or someone else's, is left alone. */
export async function unregisterDevice(userId: string, token: string): Promise<void> {
  await deviceTokenRepository.deleteForUser(userId, token);
}
