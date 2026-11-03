import {
  toPreferenceResponse,
  type PreferenceResponseDto,
  type UpdatePreferencesDto,
} from "../dto/preference.dto";
import * as preferenceRepository from "../repositories/preference.repository";

export async function replacePreferences(
  userId: string,
  dto: UpdatePreferencesDto,
): Promise<PreferenceResponseDto> {
  const doc = await preferenceRepository.upsertCategories(
    userId,
    dto.categories,
  );
  return toPreferenceResponse(doc);
}

export async function getPreferences(
  userId: string,
): Promise<PreferenceResponseDto> {
  const doc = await preferenceRepository.findByUserId(userId);
  if (!doc) return { userId, categories: [], updatedAt: null };
  return toPreferenceResponse(doc);
}
