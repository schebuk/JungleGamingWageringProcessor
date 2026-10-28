import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OutboxEventEntity } from '../../core/domain/outbox-event.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OutboxService {
  async publishEvent(em: EntityManager, aggregateId: string, type: string, payload: object): Promise<void> {
    const event = em.create(OutboxEventEntity, {
      id: uuidv4(),
      aggregateId,
      type,
      payload,
      createdAt: new Date(),
    });
    
    em.persist(event);
  }
}