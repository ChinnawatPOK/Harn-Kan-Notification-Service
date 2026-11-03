import { Notification } from '../src/models/notification.model';
import { Preference } from '../src/models/preference.model';
import { createForParticipants } from '../src/services/notification.service';
import { useTestDb } from './helpers/db';
import { dealClosed } from './helpers/events';

useTestDb();

describe('createForParticipants', () => {
  it('notifies every participant of a cancelled deal, ignoring preferences', async () => {
    await Preference.create({ userId: 'p1', notification_prefs: [] });

    const created = await createForParticipants(dealClosed());

    expect(created).toBe(2);
    const docs = await Notification.find().sort({ userId: 1 }).lean();
    expect(docs.map((n) => n.userId)).toEqual(['p1', 'p2']);
    expect(docs[0]).toMatchObject({
      eventId: 'evt-1',
      type: 'DEAL_CANCELLED',
      dealId: 'deal-1',
      category: 'DRINK',
      shopName: 'Cafe Amazon',
      message: 'ดีล Cafe Amazon ถูกยกเลิก กำลังคืนเงินให้คุณ',
      read: false,
    });
  });

  it('uses the expired type and message for deal.expired', async () => {
    await createForParticipants(dealClosed({ eventType: 'deal.expired', participantIds: ['p1'] }));

    expect(await Notification.findOne({ userId: 'p1' }).lean()).toMatchObject({
      type: 'DEAL_EXPIRED',
      message: 'ดีล Cafe Amazon หมดเวลา กำลังคืนเงินให้คุณ',
    });
  });

  it('does nothing for an empty participantIds', async () => {
    expect(await createForParticipants(dealClosed({ participantIds: [] }))).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('is idempotent when the same event is delivered twice', async () => {
    expect(await createForParticipants(dealClosed())).toBe(2);
    expect(await createForParticipants(dealClosed())).toBe(0);
    expect(await Notification.countDocuments()).toBe(2);
  });
});
