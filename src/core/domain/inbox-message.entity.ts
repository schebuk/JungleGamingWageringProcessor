import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class InboxMessageEntity {
  @PrimaryKey()
  messageId!: string;

  @Property()
  consumerName!: string;

  @Property()
  payloadHash!: string;

  @Property({ onCreate: () => new Date() })
  receivedAt!: Date;

  @Property({ nullable: true })
  processedAt?: Date;

  static receive(messageId: string, consumerName: string, payloadHash: string): InboxMessageEntity {
    const msg = new InboxMessageEntity();
    msg.messageId = messageId;
    msg.consumerName = consumerName;
    msg.payloadHash = payloadHash;
    msg.receivedAt = new Date();
    return msg;
  }

  isProcessed(): boolean {
    return !!this.processedAt;
  }

  markProcessed(): void {
    this.processedAt = new Date();
  }
}