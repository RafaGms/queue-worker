import { Queue } from 'bullmq';
import { PROCESS_PAYMENT_JOB } from '../queue/queue.constants';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let queue: { add: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(queue as unknown as Queue);
  });

  it('enqueues a payment job and returns a queued status', async () => {
    const dto: CreatePaymentDto = {
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 2500,
      currency: 'BRL',
    };

    const result = await service.enqueue(dto);

    expect(result.status).toBe('queued');
    expect(result.paymentId).toEqual(expect.any(String));
    expect(queue.add).toHaveBeenCalledWith(PROCESS_PAYMENT_JOB, {
      paymentId: result.paymentId,
      eventId: dto.eventId,
      amount: dto.amount,
      currency: dto.currency,
    });
  });

  it('generates a distinct payment id per call', async () => {
    const dto: CreatePaymentDto = {
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      currency: 'USD',
    };

    const first = await service.enqueue(dto);
    const second = await service.enqueue(dto);

    expect(first.paymentId).not.toBe(second.paymentId);
  });
});
