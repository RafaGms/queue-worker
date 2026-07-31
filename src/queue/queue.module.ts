import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DlqProcessor } from './dlq.processor';
import { IdempotencyService } from './idempotency.service';
import { PAYMENTS_DLQ, PAYMENTS_QUEUE } from './queue.constants';
import { RedisClient } from './redis.client';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: PAYMENTS_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({ name: PAYMENTS_DLQ }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: PAYMENTS_QUEUE, adapter: BullMQAdapter },
      { name: PAYMENTS_DLQ, adapter: BullMQAdapter },
    ),
  ],
  providers: [DlqProcessor, RedisClient, IdempotencyService],
  exports: [BullModule, IdempotencyService],
})
export class QueueModule {}
