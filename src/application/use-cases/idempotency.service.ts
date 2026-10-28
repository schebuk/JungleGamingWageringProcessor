import { Injectable, ConflictException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { IdempotencyKeyEntity } from '../../core/domain/idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  constructor(private readonly em: EntityManager) {}

  async acquireLock(key: string): Promise<void> {
    try {
      const record = this.em.create(IdempotencyKeyEntity, {
        key,
        responsePayload: {},
        createdAt: new Date(),
      });
      
      this.em.persist(record);
      await this.em.flush();
    } catch (error) {
      throw new ConflictException('Idempotency key already processed');
    }
  }

  async updateResponse(key: string, payload: object): Promise<void> {
    const record = await this.em.findOneOrFail(IdempotencyKeyEntity, { key });
    record.responsePayload = payload;
    await this.em.flush();
  }

  async getStoredResponse(key: string): Promise<object | null> {
    const record = await this.em.findOne(IdempotencyKeyEntity, { key });
    return record ? record.responsePayload : null;
  }
}