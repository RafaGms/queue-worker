import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { IdempotencyService } from '../queue/idempotency.service';
import {
  DEAD_PAYMENT_JOB,
  PAYMENTS_DLQ,
  PAYMENTS_QUEUE,
} from '../queue/queue.constants';
import { PaymentGatewayMock } from './payment-gateway.mock';

interface PaymentJobData {
  paymentId: string;
  eventId: string;
  amount: number;
  currency: string;
}

@Processor(PAYMENTS_QUEUE)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);
  private readonly idempotencyTtl: number;

  constructor(
    private readonly gateway: PaymentGatewayMock,
    private readonly idempotency: IdempotencyService,
    config: ConfigService,
    @InjectQueue(PAYMENTS_DLQ) private readonly dlq: Queue,
  ) {
    super();
    this.idempotencyTtl = config.getOrThrow<number>('IDEMPOTENCY_TTL');
  }

  async process(job: Job<PaymentJobData>): Promise<void> {
    const { paymentId, eventId, amount, currency } = job.data;

    const claimed = await this.idempotency.claim(eventId, this.idempotencyTtl);
    if (!claimed) {
      this.logger.log(`skipping duplicate event ${eventId} (payment ${paymentId})`);
      return;
    }

    this.logger.log(`processing payment ${paymentId} (${amount} ${currency})`);

    try {
      const { transactionId } = await this.gateway.charge({ paymentId, amount, currency });
      this.logger.log(`payment ${paymentId} approved (tx ${transactionId})`);
    } catch (error) {
      await this.idempotency.release(eventId);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PaymentJobData>): Promise<void> {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) {
      return;
    }

    await this.dlq.add(DEAD_PAYMENT_JOB, {
      ...job.data,
      reason: job.failedReason,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });
  }
}
