import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Client-generated UUID used for idempotency',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ description: 'Amount in the smallest currency unit', example: 2500 })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'BRL' })
  @IsString()
  @Length(3, 3)
  currency!: string;
}
