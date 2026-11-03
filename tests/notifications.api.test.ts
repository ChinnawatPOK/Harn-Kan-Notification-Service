import request from 'supertest';
import { createApp } from '../src/app';
import { Notification } from '../src/models/notification.model';
import { JWT_SECRET, bearer } from './helpers/auth';
import { useTestDb } from './helpers/db';

useTestDb();
const app = createApp({ jwtSecret: JWT_SECRET });

function notification(userId: string, eventId: string, createdAt: Date, read = false) {
  return {
    eventId,
    userId,
    dealId: `deal-${eventId}`,
    category: 'DRINK',
    shopName: 'Shop',
    message: 'New DRINK deal at Shop',
    read,
    createdAt,
  };
}

describe('GET /api/notifications', () => {
  it("returns only the caller's notifications, newest first, with the unread count", async () => {
    await Notification.insertMany([
      notification('u1', 'old', new Date('2026-10-01'), true),
      notification('u1', 'new', new Date('2026-10-02')),
      notification('u2', 'other', new Date('2026-10-03')),
    ]);

    const res = await request(app).get('/api/notifications').set('Authorization', bearer('u1'));

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.items.map((n: { eventId: string }) => n.eventId)).toEqual(['new', 'old']);
    expect(res.body.items[0]).toMatchObject({
      id: expect.any(String),
      userId: 'u1',
      type: 'DEAL_CREATED',
      read: false,
    });
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ['category', 'createdAt', 'dealId', 'eventId', 'id', 'message', 'read', 'shopName', 'type', 'updatedAt', 'userId'],
    );
  });

  it('reports DEAL_CREATED for documents saved before the type field existed', async () => {
    await Notification.collection.insertOne({
      ...notification('u1', 'legacy', new Date('2026-10-01')),
      updatedAt: new Date('2026-10-01'),
    });

    const res = await request(app).get('/api/notifications').set('Authorization', bearer('u1'));

    expect(res.body.items[0].type).toBe('DEAL_CREATED');
  });

  it('returns an empty list when there are none', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', bearer('u1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unreadCount: 0, items: [] });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  async function seed(userId = 'u1') {
    const [doc] = await Notification.insertMany([notification(userId, 'evt', new Date('2026-10-01'))]);
    return String(doc._id);
  }

  it('marks the notification read and returns it', async () => {
    const id = await seed();

    const res = await request(app).patch(`/api/notifications/${id}/read`).set('Authorization', bearer('u1'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, userId: 'u1', read: true });
    expect(await Notification.findById(id).lean()).toHaveProperty('read', true);
  });

  it('gives the same result when repeated', async () => {
    const id = await seed();
    const path = `/api/notifications/${id}/read`;

    await request(app).patch(path).set('Authorization', bearer('u1'));
    const res = await request(app).patch(path).set('Authorization', bearer('u1'));

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  it("returns 404 for someone else's notification and leaves it unread", async () => {
    const id = await seed('u2');

    const res = await request(app).patch(`/api/notifications/${id}/read`).set('Authorization', bearer('u1'));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(await Notification.findById(id).lean()).toHaveProperty('read', false);
  });

  it.each([
    ['an unknown id', '6720f0c1e4b0a1b2c3d4e5f6'],
    ['a malformed id', 'not-an-id'],
  ])('returns 404 for %s', async (_label, id) => {
    const res = await request(app).patch(`/api/notifications/${id}/read`).set('Authorization', bearer('u1'));
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND', timestamp: expect.any(String) });
  });

  it('returns 401 without a token', async () => {
    const id = await seed();
    const res = await request(app).patch(`/api/notifications/${id}/read`);
    expect(res.status).toBe(401);
  });
});
