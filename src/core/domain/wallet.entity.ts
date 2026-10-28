import { Entity, PrimaryKey, Property, Unique, OneToMany, Collection } from '@mikro-orm/core';
import { Money } from './money';
import { LedgerEntryEntity } from './ledger-entry.entity';

export enum LedgerDirection {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

@Entity()
@Unique({ properties: ['playerId', 'currency'] })
export class WalletEntity {
  @PrimaryKey()
  id!: string;

  @Property()
  playerId!: string;

  @Property()
  currency!: string;

  @Property({ type: 'decimal', precision: 18, scale: 2, fieldName: 'balance' })
  _balance!: string;

  @Property({ type: 'integer' })
  version!: number;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt!: Date;

  @OneToMany(() => LedgerEntryEntity, (e) => e.wallet)
  ledgerEntries = new Collection<LedgerEntryEntity>(this);

  get balance(): Money {
    if (!this._balance) {
      return Money.zero(this.currency || 'BRL');
    }
    return Money.from({ amount: this._balance, currency: this.currency });
  }

  static open(id: string, playerId: string, initialBalance: Money): WalletEntity {
    const wallet = new WalletEntity();
    wallet.id = id;
    wallet.playerId = playerId;
    wallet.currency = initialBalance.currency;
    wallet._balance = initialBalance.toJSON().amount;
    wallet.version = 1;
    wallet.createdAt = new Date();
    wallet.updatedAt = new Date();
    return wallet;
  }

  debit(amount: Money, transactionId: string): LedgerEntryEntity {
    if (this.currency !== amount.currency) throw new Error('Currency mismatch');
    
    const currentBalance = this.balance;
    
    if (currentBalance.isLessThan(amount)) throw new Error('Insufficient balance');

    const newBalance = currentBalance.subtract(amount);
    this._balance = newBalance.toJSON().amount;
    this.version += 1;
    this.updatedAt = new Date();

    return this.createLedgerEntry(transactionId, LedgerDirection.Debit, amount, currentBalance, newBalance);
  }

  credit(amount: Money, transactionId: string): LedgerEntryEntity {
    if (this.currency !== amount.currency) throw new Error('Currency mismatch');
    
    const currentBalance = this.balance;
    const newBalance = currentBalance.add(amount);

    this._balance = newBalance.toJSON().amount;
    this.version += 1;
    this.updatedAt = new Date();

    return this.createLedgerEntry(transactionId, LedgerDirection.Credit, amount, currentBalance, newBalance);
  }

  private createLedgerEntry(txId: string, dir: LedgerDirection, amount: Money, before: Money, after: Money): LedgerEntryEntity {
    const entry = new LedgerEntryEntity();
    entry.id = crypto.randomUUID();
    entry.wallet = this;
    entry.transactionId = txId;
    entry.direction = dir;
    entry.amount = amount.toJSON().amount;
    entry.balanceBefore = before.toJSON().amount;
    entry.balanceAfter = after.toJSON().amount;
    entry.createdAt = new Date();
    return entry;
  }
}