import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateBetDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  externalTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  walletId!: string;

  @IsString()
  @IsNotEmpty()
  roundId!: string;

  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsString()
  @Matches(/^(BET|WIN|LOSS|REFUND|ROLLBACK)$/)
  kind!: 'BET' | 'WIN' | 'LOSS' | 'REFUND' | 'ROLLBACK';

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}