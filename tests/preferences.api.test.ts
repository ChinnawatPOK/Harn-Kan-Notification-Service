import request from 'supertest';
import { createApp } from '../src/app';
import { Preference } from '../src/models/preference.model';
import { JWT_SECRET, bearer, tokenFor } from './helpers/auth';
import { useTestDb } from './helpers/db';

useTestDb();
const app = createApp({ jwtSecret: JWT_SECRET });
const PATH = '/api/notifications/preferences';

describe('PUT /api/notifications/preferences', () => {
  it('saves categories for the user in the JWT and returns 200', async () => {
    const res = await request(app).put(PATH).set('Authorization', bearer('u1')).send({ categories: ['DRINK'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: 'u1', categories: ['DRINK'] });
    expect(res.body.updatedAt).toEqual(expect.any(String));
  });

  it('replaces the whole set on each save', async () => {
    await request(app).put(PATH).set('Authorization', bearer('u1')).send({ categories: ['DRINK', 'FOOD'] });
    const res = await request(app).put(PATH).set('Authorization', bearer('u1')).send({ categories: ['FOOD'] });

    expect(res.body.categories).toEqual(['FOOD']);
    expect(await Preference.countDocuments({ userId: 'u1' })).toBe(1);
  });

  it('deduplicates values', async () => {
    const res = await request(app).put(PATH).set('Authorization', bearer('u1')).send({ categories: ['DRINK', 'DRINK'] });
    expect(res.body.categories).toEqual(['DRINK']);
  });

  it('accepts an empty array to turn off all notifications', async () => {
    const res = await request(app).put(PATH).set('Authorization', bearer('u1')).send({ categories: [] });
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });

  it('ignores userId in the body and uses the JWT id', async () => {
    const res = await request(app)
      .put(PATH)
      .set('Authorization', bearer('u1'))
      .send({ categories: ['DRINK'], userId: 'someone-else', extra: true });

    expect(res.body.userId).toBe('u1');
    expect(await Preference.exists({ userId: 'someone-else' })).toBeNull();
    const saved = await Preference.findOne({ userId: 'u1' }).lean();
    expect(saved).not.toHaveProperty('extra');
  });

  it('stores numeric JWT ids as strings', async () => {
    const res = await request(app).put(PATH).set('Authorization', bearer(42)).send({ categories: ['FOOD'] });
    expect(res.body.userId).toBe('42');
  });

  it.each([
    ['missing', {}],
    ['not an array', { categories: 'DRINK' }],
    ['non-string values', { categories: ['DRINK', 1] }],
  ])('returns 400 when categories is %s', async (_label, body) => {
    const res = await request(app).put(PATH).set('Authorization', bearer('u1')).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), timestamp: expect.any(String) });
  });

  it('returns 400 naming an unknown value, with no case conversion', async () => {
    const res = await request(app).put(PATH).set('Authorization', bearer('u1')).send({ categories: ['Drink'] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('"Drink"');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .put(PATH)
      .set('Authorization', bearer('u1'))
      .set('Content-Type', 'application/json')
      .send('{"categories": [');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('authentication', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).put(PATH).send({ categories: ['DRINK'] });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 'UNAUTHORIZED', message: expect.any(String), timestamp: expect.any(String) });
  });

  it('returns 401 for a token signed with another secret', async () => {
    const res = await request(app)
      .put(PATH)
      .set('Authorization', `Bearer ${tokenFor('u1', 'wrong-secret')}`)
      .send({ categories: ['DRINK'] });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const jwt = await import('jsonwebtoken');
    const expired = jwt.sign({ id: 'u1', exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET);
    const res = await request(app).put(PATH).set('Authorization', `Bearer ${expired}`).send({ categories: [] });
    expect(res.status).toBe(401);
  });

  it('returns 401 when the token has no id claim', async () => {
    const jwt = await import('jsonwebtoken');
    const noId = jwt.sign({ sub: 'u1' }, JWT_SECRET);
    const res = await request(app).put(PATH).set('Authorization', `Bearer ${noId}`).send({ categories: [] });
    expect(res.status).toBe(401);
  });

  it('accepts the token from the "token" cookie', async () => {
    const res = await request(app)
      .put(PATH)
      .set('Cookie', `token=${tokenFor('u1')}`)
      .send({ categories: ['DRINK'] });
    expect(res.status).toBe(200);
  });

  it('prefers the Bearer header over the cookie', async () => {
    const res = await request(app)
      .put(PATH)
      .set('Authorization', bearer('from-header'))
      .set('Cookie', `token=${tokenFor('from-cookie')}`)
      .send({ categories: ['DRINK'] });
    expect(res.body.userId).toBe('from-header');
  });
});
