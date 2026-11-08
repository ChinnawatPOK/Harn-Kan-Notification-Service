import { ValidationError } from "../errors";

const NEARBY_PATH = "/internal/users/nearby";
const RADIUS_METERS = 500;
const MAX_LOCATION_AGE_MINUTES = 24 * 60;
const PAGE_SIZE = 500;
const TIMEOUT_MS = 3_000;

export type FindNearbyUserIds = (point: {
  lat: number;
  lng: number;
}) => Promise<string[]>;

export interface UserServiceClient {
  findNearbyUserIds: FindNearbyUserIds;
}

interface NearbyPage {
  data: { userIds: string[]; nextCursor: string | null };
}

export function createUserServiceClient(config: {
  url: string;
}): UserServiceClient {
  async function fetchPage(
    point: { lat: number; lng: number },
    cursor: string | null,
  ): Promise<NearbyPage["data"]> {
    const url = new URL(NEARBY_PATH, config.url);
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lng", String(point.lng));
    url.searchParams.set("radiusMeters", String(RADIUS_METERS));
    url.searchParams.set("maxAgeMinutes", String(MAX_LOCATION_AGE_MINUTES));
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 400) {
      throw new ValidationError(
        `User Service rejected the nearby query: ${url.search}`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `User Service nearby query failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as NearbyPage;
    return body.data;
  }

  return {
    async findNearbyUserIds(point) {
      const userIds: string[] = [];
      let cursor: string | null = null;
      do {
        const page: NearbyPage["data"] = await fetchPage(point, cursor);
        userIds.push(...page.userIds);
        cursor = page.nextCursor;
      } while (cursor);
      return userIds;
    },
  };
}
