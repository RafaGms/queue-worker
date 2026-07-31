import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { IdempotencyService } from '../queue/idempotency.service';
import { DEAD_PAYMENT_JOB } from '../queue/queue.constants';
import { PaymentGatewayMock } from './payment-gateway.mock';
import { PaymentProcessor } from './payment.processor';

describe('PaymentProcessor', () => {
  let gateway: { charge: jest.Mock };
  let idempotency: { claim: jest.Mock; release: jest.Mock };
  let dlq: { add: jest.Mock };
  let processor: PaymentProcessor;

  const jobData = { paymentId: 'pay-1', eventId: 'evt-1', amount: 100, currency: 'BRL' };

  beforeEach(() => {
    gateway = { charge: jest.fn() };
    idempotency = { claim: jest.fn(), release: jest.fn() };
    dlq = { add: jest.fn() };
    const config = { getOrThrow: jest.fn().mockReturnValue(3600) } as unknown as ConfigService;
    processor = new PaymentProcessor(
      gateway as unknown as PaymentGatewayMock,
      idempotency as unknown as IdempotencyService,
      config,
      dlq as unknown as Queue,
    );
  });

  it('skips processing when the event id was already claimed', async () => {
    idempotency.claim.mockResolvedValue(false);

    await processor.process({ data: jobData } as Job);

    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('charges the gateway when the event id is fresh', async () => {
    idempotency.claim.mockResolvedValue(true);
    gateway.charge.mockResolvedValue({ transactionId: 'tx-1' });

    await processor.process({ data: jobData } as Job);

    expect(gateway.charge).toHaveBeenCalledTimes(1);
    expect(idempotency.release).not.toHaveBeenCalled();
  });

  it('releases the claim and rethrows when the gateway fails, so the job is retried', async () => {
    idempotency.claim.mockResolvedValue(true);
    gateway.charge.mockRejectedValue(new Error('declined'));

    await expect(processor.process({ data: jobData } as Job)).rejects.toThrow('declined');
    expect(idempotency.release).toHaveBeenCalledWith('evt-1');
  });

  it('does not dead-letter a job that still has attempts left', async () => {
    const job = { data: jobData, attemptsMade: 2, opts: { attempts: 5 } } as Job;

    await processor.onFailed(job);

    expect(dlq.add).not.toHaveBeenCalled();
  });

  it('moves a job to the dlq once the attempts are exhausted', async () => {
    const job = {
      data: jobData,
      attemptsMade: 5,
      opts: { attempts: 5 },
      failedReason: 'declined',
    } as Job;

    await processor.onFailed(job);

    expect(dlq.add).toHaveBeenCalledWith(
      DEAD_PAYMENT_JOB,
      expect.objectContaining({ paymentId: 'pay-1', reason: 'declined', attemptsMade: 5 }),
    );
  });
});
