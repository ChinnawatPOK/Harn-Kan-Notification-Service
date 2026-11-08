import { createUserServiceClient } from '../src/clients/userService.client';
import { ValidationError } from '../src/errors';

const POINT = { lat: 13.7563, lng: 100.5018 };

function page(userIds: string[], nextCursor: string | null = null) {
  return new Response(JSON.stringify({ success: true, data: { userIds, nextCursor } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function client() {
  return createUserServiceClient({ url: 'http://user-service:3000' });
}

function requestedUrl(fetchSpy: jest.SpyInstance, call = 0): URL {
  return fetchSpy.mock.calls[call][0] as URL;
}

describe('User Service client', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('asks for users within 500 m with a location from the last 24 hours', async () => {
    fetchSpy.mockResolvedValueOnce(page(['a']));

    expect(await client().findNearbyUserIds(POINT)).toEqual(['a']);

    const url = requestedUrl(fetchSpy);
    expect(url.origin + url.pathname).toBe('http://user-service:3000/internal/users/nearby');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '13.7563',
      lng: '100.5018',
      radiusMeters: '500',
      maxAgeMinutes: '1440',
      limit: '500',
    });
  });

  it('sets a timeout on the request', async () => {
    fetchSpy.mockResolvedValueOnce(page([]));

    await client().findNearbyUserIds(POINT);

    expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('returns an empty list when nobody is nearby', async () => {
    fetchSpy.mockResolvedValueOnce(page([]));

    expect(await client().findNearbyUserIds(POINT)).toEqual([]);
  });

  it('follows the cursor through every page', async () => {
    fetchSpy
      .mockResolvedValueOnce(page(['a', 'b'], 'b'))
      .mockResolvedValueOnce(page(['c', 'd'], 'd'))
      .mockResolvedValueOnce(page(['e']));

    expect(await client().findNearbyUserIds(POINT)).toEqual(['a', 'b', 'c', 'd', 'e']);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(requestedUrl(fetchSpy, 0).searchParams.has('cursor')).toBe(false);
    expect(requestedUrl(fetchSpy, 1).searchParams.get('cursor')).toBe('b');
    expect(requestedUrl(fetchSpy, 2).searchParams.get('cursor')).toBe('d');
  });

  it('throws rather than returning a partial list when a later page fails', async () => {
    fetchSpy
      .mockResolvedValueOnce(page(['a'], 'a'))
      .mockResolvedValueOnce(new Response('', { status: 503 }));

    await expect(client().findNearbyUserIds(POINT)).rejects.toThrow('status 503');
  });

  it('throws ValidationError on a 400', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 400 }));

    await expect(client().findNearbyUserIds(POINT)).rejects.toBeInstanceOf(ValidationError);
  });

  it.each([404, 500, 503])('throws a retryable error on a %i', async (status) => {
    fetchSpy.mockResolvedValueOnce(new Response('', { status }));

    const error = await client().findNearbyUserIds(POINT).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ValidationError);
  });

  it('throws a retryable error when the request times out', async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));

    const error = await client().findNearbyUserIds(POINT).catch((err: unknown) => err);

    expect(error).not.toBeInstanceOf(ValidationError);
    expect((error as Error).name).toBe('TimeoutError');
  });
});
