import { Notification } from '../src/models/notification.model';
import type { Category } from '../src/constants/categories';
import { Preference } from '../src/models/preference.model';
import { createForDeal } from '../src/services/notification.service';
import { useTestDb } from './helpers/db';
import { dealCreated } from './helpers/events';

useTestDb();

async function subscribe(userId: string, categories: Category[]) {
  await Preference.create({ userId, notification_prefs: categories });
}

function nearby(...userIds: string[]) {
  return async () => userIds;
}

describe('createForDeal', () => {
  it('notifies nearby subscribers of the category, except the creator', async () => {
    await subscribe('drinker', ['DRINK']);
    await subscribe('both', ['DRINK', 'FOOD']);
    await subscribe('eater', ['FOOD']);
    await subscribe('creator', ['DRINK']);
    await subscribe('off', []);
    await subscribe('far-away', ['DRINK']);

    const created = await createForDeal(
      dealCreated(),
      nearby('drinker', 'both', 'eater', 'creator', 'off', 'no-preferences'),
    );

    expect(created).toHaveLength(2);
    const users = (await Notification.find().lean()).map((n) => n.userId).sort();
    expect(users).toEqual(['both', 'drinker']);
    const one = await Notification.findOne({ userId: 'drinker' }).lean();
    expect(one).toMatchObject({
      eventId: 'evt-1',
      type: 'DEAL_CREATED',
      dealId: 'deal-1',
      category: 'DRINK',
      shopName: 'Cafe Amazon',
      message: 'มีดีลใหม่ใกล้คุณที่ Cafe Amazon',
      read: false,
    });
  });

  it('looks up users near the deal', async () => {
    const findNearbyUserIds = jest.fn().mockResolvedValue([]);

    await createForDeal(dealCreated({ lat: 13.1, lng: 100.2 }), findNearbyUserIds);

    expect(findNearbyUserIds).toHaveBeenCalledWith({ lat: 13.1, lng: 100.2 });
  });

  it('does nothing when nobody subscribed', async () => {
    await subscribe('eater', ['FOOD']);
    expect(await createForDeal(dealCreated(), nearby('eater'))).toHaveLength(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('does nothing when nobody is nearby', async () => {
    await subscribe('drinker', ['DRINK']);
    expect(await createForDeal(dealCreated(), nearby())).toHaveLength(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('creates nothing and rethrows when the nearby lookup fails', async () => {
    await subscribe('drinker', ['DRINK']);
    const findNearbyUserIds = jest.fn().mockRejectedValue(new Error('User Service down'));

    await expect(createForDeal(dealCreated(), findNearbyUserIds)).rejects.toThrow('User Service down');
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('is idempotent when the same event is delivered twice', async () => {
    await subscribe('a', ['DRINK']);
    await subscribe('b', ['DRINK']);

    expect(await createForDeal(dealCreated(), nearby('a', 'b'))).toHaveLength(2);
    expect(await createForDeal(dealCreated(), nearby('a', 'b'))).toHaveLength(0);
    expect(await Notification.countDocuments()).toBe(2);
  });

  it('fills in missing users on redelivery after a partial insert', async () => {
    for (const id of ['a', 'b', 'c', 'd']) await subscribe(id, ['DRINK']);
    // Simulate a crash after 2 of 4 inserts.
    await Notification.insertMany(
      ['a', 'b'].map((userId) => ({
        eventId: 'evt-1',
        userId,
        dealId: 'deal-1',
        category: 'DRINK',
        shopName: 'Cafe Amazon',
        message: 'm',
      })),
    );

    const created = await createForDeal(dealCreated(), nearby('a', 'b', 'c', 'd'));
    expect(created.map((n) => n.userId).sort()).toEqual(['c', 'd']);
    expect(created[0]._id).toBeDefined();
    const users = (await Notification.find({ eventId: 'evt-1' }).lean()).map((n) => n.userId).sort();
    expect(users).toEqual(['a', 'b', 'c', 'd']);
  });

  it('notifies the same user again for a different event', async () => {
    await subscribe('a', ['DRINK']);
    await createForDeal(dealCreated({ eventId: 'evt-1' }), nearby('a'));
    await createForDeal(dealCreated({ eventId: 'evt-2', dealId: 'deal-2' }), nearby('a'));
    expect(await Notification.countDocuments({ userId: 'a' })).toBe(2);
  });

  it('rethrows errors that are not duplicate keys', async () => {
    await subscribe('a', ['DRINK']);
    const spy = jest.spyOn(Notification, 'insertMany').mockRejectedValueOnce(new Error('connection lost'));

    await expect(createForDeal(dealCreated(), nearby('a'))).rejects.toThrow('connection lost');
    spy.mockRestore();
  });
});
