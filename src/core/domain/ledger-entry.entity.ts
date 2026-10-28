import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { WalletEntity } from './wallet.entity';

@Entity()
export class LedgerEntryEntity {
  @PrimaryKey()
  id!: string;

  @ManyToOne(() => WalletEntity)
  wallet!: WalletEntity;

  @Property()
  transactionId!: string;

  @Property()
  direction!: string;

  @Property({ type: 'decimal', precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: 'decimal', precision: 18, scale: 2 })
  balanceBefore!: string;

  @Property({ type: 'decimal', precision: 18, scale: 2 })
  balanceAfter!: string;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;
}