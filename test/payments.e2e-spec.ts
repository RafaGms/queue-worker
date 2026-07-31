import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PAYMENTS_QUEUE } from './../src/queue/queue.constants';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let queue: Queue;

  beforeAll(async () => {
    process.env.GATEWAY_FAILURE_RATE = '0';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    queue = app.get<Queue>(getQueueToken(PAYMENTS_QUEUE));
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a payload without a valid event id', async () => {
    await request(app.getHttpServer())
      .post('/payments')
      .send({ amount: 100, currency: 'USD' })
      .expect(400);
  });

  it('enqueues a payment and processes it to completion', async () => {
    const response = await request(app.getHttpServer())
      .post('/payments')
      .send({ eventId: randomUUID(), amount: 2500, currency: 'BRL' })
      .expect(202);

    expect(response.body).toEqual({ paymentId: expect.any(String), status: 'queued' });

    await waitFor(async () => (await queue.getCompletedCount()) >= 1);
    expect(await queue.getCompletedCount()).toBeGreaterThanOrEqual(1);
  });
});

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 10000,
  intervalMs = 200,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('condition not met within timeout');
}
