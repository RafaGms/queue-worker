import { Injectable } from '@nestjs/common';
import { RedisClient } from './redis.client';

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisClient) {}

  async claim(eventId: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(this.key(eventId), '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async release(eventId: string): Promise<void> {
    await this.redis.del(this.key(eventId));
  }

  private key(eventId: string): string {
    return `idempotency:${eventId}`;
  }
}
