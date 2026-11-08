import { Types } from 'mongoose';
import type { InsertedNotification } from '../src/dto/notification.dto';
import { DeviceToken } from '../src/models/deviceToken.model';
import type { PushMessage, PushResult, PushSender } from '../src/push/pushSender';
import { pushNotifications } from '../src/services/push.service';
import { useTestDb } from './helpers/db';

useTestDb();

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

function notification(userId: string, overrides: Partial<InsertedNotification> = {}): InsertedNotification {
  return {
    _id: new Types.ObjectId(),
    eventId: 'evt-1',
    userId,
    type: 'DEAL_CANCELLED',
    dealId: 'deal-1',
    category: 'FOOD',
    shopName: 'Pizza',
    message: 'ดีล Pizza ถูกยกเลิก กำลังคืนเงินให้คุณ',
    ...overrides,
  };
}

/** Answers each message with the given result for its token, or ok. */
function fakeSender(errors: Record<string, string> = {}) {
  const send = jest.fn(async (messages: PushMessage[]): Promise<PushResult[]> =>
    messages.map((m) => (errors[m.to] ? { token: m.to, ok: false, error: errors[m.to] } : { token: m.to, ok: true })),
  );
  return { send } satisfies PushSender;
}

async function device(userId: string, token: string) {
  await DeviceToken.create({ userId, token, platform: 'ios' });
}

describe('pushNotifications', () => {
  it('sends one message per device of each recipient', async () => {
    await device('p1', 'ExponentPushToken[p1-phone]');
    await device('p1', 'ExponentPushToken[p1-tablet]');
    await device('p2', 'ExponentPushToken[p2-phone]');
    await device('other', 'ExponentPushToken[other-phone]');
    const sender = fakeSender();
    const n1 = notification('p1');

    const summary = await pushNotifications(sender, [n1, notification('p2')]);

    expect(summary).toEqual({ sent: 3, failed: 0, removed: 0 });
    const messages = sender.send.mock.calls[0][0];
    expect(messages.map((m) => m.to).sort()).toEqual([
      'ExponentPushToken[p1-phone]',
      'ExponentPushToken[p1-tablet]',
      'ExponentPushToken[p2-phone]',
    ]);
    expect(messages.find((m) => m.to === 'ExponentPushToken[p1-phone]')).toEqual({
      to: 'ExponentPushToken[p1-phone]',
      title: 'ดีลถูกยกเลิก',
      body: 'ดีล Pizza ถูกยกเลิก กำลังคืนเงินให้คุณ',
      data: { type: 'DEAL_CANCELLED', dealId: 'deal-1', notificationId: String(n1._id) },
    });
  });

  it('uses the expired title for DEAL_EXPIRED', async () => {
    await device('p1', 'ExponentPushToken[p1-phone]');
    const sender = fakeSender();

    await pushNotifications(sender, [notification('p1', { type: 'DEAL_EXPIRED' })]);

    expect(sender.send.mock.calls[0][0][0].title).toBe('ดีลหมดเวลา');
  });

  it('does not call the sender when no recipient has a device', async () => {
    const sender = fakeSender();
    expect(await pushNotifications(sender, [notification('p1')])).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('deletes tokens reported as DeviceNotRegistered and keeps other failures', async () => {
    await device('p1', 'ExponentPushToken[gone]');
    await device('p1', 'ExponentPushToken[rate-limited]');
    await device('p1', 'ExponentPushToken[fine]');
    const sender = fakeSender({
      'ExponentPushToken[gone]': 'DeviceNotRegistered',
      'ExponentPushToken[rate-limited]': 'MessageRateExceeded',
    });

    const summary = await pushNotifications(sender, [notification('p1')]);

    expect(summary).toEqual({ sent: 1, failed: 2, removed: 1 });
    const left = (await DeviceToken.find().lean()).map((d) => d.token).sort();
    expect(left).toEqual(['ExponentPushToken[fine]', 'ExponentPushToken[rate-limited]']);
  });

  it('never throws when the sender fails', async () => {
    await device('p1', 'ExponentPushToken[p1-phone]');
    const sender = { send: jest.fn().mockRejectedValue(new Error('Expo down')) };

    await expect(pushNotifications(sender, [notification('p1')])).resolves.toEqual({
      sent: 0,
      failed: 0,
      removed: 0,
    });
    expect(await DeviceToken.countDocuments()).toBe(1);
  });
});
