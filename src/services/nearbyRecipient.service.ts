import type { FindNearbyUserIds } from "../clients/userService.client";
import type { DealCreatedEvent } from "../dto/dealCreated.dto";
import * as preferenceRepository from "../repositories/preference.repository";

export async function findNearbyRecipients(
  event: DealCreatedEvent,
  findNearbyUserIds: FindNearbyUserIds,
): Promise<string[]> {
  const nearbyIds = await findNearbyUserIds({ lat: event.lat, lng: event.lng });
  return preferenceRepository.findSubscriberIdsAmong(
    event.category,
    nearbyIds,
    event.creatorId,
  );
}
