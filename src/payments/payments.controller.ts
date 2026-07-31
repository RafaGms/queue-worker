import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue a payment for async processing' })
  @ApiResponse({ status: 202, description: 'Payment accepted and queued' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.enqueue(dto);
  }
}
