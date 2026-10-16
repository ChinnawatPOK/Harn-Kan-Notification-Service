import request from 'supertest';
import { createApp } from '../src/app';
import { Notification } from '../src/models/notification.model';
import { JWT_SECRET, bearer } from './helpers/auth';
import { useTestDb } from './helpers/db';

useTestDb();
const app = createApp({ jwtSecret: JWT_SECRET });

function notification(userId: string, eventId: string, createdAt: Date) {
  return {
    eventId,
    userId,
    dealId: `deal-${eventId}`,
    category: 'DRINK',
    shopName: 'Shop',
    message: 'New DRINK deal at Shop',
    createdAt,
  };
}

describe('GET /api/notifications', () => {
  it("returns only the caller's notifications, newest first", async () => {
    await Notification.insertMany([
      notification('u1', 'old', new Date('2026-10-01')),
      notification('u1', 'new', new Date('2026-10-02')),
      notification('u2', 'other', new Date('2026-10-03')),
    ]);

    const res = await request(app).get('/api/notifications').set('Authorization', bearer('u1'));

    expect(res.status).toBe(200);
    expect(res.body.map((n: { eventId: string }) => n.eventId)).toEqual(['new', 'old']);
    expect(res.body[0]).toMatchObject({ id: expect.any(String), userId: 'u1', read: false });
  });

  it('returns an empty array when there are none', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', bearer('u1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});
