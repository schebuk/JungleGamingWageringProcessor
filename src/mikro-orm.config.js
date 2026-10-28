const { defineConfig } = require('@mikro-orm/postgresql');
const { WalletEntity } = require('./dist/core/domain/wallet.entity');
const { LedgerEntryEntity } = require('./dist/core/domain/ledger-entry.entity');
const { IdempotencyKeyEntity } = require('./dist/core/domain/idempotency-key.entity');
const { OutboxEventEntity } = require('./dist/core/domain/outbox-event.entity');
const { WagerTransactionEntity } = require('./dist/core/domain/wager-transaction.entity');
const { InboxMessageEntity } = require('./dist/core/domain/inbox-message.entity');

module.exports = defineConfig({
  entities: [
    WalletEntity,
    LedgerEntryEntity,
    IdempotencyKeyEntity,
    OutboxEventEntity,
    WagerTransactionEntity,
    InboxMessageEntity,
  ],
  dbName: 'jungle_db',
  user: 'jungle_user',
  password: 'jungle_pass',
  host: 'localhost',
  port: 5432,
  debug: true,
  pool: {
    min: 2,
    max: 50,
  },
});