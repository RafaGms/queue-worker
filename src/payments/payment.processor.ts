import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  DEAD_PAYMENT_JOB,
  PAYMENTS_DLQ,
  PAYMENTS_QUEUE,
} from '../queue/queue.constants';
import { PaymentGatewayMock } from './payment-gateway.mock';

interface PaymentJobData {
  paymentId: string;
  amount: number;
  currency: string;
}

@Processor(PAYMENTS_QUEUE)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    private readonly gateway: PaymentGatewayMock,
    @InjectQueue(PAYMENTS_DLQ) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<void> {
    const { paymentId, amount, currency } = job.data;

    this.logger.log(`processing payment ${paymentId} (${amount} ${currency})`);

    const { transactionId } = await this.gateway.charge({ paymentId, amount, currency });

    this.logger.log(`payment ${paymentId} approved (tx ${transactionId})`);
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
