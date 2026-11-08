import type { ConsumeMessage } from 'amqplib';
import type { InsertedNotification } from '../src/dto/notification.dto';
import { createDealClosedConsumer } from '../src/messaging/dealClosed.consumer';
import { dealClosed } from './helpers/events';

function message(body: unknown): ConsumeMessage {
  const content = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return { content, fields: {}, properties: { messageId: 'evt-1' } } as unknown as ConsumeMessage;
}

function fakeChannel() {
  return { ack: jest.fn(), nack: jest.fn() };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('deal.cancelled / deal.expired consumer', () => {
  it.each(['deal.cancelled', 'deal.expired'] as const)('acks a handled %s', async (eventType) => {
    const handle = jest.fn().mockResolvedValue([]);
    const channel = fakeChannel();
    const msg = message(dealClosed({ eventType }));

    await createDealClosedConsumer(handle).onMessage(channel, msg);

    expect(handle).toHaveBeenCalledWith(dealClosed({ eventType }));
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('accepts an empty participantIds and normalises numeric ids', async () => {
    const handle = jest.fn().mockResolvedValue([]);
    const channel = fakeChannel();

    await createDealClosedConsumer(handle).onMessage(channel, message(dealClosed({ participantIds: [] })));
    await createDealClosedConsumer(handle).onMessage(
      channel,
      message({ ...dealClosed(), participantIds: [7, 'p2'] }),
    );

    expect(handle).toHaveBeenNthCalledWith(1, dealClosed({ participantIds: [] }));
    expect(handle).toHaveBeenNthCalledWith(2, dealClosed({ participantIds: ['7', 'p2'] }));
    expect(channel.ack).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a missing participantIds', { ...dealClosed(), participantIds: undefined }],
    ['a non-array participantIds', { ...dealClosed(), participantIds: 'p1' }],
    ['an empty participant id', { ...dealClosed(), participantIds: ['p1', ' '] }],
    ['a deal.created eventType', { ...dealClosed(), eventType: 'deal.created' }],
    ['a missing shopName', { ...dealClosed(), shopName: undefined }],
  ])('acks and drops a message with %s', async (_label, body) => {
    const handle = jest.fn();
    const channel = fakeChannel();
    const msg = message(body);

    await createDealClosedConsumer(handle).onMessage(channel, msg);

    expect(handle).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks with requeue on a transient error', async () => {
    const handle = jest.fn().mockRejectedValue(new Error('Mongo down'));
    const channel = fakeChannel();
    const msg = message(dealClosed());

    await createDealClosedConsumer(handle).onMessage(channel, msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});

describe('deal.closed consumer push', () => {
  const created = [{ userId: 'p1' }] as unknown as InsertedNotification[];

  it('pushes the new notifications only after the ack', async () => {
    const channel = fakeChannel();
    const push = jest.fn(async () => {
      expect(channel.ack).toHaveBeenCalled();
    });

    await createDealClosedConsumer(jest.fn().mockResolvedValue(created), push).onMessage(
      channel,
      message(dealClosed()),
    );

    expect(push).toHaveBeenCalledWith(created);
  });

  it('still acks once, without a nack, when the push fails', async () => {
    const channel = fakeChannel();
    const push = jest.fn().mockRejectedValue(new Error('Expo down'));

    await createDealClosedConsumer(jest.fn().mockResolvedValue(created), push).onMessage(
      channel,
      message(dealClosed()),
    );

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('does not push for a redelivery that created nothing', async () => {
    const push = jest.fn();
    await createDealClosedConsumer(jest.fn().mockResolvedValue([]), push).onMessage(
      fakeChannel(),
      message(dealClosed()),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('does not push when saving failed', async () => {
    const push = jest.fn();
    await createDealClosedConsumer(jest.fn().mockRejectedValue(new Error('Mongo down')), push).onMessage(
      fakeChannel(),
      message(dealClosed()),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('drain waits for a push in progress', async () => {
    let finish!: () => void;
    const push = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const consumer = createDealClosedConsumer(jest.fn().mockResolvedValue(created), push);

    void consumer.onMessage(fakeChannel(), message(dealClosed()));
    let drained = false;
    const draining = consumer.drain().then(() => (drained = true));
    await new Promise((r) => setImmediate(r));
    expect(push).toHaveBeenCalled();
    expect(drained).toBe(false);

    finish();
    await draining;
    expect(drained).toBe(true);
  });
});
