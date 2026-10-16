import { Notification } from '../src/models/notification.model';
import type { Category } from '../src/constants/categories';
import { Preference } from '../src/models/preference.model';
import { createForDeal } from '../src/services/notification.service';
import { useTestDb } from './helpers/db';
import { dealCreated } from './helpers/events';

useTestDb();

async function subscribe(userId: string, categories: Category[]) {
  await Preference.create({ userId, categories });
}

describe('createForDeal', () => {
  it('notifies subscribers of the category, except the creator', async () => {
    await subscribe('drinker', ['DRINK']);
    await subscribe('both', ['DRINK', 'FOOD']);
    await subscribe('eater', ['FOOD']);
    await subscribe('creator', ['DRINK']);
    await subscribe('off', []);

    const created = await createForDeal(dealCreated());

    expect(created).toBe(2);
    const users = (await Notification.find().lean()).map((n) => n.userId).sort();
    expect(users).toEqual(['both', 'drinker']);
    const one = await Notification.findOne({ userId: 'drinker' }).lean();
    expect(one).toMatchObject({
      eventId: 'evt-1',
      dealId: 'deal-1',
      category: 'DRINK',
      shopName: 'Cafe Amazon',
      read: false,
    });
  });

  it('does nothing when nobody subscribed', async () => {
    await subscribe('eater', ['FOOD']);
    expect(await createForDeal(dealCreated())).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('is idempotent when the same event is delivered twice', async () => {
    await subscribe('a', ['DRINK']);
    await subscribe('b', ['DRINK']);

    expect(await createForDeal(dealCreated())).toBe(2);
    expect(await createForDeal(dealCreated())).toBe(0);
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

    expect(await createForDeal(dealCreated())).toBe(2);
    const users = (await Notification.find({ eventId: 'evt-1' }).lean()).map((n) => n.userId).sort();
    expect(users).toEqual(['a', 'b', 'c', 'd']);
  });

  it('notifies the same user again for a different event', async () => {
    await subscribe('a', ['DRINK']);
    await createForDeal(dealCreated({ eventId: 'evt-1' }));
    await createForDeal(dealCreated({ eventId: 'evt-2', dealId: 'deal-2' }));
    expect(await Notification.countDocuments({ userId: 'a' })).toBe(2);
  });

  it('rethrows errors that are not duplicate keys', async () => {
    await subscribe('a', ['DRINK']);
    const spy = jest.spyOn(Notification, 'insertMany').mockRejectedValueOnce(new Error('connection lost'));

    await expect(createForDeal(dealCreated())).rejects.toThrow('connection lost');
    spy.mockRestore();
  });
});
