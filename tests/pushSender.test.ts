import { createExpoPushSender, type PushMessage } from '../src/push/pushSender';

const sendPushNotificationsAsync = jest.fn();

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    // Two messages per chunk, so the tests can see chunking.
    chunkPushNotifications: (messages: unknown[]) => [messages.slice(0, 2), messages.slice(2)].filter((c) => c.length),
    sendPushNotificationsAsync,
  })),
}));

function message(to: string): PushMessage {
  return { to, title: 't', body: 'b', data: {} };
}

afterEach(() => sendPushNotificationsAsync.mockReset());

describe('createExpoPushSender', () => {
  it('maps each ticket to its token, in order, and adds a sound', async () => {
    sendPushNotificationsAsync
      .mockResolvedValueOnce([
        { status: 'ok', id: 'r1' },
        { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
      ])
      .mockResolvedValueOnce([{ status: 'error', message: 'Something odd' }]);

    const results = await createExpoPushSender().send([message('a'), message('b'), message('c')]);

    expect(results).toEqual([
      { token: 'a', ok: true },
      { token: 'b', ok: false, error: 'DeviceNotRegistered' },
      { token: 'c', ok: false, error: 'Something odd' },
    ]);
    expect(sendPushNotificationsAsync.mock.calls[0][0][0]).toMatchObject({ to: 'a', sound: 'default' });
  });

  it('marks every message in a chunk failed when its request fails, and keeps going', async () => {
    sendPushNotificationsAsync
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce([{ status: 'ok', id: 'r3' }]);

    const results = await createExpoPushSender().send([message('a'), message('b'), message('c')]);

    expect(results).toEqual([
      { token: 'a', ok: false, error: 'timeout' },
      { token: 'b', ok: false, error: 'timeout' },
      { token: 'c', ok: true },
    ]);
  });
});
