import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OutboxEventEntity } from '../../core/domain/outbox-event.entity';
import { InboxService } from '../../application/use-cases/inbox.service';
import { ProcessWagerService } from '../../application/use-cases/process-wager.service';
import { setInterval } from 'timers/promises';

@Injectable()
export class SqsConsumerService implements OnModuleInit {
  private readonly logger = new Logger(SqsConsumerService.name);
  private isRunning = false;

  constructor(
    private readonly em: EntityManager,
    private readonly inboxService: InboxService,
    private readonly processWagerService: ProcessWagerService,
  ) {}

  async onModuleInit() {
    this.startPolling();
  }

  private async startPolling() {
    if (this.isRunning) return;
    this.isRunning = true;

    for await (const _ of setInterval(5000)) {
      await this.processPendingEvents();
    }
  }

  private async processPendingEvents() {
    const em = this.em.fork();
    try {
      const events = await em.find(OutboxEventEntity, { processedAt: null }, { limit: 5 });

      for (const event of events) {
        const sqsMessageId = `sqs-${event.id}`;

        const inboxMsg = await this.inboxService.tryAcquireLock(sqsMessageId, 'wager-consumer', event.payload);
        
        if (!inboxMsg) {
          continue;
        }

        this.logger.log(`📥 Processando evento do SQS: ${event.type} - ID: ${event.id}`);

        event.processedAt = new Date();
        await this.inboxService.markAsProcessed(sqsMessageId);
        
        await em.flush();
      }
    } catch (error) {
      this.logger.error('Erro ao processar outbox/sqs:', error);
    }
  }
}