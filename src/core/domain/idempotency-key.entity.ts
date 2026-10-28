import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class IdempotencyKeyEntity {
  @PrimaryKey()
  key!: string;

  @Property({ type: 'json' })
  responsePayload!: object;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;
}