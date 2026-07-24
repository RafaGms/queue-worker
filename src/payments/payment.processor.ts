import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PAYMENTS_QUEUE } from '../queue/queue.constants';
import { PaymentGatewayMock } from './payment-gateway.mock';

interface PaymentJobData {
  paymentId: string;
  amount: number;
  currency: string;
}

@Processor(PAYMENTS_QUEUE)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(private readonly gateway: PaymentGatewayMock) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<void> {
    const { paymentId, amount, currency } = job.data;

    this.logger.log(`processing payment ${paymentId} (${amount} ${currency})`);

    const { transactionId } = await this.gateway.charge({ paymentId, amount, currency });

    this.logger.log(`payment ${paymentId} approved (tx ${transactionId})`);
  }
}
