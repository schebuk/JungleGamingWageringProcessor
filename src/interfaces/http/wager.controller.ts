import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Get, Param, Query, UseGuards, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { NotFoundError, UniqueConstraintViolationException } from '@mikro-orm/core';
import { ProcessWagerService } from '../../application/use-cases/process-wager.service';
import { IdempotencyService } from '../../application/use-cases/idempotency.service';
import { CreateWalletService } from '../../application/use-cases/create-wallet.service';
import { WagerTransactionEntity } from '../../core/domain/wager-transaction.entity';
import { LedgerEntryEntity } from '../../core/domain/ledger-entry.entity';
import { WalletEntity } from '../../core/domain/wallet.entity';
import { HybridAuthGuard } from '../../auth/hybrid-auth.guard';

@Controller()
@UseGuards(HybridAuthGuard)
export class WagerController {
  constructor(
    private readonly em: EntityManager,
    private readonly processWagerService: ProcessWagerService,
    private readonly idempotencyService: IdempotencyService,
    private readonly createWalletService: CreateWalletService,
  ) {}

  @Post('wallets')
  async createWallet(@Body() body: { playerId: string; initialBalance: { amount: string; currency: string } }) {
    try {
      const wallet = await this.createWalletService.execute(
        body.playerId, 
        body.initialBalance.amount, 
        body.initialBalance.currency
      );
      return {
        id: wallet.id,
        playerId: wallet.playerId,
        balance: wallet.balance.toJSON(),
        version: wallet.version,
      };
    } catch (err) {
      if (err instanceof UniqueConstraintViolationException) {
        throw new ConflictException(`Wallet already exists for player ${body.playerId} in currency ${body.initialBalance.currency}`);
      }
      throw err;
    }
  }

  @Get('wallets/:walletId')
  async getWallet(@Param('walletId') walletId: string) {
    try {
      const wallet = await this.em.findOneOrFail(WalletEntity, { id: walletId });
      return {
        id: wallet.id,
        playerId: wallet.playerId,
        balance: wallet.balance.toJSON(),
        version: wallet.version,
      };
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new NotFoundException(`Wallet ${walletId} not found`);
      }
      throw err;
    }
  }

  @Get('wallets/:walletId/ledger')
  async getLedger(@Param('walletId') walletId: string, @Query('limit') limit = 50) {
    try {
      await this.em.findOneOrFail(WalletEntity, { id: walletId });
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new NotFoundException(`Wallet ${walletId} not found`);
      }
      throw err;
    }

    const entries = await this.em.find(LedgerEntryEntity, { wallet: { id: walletId } }, {
      limit: Number(limit),
      orderBy: { createdAt: 'DESC' }
    });
    return entries;
  }

  @Get('wagering/transactions/:transactionId')
  async getTransaction(@Param('transactionId') id: string) {
    const tx = await this.em.findOne(WagerTransactionEntity, { externalTransactionId: id });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }

  @Get('providers/:providerId/wagering/transactions/:externalTransactionId')
  async getProviderTransaction(@Param('providerId') providerId: string, @Param('externalTransactionId') extId: string) {
    const tx = await this.em.findOne(WagerTransactionEntity, { providerId, externalTransactionId: extId });
    if (!tx) throw new NotFoundException(`Transaction ${extId} for provider ${providerId} not found`);
    return tx;
  }

  @Post('wagering/transactions')
  @HttpCode(HttpStatus.OK)
  async createTransaction(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: any,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const storedResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
    if (storedResponse) return { ...storedResponse, idempotentReplay: true };

    try {
      await this.idempotencyService.acquireLock(idempotencyKey);
    } catch (e) {
      const finalResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
      return { ...finalResponse, idempotentReplay: true };
    }

    const result = await this.processWagerService.execute({
      walletId: dto.walletId,
      transactionId: dto.externalTransactionId,
      providerId: dto.providerId,
      kind: dto.kind,
      amount: dto.amount,
      currency: dto.currency,
      referenceExternalId: dto.referenceExternalTransactionId,
    });

    const responsePayload = {
      transactionId: dto.externalTransactionId,
      status: 'PROCESSED',
      balance: result.balance,
    };

    await this.idempotencyService.updateResponse(idempotencyKey, responsePayload);
    return { ...responsePayload, idempotentReplay: false };
  }

  @Post('wallets/:walletId/reconciliation')
  @HttpCode(HttpStatus.OK)
  async reconcile(@Param('walletId') walletId: string) {
    let wallet;
    try {
      wallet = await this.em.findOneOrFail(WalletEntity, { id: walletId });
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new NotFoundException(`Wallet ${walletId} not found`);
      }
      throw err;
    }

    const entries = await this.em.find(LedgerEntryEntity, { wallet: { id: walletId } });
    
    let calculated = 0;
    entries.forEach(e => {
      calculated += e.direction === 'CREDIT' ? parseFloat(e.amount) : -parseFloat(e.amount);
    });

    return {
      walletId,
      storedBalance: wallet.balance.toJSON(),
      calculatedBalance: { amount: calculated.toFixed(2), currency: wallet.currency },
      consistent: wallet.balance.toJSON().amount === calculated.toFixed(2),
      checkedEntries: entries.length
    };
  }

  @Get('health/live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  async readiness() {
    try {
      await this.em.getConnection().execute('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch (e) {
      return { status: 'error', database: 'disconnected' };
    }
  }
}