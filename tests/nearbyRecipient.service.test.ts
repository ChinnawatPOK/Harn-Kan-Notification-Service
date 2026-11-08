import type { Category } from '../src/constants/categories';
import { Preference } from '../src/models/preference.model';
import { findNearbyRecipients } from '../src/services/nearbyRecipient.service';
import { useTestDb } from './helpers/db';
import { dealCreated } from './helpers/events';

useTestDb();

async function subscribe(userId: string, categories: Category[]) {
  await Preference.create({ userId, notification_prefs: categories });
}

function nearby(...userIds: string[]) {
  return async () => userIds;
}

describe('findNearbyRecipients', () => {
  it('keeps nearby users who subscribe to the category', async () => {
    await subscribe('near-drink', ['DRINK']);
    await subscribe('near-both', ['DRINK', 'FOOD']);
    await subscribe('near-food', ['FOOD']);
    await subscribe('near-off', []);
    await subscribe('far-drink', ['DRINK']);

    const recipients = await findNearbyRecipients(
      dealCreated(),
      nearby('near-drink', 'near-both', 'near-food', 'near-off', 'near-never-saved'),
    );

    expect(recipients.sort()).toEqual(['near-both', 'near-drink']);
  });

  it('never includes the creator, even when nearby and subscribed', async () => {
    await subscribe('creator', ['DRINK']);

    expect(await findNearbyRecipients(dealCreated(), nearby('creator'))).toEqual([]);
  });

  it('returns nobody when nobody is nearby', async () => {
    await subscribe('far-drink', ['DRINK']);

    expect(await findNearbyRecipients(dealCreated(), nearby())).toEqual([]);
  });

  it('passes the deal coordinates to the lookup', async () => {
    const findNearbyUserIds = jest.fn().mockResolvedValue([]);

    await findNearbyRecipients(dealCreated({ lat: 13.1, lng: 100.2 }), findNearbyUserIds);

    expect(findNearbyUserIds).toHaveBeenCalledWith({ lat: 13.1, lng: 100.2 });
  });

  it('lets a lookup failure reach the caller', async () => {
    const findNearbyUserIds = jest.fn().mockRejectedValue(new Error('User Service down'));

    await expect(findNearbyRecipients(dealCreated(), findNearbyUserIds)).rejects.toThrow('User Service down');
  });
});
