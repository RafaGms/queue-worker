import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PAYMENTS_QUEUE, PROCESS_PAYMENT_JOB } from '../queue/queue.constants';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(@InjectQueue(PAYMENTS_QUEUE) private readonly queue: Queue) {}

  async enqueue(dto: CreatePaymentDto) {
    const paymentId = randomUUID();

    await this.queue.add(PROCESS_PAYMENT_JOB, {
      paymentId,
      eventId: dto.eventId,
      amount: dto.amount,
      currency: dto.currency,
    });

    return { paymentId, status: 'queued' };
  }
}
