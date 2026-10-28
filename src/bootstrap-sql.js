const { Client } = require('pg');

async function bootstrap() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'jungle_user',
    password: 'jungle_pass',
    database: 'jungle_db',
  });

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_entity (
        id VARCHAR(255) PRIMARY KEY,
        player_id VARCHAR(255) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance DECIMAL(18,2) NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_player_currency UNIQUE (player_id, currency)
      );
    `);
    console.log('Tabela wallet_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ledger_entry_entity (
        id VARCHAR(255) PRIMARY KEY,
        wallet_id VARCHAR(255) NOT NULL REFERENCES wallet_entity(id),
        transaction_id VARCHAR(255) NOT NULL,
        direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
        amount DECIMAL(18,2) NOT NULL,
        balance_before DECIMAL(18,2) NOT NULL,
        balance_after DECIMAL(18,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabela ledger_entry_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_key_entity (
        key VARCHAR(255) PRIMARY KEY,
        response_payload JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabela idempotency_key_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS outbox_event_entity (
        id VARCHAR(255) PRIMARY KEY,
        aggregate_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        processed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabela outbox_event_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wager_transaction_entity (
        id VARCHAR(255) PRIMARY KEY,
        provider_id VARCHAR(255) NOT NULL,
        external_transaction_id VARCHAR(255) NOT NULL,
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        wallet_id VARCHAR(255) REFERENCES wallet_entity(id),
        kind VARCHAR(20) NOT NULL CHECK (kind IN ('BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK', 'OPENING')),
        amount DECIMAL(18,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        failure_code VARCHAR(50),
        reference_external_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
      );
    `);
    console.log('Tabela wager_transaction_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_message_entity (
        message_id VARCHAR(255) PRIMARY KEY,
        consumer_name VARCHAR(50) NOT NULL,
        payload_hash VARCHAR(255) NOT NULL,
        received_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
      );
    `);
    console.log('Tabela inbox_message_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wager_transaction_entity (
        id VARCHAR(255) PRIMARY KEY,
        provider_id VARCHAR(255) NOT NULL,
        external_transaction_id VARCHAR(255) NOT NULL,
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        wallet_id VARCHAR(255) REFERENCES wallet_entity(id),
        kind VARCHAR(20) NOT NULL CHECK (kind IN ('BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK', 'OPENING')),
        amount DECIMAL(18,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        failure_code VARCHAR(50),
        reference_external_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP,
        CONSTRAINT unique_provider_ext_tx UNIQUE (provider_id, external_transaction_id)
      );
    `);
    console.log('Tabela wager_transaction_entity criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_message_entity (
        message_id VARCHAR(255) PRIMARY KEY,
        consumer_name VARCHAR(50) NOT NULL,
        payload_hash VARCHAR(255) NOT NULL,
        received_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
      );
    `);
    console.log('Tabela inbox_message_entity criada/verificada');

    console.log('Banco de dados sincronizado com sucesso!');
  } catch (error) {
    console.error('Erro ao sincronizar banco:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

bootstrap();