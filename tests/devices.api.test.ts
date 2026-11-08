import request from 'supertest';
import { createApp } from '../src/app';
import { DeviceToken } from '../src/models/deviceToken.model';
import { JWT_SECRET, bearer } from './helpers/auth';
import { useTestDb } from './helpers/db';

useTestDb();
const app = createApp({ jwtSecret: JWT_SECRET });
const PATH = '/api/notifications/devices';
const TOKEN = 'ExponentPushToken[abcdefghijklmnopqrstuv]';

function register(userId: string, body: unknown = { token: TOKEN, platform: 'ios' }) {
  return request(app).put(PATH).set('Authorization', bearer(userId)).send(body as object);
}

function unregister(userId: string, token = TOKEN) {
  return request(app).delete(`${PATH}/${encodeURIComponent(token)}`).set('Authorization', bearer(userId));
}

describe('PUT /api/notifications/devices', () => {
  it('registers the token for the user in the JWT', async () => {
    const res = await register('u1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: TOKEN,
      userId: 'u1',
      platform: 'ios',
      updatedAt: expect.any(String),
    });
    expect(await DeviceToken.countDocuments({ token: TOKEN, userId: 'u1' })).toBe(1);
  });

  it('keeps one record when the same device registers again', async () => {
    await register('u1');
    await register('u1');
    expect(await DeviceToken.countDocuments()).toBe(1);
  });

  it('moves the token to the new user when accounts switch on one device', async () => {
    await register('u1');
    await register('u2', { token: TOKEN, platform: 'android' });

    const docs = await DeviceToken.find().lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ userId: 'u2', platform: 'android' });
  });

  it('lets one user register several devices', async () => {
    await register('u1');
    await register('u1', { token: 'ExpoPushToken[second-device-token]', platform: 'android' });
    expect(await DeviceToken.countDocuments({ userId: 'u1' })).toBe(2);
  });

  it.each([
    ['a token that is not an Expo push token', { token: 'abc', platform: 'ios' }, '"token" must be an Expo push token'],
    ['a missing token', { platform: 'ios' }, '"token" is required'],
    ['an unknown platform', { token: TOKEN, platform: 'web' }, '"platform" must be one of: ios, android'],
  ])('returns 400 for %s', async (_label, body, message) => {
    const res = await register('u1', body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining(message) });
    expect(await DeviceToken.countDocuments()).toBe(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).put(PATH).send({ token: TOKEN, platform: 'ios' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/notifications/devices/:token', () => {
  it("removes the caller's token", async () => {
    await register('u1');

    const res = await unregister('u1');

    expect(res.status).toBe(204);
    expect(await DeviceToken.countDocuments()).toBe(0);
  });

  it("returns 204 but keeps someone else's token", async () => {
    await register('u2');

    const res = await unregister('u1');

    expect(res.status).toBe(204);
    expect(await DeviceToken.countDocuments({ userId: 'u2' })).toBe(1);
  });

  it('returns 204 for an unknown token', async () => {
    const res = await unregister('u1', 'ExponentPushToken[never-registered]');
    expect(res.status).toBe(204);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`${PATH}/${encodeURIComponent(TOKEN)}`);
    expect(res.status).toBe(401);
  });
});
