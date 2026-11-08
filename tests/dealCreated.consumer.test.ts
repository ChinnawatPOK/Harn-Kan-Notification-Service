import type { ConsumeMessage } from 'amqplib';
import type { InsertedNotification } from '../src/dto/notification.dto';
import { ValidationError } from '../src/errors';
import { createDealCreatedConsumer } from '../src/messaging/dealCreated.consumer';
import { dealCreated } from './helpers/events';

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

describe('deal.created consumer', () => {
  it('acks after a successful fan-out', async () => {
    const handle = jest.fn().mockResolvedValue([]);
    const channel = fakeChannel();
    const msg = message(dealCreated());

    await createDealCreatedConsumer(handle).onMessage(channel, msg);

    expect(handle).toHaveBeenCalledWith(dealCreated());
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('ignores unknown fields and normalises numeric ids to strings', async () => {
    const handle = jest.fn().mockResolvedValue([]);
    await createDealCreatedConsumer(handle).onMessage(
      fakeChannel(),
      message({ ...dealCreated(), creatorId: 7, dealId: 99, somethingNew: 'x' }),
    );

    expect(handle).toHaveBeenCalledWith(dealCreated({ creatorId: '7', dealId: '99' }));
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a JSON array', '[]'],
    ['a missing field', { ...dealCreated(), shopName: undefined }],
    ['a non-numeric lat', { ...dealCreated(), lat: '13.7' }],
    ['a wrong eventType', { ...dealCreated(), eventType: 'deal.updated' }],
    ['a lowercase category', { ...dealCreated(), category: 'drink' }],
  ])('acks and drops a message with %s', async (_label, body) => {
    const handle = jest.fn();
    const channel = fakeChannel();
    const msg = message(body);

    await createDealCreatedConsumer(handle).onMessage(channel, msg);

    expect(handle).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('logs the missing field rather than the category when fields are missing', async () => {
    await createDealCreatedConsumer(jest.fn()).onMessage(
      fakeChannel(),
      message({ eventId: 'bad-1', eventType: 'deal.created' }),
    );

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"occurredAt" is required'));
  });

  it('nacks with requeue on a transient error', async () => {
    const handle = jest.fn().mockRejectedValue(new Error('Mongo down'));
    const channel = fakeChannel();
    const msg = message(dealCreated());

    await createDealCreatedConsumer(handle).onMessage(channel, msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('does not throw if the channel closed before ack', async () => {
    const channel = fakeChannel();
    channel.ack.mockImplementation(() => {
      throw new Error('Channel closed');
    });

    await expect(
      createDealCreatedConsumer(jest.fn().mockResolvedValue([])).onMessage(channel, message(dealCreated())),
    ).resolves.toBeUndefined();
  });

  it('drain waits for in-flight messages', async () => {
    let finish!: () => void;
    const handle = jest.fn(() => new Promise<InsertedNotification[]>((resolve) => (finish = () => resolve([]))));
    const channel = fakeChannel();
    const consumer = createDealCreatedConsumer(handle);

    void consumer.onMessage(channel, message(dealCreated()));
    const drained = consumer.drain();
    await Promise.resolve();
    expect(channel.ack).not.toHaveBeenCalled();

    finish();
    await drained;
    expect(channel.ack).toHaveBeenCalled();
  });

  it('acks and drops when handling reports the event can never succeed', async () => {
    const handle = jest.fn().mockRejectedValue(new ValidationError('bad coordinates'));
    const channel = fakeChannel();
    const msg = message(dealCreated());

    await createDealCreatedConsumer(handle).onMessage(channel, msg);

    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });
});

describe('deal.created consumer push', () => {
  const created = [{ userId: 'u1' }] as unknown as InsertedNotification[];

  it('pushes the new notifications only after the ack', async () => {
    const channel = fakeChannel();
    const push = jest.fn(async () => {
      expect(channel.ack).toHaveBeenCalled();
    });

    await createDealCreatedConsumer(jest.fn().mockResolvedValue(created), push).onMessage(
      channel,
      message(dealCreated()),
    );

    expect(push).toHaveBeenCalledWith(created);
  });

  it('still acks once, without a nack, when the push fails', async () => {
    const channel = fakeChannel();
    const push = jest.fn().mockRejectedValue(new Error('Expo down'));

    await createDealCreatedConsumer(jest.fn().mockResolvedValue(created), push).onMessage(
      channel,
      message(dealCreated()),
    );

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('does not push for a redelivery that created nothing', async () => {
    const push = jest.fn();

    await createDealCreatedConsumer(jest.fn().mockResolvedValue([]), push).onMessage(
      fakeChannel(),
      message(dealCreated()),
    );

    expect(push).not.toHaveBeenCalled();
  });

  it('does not push when the nearby lookup failed', async () => {
    const channel = fakeChannel();
    const push = jest.fn();
    const msg = message(dealCreated());

    await createDealCreatedConsumer(jest.fn().mockRejectedValue(new Error('User Service down')), push).onMessage(
      channel,
      msg,
    );

    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
    expect(push).not.toHaveBeenCalled();
  });
});
