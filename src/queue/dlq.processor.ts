import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PAYMENTS_DLQ } from './queue.constants';

interface DeadPaymentData {
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  attemptsMade: number;
  failedAt: string;
}

@Processor(PAYMENTS_DLQ)
export class DlqProcessor extends WorkerHost {
  private readonly logger = new Logger(DlqProcessor.name);

  async process(job: Job<DeadPaymentData>): Promise<void> {
    const { paymentId, reason, attemptsMade } = job.data;

    this.logger.error(
      `dead-lettered payment ${paymentId} after ${attemptsMade} attempts: ${reason}`,
    );
  }
}
