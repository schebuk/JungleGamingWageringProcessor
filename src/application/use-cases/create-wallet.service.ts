import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WalletEntity } from '../../core/domain/wallet.entity';
import { LedgerEntryEntity } from '../../core/domain/ledger-entry.entity';
import { Money } from '../../core/domain/money';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CreateWalletService {
  constructor(private readonly em: EntityManager) {}

  async execute(playerId: string, amount: string, currency: string) {
    return this.em.transactional(async (em) => {
      const money = Money.from({ amount, currency });
      const now = new Date();
      const walletId = uuidv4();

      const wallet = em.create(WalletEntity, {
        id: walletId,
        playerId,
        currency,
        _balance: amount,
        balance: money,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      const openingEntry = em.create(LedgerEntryEntity, {
        id: uuidv4(),
        wallet,
        transactionId: `opening-${playerId}`,
        direction: 'CREDIT',
        amount,
        balanceBefore: '0.00',
        balanceAfter: amount,
        createdAt: now,
      });

      em.persist(wallet);
      em.persist(openingEntry);
      await em.flush();

      return wallet;
    });
  }
}