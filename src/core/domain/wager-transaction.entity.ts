import { Entity, PrimaryKey, Property, ManyToOne, Unique, Enum } from '@mikro-orm/core';
import { WalletEntity } from './wallet.entity';

export enum WagerKind {
  BET = 'BET',
  WIN = 'WIN',
  LOSS = 'LOSS',
  REFUND = 'REFUND',
  ROLLBACK = 'ROLLBACK',
  OPENING = 'OPENING',
}

export enum WagerStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

@Entity()
@Unique({ properties: ['providerId', 'externalTransactionId'] })
export class WagerTransactionEntity {
  @PrimaryKey()
  id!: string;

  @Property()
  providerId!: string;

  @Property()
  externalTransactionId!: string;

  @Property({ unique: true })
  idempotencyKey!: string;

  @ManyToOne(() => WalletEntity)
  wallet!: WalletEntity;

  @Enum({ items: () => WagerKind })
  kind!: WagerKind;

  @Property({ type: 'decimal', precision: 18, scale: 2 })
  amount!: string;

  @Property()
  currency!: string;

  @Enum({ items: () => WagerStatus })
  status!: WagerStatus;

  @Property({ nullable: true })
  failureCode?: string;

  @Property({ nullable: true })
  referenceExternalId?: string;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ nullable: true })
  processedAt?: Date;

  markProcessed(): void {
    this.status = WagerStatus.PROCESSED;
    this.processedAt = new Date();
  }

  markRejected(code: string): void {
    this.status = WagerStatus.REJECTED;
    this.failureCode = code;
    this.processedAt = new Date();
  }
}