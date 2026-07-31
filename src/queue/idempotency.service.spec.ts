import { IdempotencyService } from './idempotency.service';
import { RedisClient } from './redis.client';

describe('IdempotencyService', () => {
  let redis: { set: jest.Mock; del: jest.Mock };
  let service: IdempotencyService;

  beforeEach(() => {
    redis = { set: jest.fn(), del: jest.fn() };
    service = new IdempotencyService(redis as unknown as RedisClient);
  });

  it('claims a fresh event id with SET NX and the given ttl', async () => {
    redis.set.mockResolvedValueOnce('OK');

    await expect(service.claim('event-1', 60)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('idempotency:event-1', '1', 'EX', 60, 'NX');
  });

  it('does not claim an event id that was already seen', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(service.claim('event-1', 60)).resolves.toBe(true);
    await expect(service.claim('event-1', 60)).resolves.toBe(false);
  });

  it('releases a claim so the event id can be retried', async () => {
    redis.del.mockResolvedValueOnce(1);

    await service.release('event-1');
    expect(redis.del).toHaveBeenCalledWith('idempotency:event-1');
  });
});
