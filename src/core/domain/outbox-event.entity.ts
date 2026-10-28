import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class OutboxEventEntity {
  @PrimaryKey()
  id!: string;

  @Property()
  aggregateId!: string;

  @Property()
  type!: string;

  @Property({ type: 'json' })
  payload!: object;

  @Property({ nullable: true })
  processedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;
}