import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Client } from 'pg';

const API_URL = 'http://localhost:3000';
let walletId: string;

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'jungle_user',
  password: 'jungle_pass',
  database: 'jungle_db',
};

async function dbQuery(sql: string, params?: any[]) {
  const client = new Client(DB_CONFIG);
  await client.connect();
  const res = await client.query(sql, params);
  await client.end();
  return res.rows;
}

async function apiRequest(method: string, path: string, body?: object, headers?: Record<string, string>) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

describe('Testes Completos de Integração - Jungle Gaming Wagering Processor', () => {
  beforeAll(async () => {
    await dbQuery("DELETE FROM wager_transaction_entity");
    await dbQuery("DELETE FROM ledger_entry_entity");
    await dbQuery("DELETE FROM idempotency_key_entity");
    await dbQuery("DELETE FROM outbox_event_entity");
    await dbQuery("DELETE FROM inbox_message_entity");
    await dbQuery("DELETE FROM wallet_entity");
  });

  // --- TESTES FUNCIONAIS ---

  test('1. Health Liveness', async () => {
    const { status, json } = await apiRequest('GET', '/health/live');
    expect(status).toBe(200);
    expect(json?.status).toBe('ok');
  });

  test('2. Health Readiness', async () => {
    const { status, json } = await apiRequest('GET', '/health/ready');
    expect(status).toBe(200);
    expect(json?.database).toBe('connected');
  });

  test('3. Criar Wallet', async () => {
    const { status, json } = await apiRequest('POST', '/wallets', {
      playerId: 'player-integration',
      initialBalance: { amount: '500.00', currency: 'BRL' },
    });
    expect(status).toBe(201);
    expect(json?.balance?.amount).toBe('500.00');
    walletId = json.id;
  });

  test('4. Aposta BET', async () => {
    const { status, json } = await apiRequest('POST', '/wagering/transactions', {
      providerId: 'integration-test',
      externalTransactionId: 'tx-int-001',
      playerId: 'player-integration',
      walletId,
      roundId: 'round-int',
      gameId: 'game-int',
      kind: 'BET',
      amount: '50.00',
      currency: 'BRL',
    }, { 'Idempotency-Key': 'integration-bet-001' });
    expect(status).toBe(200);
    expect(json?.balance?.amount).toBe('450.00');
    expect(json?.idempotentReplay).toBe(false);
  });

  test('5. Idempotência', async () => {
    const { status, json } = await apiRequest('POST', '/wagering/transactions', {
      providerId: 'integration-test',
      externalTransactionId: 'tx-int-001',
      playerId: 'player-integration',
      walletId,
      roundId: 'round-int',
      gameId: 'game-int',
      kind: 'BET',
      amount: '50.00',
      currency: 'BRL',
    }, { 'Idempotency-Key': 'integration-bet-001' });
    expect(status).toBe(200);
    expect(json?.idempotentReplay).toBe(true);
  });

  test('6. Get Wallet', async () => {
    const { status, json } = await apiRequest('GET', `/wallets/${walletId}`);
    expect(status).toBe(200);
    expect(json?.balance?.amount).toBe('450.00');
  });

  test('7. Ledger', async () => {
    const { status, json } = await apiRequest('GET', `/wallets/${walletId}/ledger?limit=10`);
    expect(status).toBe(200);
    expect(json?.length).toBeGreaterThanOrEqual(2);
  });

  test('8. Reconciliação', async () => {
    const { status, json } = await apiRequest('POST', `/wallets/${walletId}/reconciliation`);
    expect(status).toBe(200);
    expect(json?.consistent).toBe(true);
  });

  test('9. Get Transaction', async () => {
    const { status, json } = await apiRequest('GET', '/wagering/transactions/tx-int-001');
    expect(status).toBe(200);
    expect(json?.kind).toBe('BET');
  });

  test('10. Sem Idempotency-Key', async () => {
    const { status } = await apiRequest('POST', '/wagering/transactions', {
      providerId: 'integration-test',
      externalTransactionId: 'tx-no-key',
      playerId: 'player-integration',
      walletId,
      roundId: 'round-int',
      gameId: 'game-int',
      kind: 'BET',
      amount: '10.00',
      currency: 'BRL',
    });
    expect(status).toBe(400);
  });

  test('11. LOSS sem alterar saldo', async () => {
    const { status, json } = await apiRequest('POST', '/wagering/transactions', {
      providerId: 'integration-test',
      externalTransactionId: 'tx-loss-001',
      playerId: 'player-integration',
      walletId,
      roundId: 'round-int',
      gameId: 'game-int',
      kind: 'LOSS',
      amount: '999.00',
      currency: 'BRL',
    }, { 'Idempotency-Key': 'integration-loss-001' });
    expect(status).toBe(200);
    expect(json?.balance?.amount).toBe('450.00');
  });

  // --- TESTES DE TRATAMENTO DE ERROS (NOVOS) ---

  test('12. GET Wallet inexistente deve retornar 404', async () => {
    const { status } = await apiRequest('GET', '/wallets/wallet-id-inexistente-123');
    expect(status).toBe(404);
  });

  test('13. GET Transação inexistente deve retornar 404', async () => {
    const { status } = await apiRequest('GET', '/wagering/transactions/tx-inexistente-456');
    expect(status).toBe(404);
  });

  test('14. POST Reconciliação em wallet inexistente deve retornar 404', async () => {
    const { status } = await apiRequest('POST', '/wallets/wallet-id-inexistente-789/reconciliation');
    expect(status).toBe(404);
  });

  // --- TESTES DE CONCORRÊNCIA ---

  test('15. Concorrência: Duas apostas de 80.00 em saldo de 100.00', async () => {
    const concWallet = await apiRequest('POST', '/wallets', {
      playerId: 'player-conc',
      initialBalance: { amount: '100.00', currency: 'BRL' },
    });
    const concWalletId = concWallet.json.id;

    const [status1, status2] = await Promise.all([
      apiRequest('POST', '/wagering/transactions', {
        providerId: 'prov-test',
        externalTransactionId: 'tx-conc-1',
        playerId: 'player-conc',
        walletId: concWalletId,
        roundId: 'round-conc',
        gameId: 'game-conc',
        kind: 'BET',
        amount: '80.00',
        currency: 'BRL',
      }, { 'Idempotency-Key': 'concurrent-key-1' }),
      apiRequest('POST', '/wagering/transactions', {
        providerId: 'prov-test',
        externalTransactionId: 'tx-conc-2',
        playerId: 'player-conc',
        walletId: concWalletId,
        roundId: 'round-conc',
        gameId: 'game-conc',
        kind: 'BET',
        amount: '80.00',
        currency: 'BRL',
      }, { 'Idempotency-Key': 'concurrent-key-2' }),
    ]);

    const successCount = [status1, status2].filter(s => s.status === 200).length;
    expect(successCount).toBe(1);

    const finalBalance = await dbQuery('SELECT balance FROM wallet_entity WHERE id = $1', [concWalletId]);
    expect(finalBalance[0].balance).toBe('20.00');
  }, 10000);

  test('16. Estresse: 50 apostas de 1.00 em paralelo', async () => {
    const stressWallet = await apiRequest('POST', '/wallets', {
      playerId: 'player-stress',
      initialBalance: { amount: '50.00', currency: 'BRL' },
    });
    
    if (!stressWallet.json || !stressWallet.json.id) {
      throw new Error('Falha ao criar wallet de estresse');
    }
    
    const stressWalletId = stressWallet.json.id;

    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(apiRequest('POST', '/wagering/transactions', {
        providerId: 'prov-test',
        externalTransactionId: `tx-stress-${i}`,
        playerId: 'player-stress',
        walletId: stressWalletId,
        roundId: 'round-stress',
        gameId: 'game-stress',
        kind: 'BET',
        amount: '1.00',
        currency: 'BRL',
      }, { 'Idempotency-Key': `stress-key-${i}` }));
    }

    const statuses = await Promise.all(promises);
    const successCount = statuses.filter(s => s.status === 200).length;
    
    const finalBalanceRows = await dbQuery('SELECT balance FROM wallet_entity WHERE id = $1', [stressWalletId]);
    
    if (finalBalanceRows.length > 0) {
      expect(finalBalanceRows[0].balance).toBe('0.00');
    } else {
      throw new Error('Wallet de estresse não encontrada no banco');
    }
    
    expect(successCount + statuses.filter(s => s.status !== 200).length).toBe(50);
  }, 15000);

  afterAll(async () => {
    await dbQuery("DELETE FROM wager_transaction_entity");
    await dbQuery("DELETE FROM ledger_entry_entity");
    await dbQuery("DELETE FROM idempotency_key_entity");
    await dbQuery("DELETE FROM outbox_event_entity");
    await dbQuery("DELETE FROM inbox_message_entity");
    await dbQuery("DELETE FROM wallet_entity");
  });
});