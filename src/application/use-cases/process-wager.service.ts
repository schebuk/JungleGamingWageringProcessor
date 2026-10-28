import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import { WalletEntity } from '../../core/domain/wallet.entity';
import { Money } from '../../core/domain/money';
import { OutboxService } from './outbox.service';
import { WagerTransactionEntity, WagerKind, WagerStatus } from '../../core/domain/wager-transaction.entity';
import { v4 as uuidv4 } from 'uuid';
import { structuredLogger } from '../../common/logger';

@Injectable()
export class ProcessWagerService {
  constructor(
    private readonly em: EntityManager,
    private readonly outboxService: OutboxService,
  ) {}

  async execute(dto: {
    walletId: string;
    transactionId: string;
    providerId: string;
    kind: 'BET' | 'WIN' | 'LOSS' | 'REFUND' | 'ROLLBACK';
    amount: string;
    currency: string;
    referenceExternalId?: string;
  }) {
    return this.em.transactional(async (em) => {
      structuredLogger.log(`Iniciando processamento de aposta`, 'ProcessWagerService');
      structuredLogger.log(`Dados da transação: kind=${dto.kind}, amount=${dto.amount}, walletId=${dto.walletId}`, 'ProcessWagerService');

      const wallet = await em.findOneOrFail(WalletEntity, dto.walletId, {
        lockMode: LockMode.PESSIMISTIC_WRITE,
        refresh: true,
      });

      structuredLogger.log(`Wallet carregada com lock. Saldo atual: ${wallet.balance.toJSON().amount} ${wallet.currency}`, 'ProcessWagerService');

      const wagerTx = em.create(WagerTransactionEntity, {
        id: uuidv4(),
        providerId: dto.providerId,
        externalTransactionId: dto.transactionId,
        idempotencyKey: `${dto.providerId}:${dto.transactionId}`,
        wallet: wallet,
        kind: dto.kind as WagerKind,
        amount: dto.amount,
        currency: dto.currency,
        status: WagerStatus.PENDING,
        referenceExternalId: dto.referenceExternalId,
        createdAt: new Date(),
      });

      em.persist(wagerTx);
      structuredLogger.log(`WagerTransaction criada com status PENDING. ID: ${wagerTx.id}`, 'ProcessWagerService');

      const money = Money.from({ amount: dto.amount, currency: dto.currency });
      let entry;

      try {
        switch (dto.kind) {
          case 'BET':
            entry = wallet.debit(money, dto.transactionId);
            structuredLogger.log(`Débito aplicado. Novo saldo: ${wallet.balance.toJSON().amount}`, 'ProcessWagerService');
            break;
          case 'WIN':
          case 'REFUND':
          case 'ROLLBACK':
            entry = wallet.credit(money, dto.transactionId);
            structuredLogger.log(`Crédito aplicado. Novo saldo: ${wallet.balance.toJSON().amount}`, 'ProcessWagerService');
            break;
          case 'LOSS':
            wagerTx.markProcessed();
            structuredLogger.log(`LOSS registrado sem alteração de saldo`, 'ProcessWagerService');
            await em.flush();
            return { walletId: wallet.id, balance: wallet.balance.toJSON(), processed: true };
          default:
            throw new BadRequestException(`Invalid wager kind: ${dto.kind}`);
        }

        em.persist(entry);
        wagerTx.markProcessed();
        structuredLogger.log(`WagerTransaction marcada como PROCESSED`, 'ProcessWagerService');

        await this.outboxService.publishEvent(em, wallet.id, 'WALLET_BALANCE_CHANGED', {
          transactionId: dto.transactionId,
          kind: dto.kind,
          balance: wallet.balance.toJSON(),
          version: wallet.version,
        });

        structuredLogger.log(`Evento WALLET_BALANCE_CHANGED publicado no Outbox`, 'ProcessWagerService');

      } catch (err) {
        const error = err as Error;
        if (error.message === 'Insufficient balance') {
          wagerTx.markRejected('INSUFFICIENT_BALANCE');
          structuredLogger.warn(`Aposta rejeitada: saldo insuficiente. Saldo: ${wallet.balance.toJSON().amount}, Valor solicitado: ${dto.amount}`, 'ProcessWagerService');
        } else {
          wagerTx.markRejected('INTERNAL_ERROR');
          structuredLogger.error(`Erro interno ao processar aposta: ${error.message}`, error.stack, 'ProcessWagerService');
        }
        throw error;
      }

      await em.flush();
      structuredLogger.log(`Transação finalizada com sucesso. Version: ${wallet.version}`, 'ProcessWagerService');

      return {
        walletId: wallet.id,
        balance: wallet.balance.toJSON(),
        version: wallet.version,
        processed: true,
      };
    });
  }
}