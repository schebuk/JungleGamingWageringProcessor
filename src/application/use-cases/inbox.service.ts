import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InboxMessageEntity } from '../../core/domain/inbox-message.entity';
import { createHash } from 'crypto';

@Injectable()
export class InboxService {
  constructor(private readonly em: EntityManager) {}

  async tryAcquireLock(messageId: string, consumerName: string, payload: any) {
    return this.em.transactional(async (em) => {
      const existing = await em.findOne(InboxMessageEntity, { messageId });
      
      if (existing) {
        return null;
      }

      // Gera hash do payload para garantir integridade e idempotência
      const payloadHash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      // Usa em.create com os campos exatos da entidade
      const inboxMsg = em.create(InboxMessageEntity, {
        messageId,
        consumerName,
        payloadHash,
        receivedAt: new Date(),
        processedAt: null,
      });

      em.persist(inboxMsg);
      await em.flush();

      return inboxMsg;
    });
  }

  async markAsProcessed(messageId: string) {
    return this.em.transactional(async (em) => {
      const msg = await em.findOneOrFail(InboxMessageEntity, { messageId });
      msg.markProcessed();
      await em.flush();
    });
  }
}