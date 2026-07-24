import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

export interface ChargeResult {
  transactionId: string;
}

interface ChargeInput {
  paymentId: string;
  amount: number;
  currency: string;
}

@Injectable()
export class PaymentGatewayMock {
  private readonly logger = new Logger(PaymentGatewayMock.name);
  private readonly failureRate: number;

  constructor(config: ConfigService) {
    this.failureRate = config.get<number>('GATEWAY_FAILURE_RATE', 0.3);
  }

  async charge(payment: ChargeInput): Promise<ChargeResult> {
    await this.delay(200);

    if (Math.random() < this.failureRate) {
      this.logger.warn(`gateway declined payment ${payment.paymentId}`);
      throw new Error(`payment gateway declined ${payment.paymentId}`);
    }

    return { transactionId: randomUUID() };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
