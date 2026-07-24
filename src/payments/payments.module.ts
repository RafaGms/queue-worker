import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PaymentGatewayMock } from './payment-gateway.mock';
import { PaymentProcessor } from './payment.processor';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [QueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProcessor, PaymentGatewayMock],
})
export class PaymentsModule {}
