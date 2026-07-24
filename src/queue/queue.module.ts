import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DlqProcessor } from './dlq.processor';
import { PAYMENTS_DLQ, PAYMENTS_QUEUE } from './queue.constants';

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
  ],
  providers: [DlqProcessor],
  exports: [BullModule],
})
export class QueueModule {}
