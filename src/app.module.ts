import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import config from './mikro-orm.config';
import { WagerController } from './interfaces/http/wager.controller';
import { HealthController } from './interfaces/http/health.controller';
import { ProcessWagerService } from './application/use-cases/process-wager.service';
import { IdempotencyService } from './application/use-cases/idempotency.service';
import { OutboxService } from './application/use-cases/outbox.service';
import { SqsConsumerService } from './infrastructure/messaging/sqs-consumer.service';
import { CreateWalletService } from './application/use-cases/create-wallet.service';
import { InboxService } from './application/use-cases/inbox.service';
import { HybridAuthGuard } from './auth/hybrid-auth.guard';

import { WalletEntity } from './core/domain/wallet.entity';
import { LedgerEntryEntity } from './core/domain/ledger-entry.entity';
import { IdempotencyKeyEntity } from './core/domain/idempotency-key.entity';
import { OutboxEventEntity } from './core/domain/outbox-event.entity';
import { WagerTransactionEntity } from './core/domain/wager-transaction.entity';
import { InboxMessageEntity } from './core/domain/inbox-message.entity';

@Module({
  imports: [
    MikroOrmModule.forRoot({
      ...config,
      entities: [
        WalletEntity, 
        LedgerEntryEntity, 
        IdempotencyKeyEntity, 
        OutboxEventEntity,
        WagerTransactionEntity,
        InboxMessageEntity
      ],
    }),
  ],
  controllers: [WagerController, HealthController],
  providers: [
    ProcessWagerService, 
    IdempotencyService, 
    OutboxService, 
    SqsConsumerService,
    CreateWalletService,
    InboxService,
    HybridAuthGuard,
  ],
})
export class AppModule {}