import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OutboxEventEntity } from '../../core/domain/outbox-event.entity';
import { InboxService } from '../../application/use-cases/inbox.service';
import { setInterval } from 'timers/promises';
import { structuredLogger } from '../../common/logger';

@Injectable()
export class SqsConsumerService implements OnModuleInit {
  private isRunning = false;

  constructor(
    private readonly em: EntityManager,
    private readonly inboxService: InboxService,
  ) {}

  async onModuleInit() {
    this.startPolling();
  }

  private async startPolling() {
    if (this.isRunning) return;
    this.isRunning = true;
    structuredLogger.log('SQS Consumer iniciado. Polling a cada 5s', 'SqsConsumerService');

    for await (const _ of setInterval(5000)) {
      await this.processPendingEvents();
    }
  }

  private async processPendingEvents() {
    const em = this.em.fork();
    try {
      const events = await em.find(OutboxEventEntity, { processedAt: null }, { limit: 5 });

      if (events.length === 0) return;

      structuredLogger.log(`${events.length} evento(s) pendente(s) encontrado(s) no Outbox`, 'SqsConsumerService');

      for (const event of events) {
        const sqsMessageId = `sqs-${event.id}`;

        const inboxMsg = await this.inboxService.tryAcquireLock(sqsMessageId, 'wager-consumer', event.payload);

        if (!inboxMsg) {
          structuredLogger.log(`Evento ${event.id} já processado ou em andamento. Pulando.`, 'SqsConsumerService');
          continue;
        }

        structuredLogger.log(`📥 Processando evento do SQS: ${event.type} - AggregateID: ${event.aggregateId}`, 'SqsConsumerService');

        event.processedAt = new Date();
        await this.inboxService.markAsProcessed(sqsMessageId);

        await em.flush();
        structuredLogger.log(`✅ Evento ${event.id} marcado como publicado e processado`, 'SqsConsumerService');
      }
    } catch (error) {
      const err = error as Error;
      structuredLogger.error('Erro ao processar outbox/sqs', err.stack, 'SqsConsumerService');
    }
  }
}