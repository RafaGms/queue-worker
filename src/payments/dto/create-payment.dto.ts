import { IsInt, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  eventId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}
