# Wagering Processor - Architecture Decision Record

## Visão Geral
Sistema distribuído para processamento de transações financeiras de iGaming, focado em consistência financeira, concorrência e entrega confiável de eventos.

## Stack Tecnológica
- **Runtime:** Bun 1.x (Performance e suporte nativo a TypeScript)
- **Framework:** NestJS (Arquitetura modular e injeção de dependência)
- **Banco de Dados:** PostgreSQL (ACID, JSONB e Locking robusto)
- **ORM:** MikroORM v6 (Unit of Work e Identity Map explícitos)
- **Mensageria:** Padrão Outbox + Consumer interno (Simulando SQS)

## Decisões de Domínio

### 1. Money Value Object
Utilizamos uma classe `Money` imutável baseada em `Decimal.js`. 
- **Motivo:** Evitar erros de arredondamento de ponto flutuante (`number`).
- **Regra:** Todas as operações monetárias retornam novas instâncias; comparações de moeda são estritas.

### 2. Wallet Aggregate Root
A entidade `Wallet` encapsula toda a lógica de saldo.
- **Invariantes:** Saldo nunca negativo; versão incrementada a cada mudança.
- **Ledger:** Toda alteração de saldo gera um `LedgerEntry` imutável na mesma transação SQL.

### 3. Concorrência (Pessimistic Locking)
Optamos por `LockMode.PESSIMISTIC_WRITE` no nível do banco de dados.
- **Motivo:** Garantir correção absoluta em cenários de "hot wallet" (múltiplas apostas simultâneas no mesmo usuário).
- **Trade-off:** Menor throughput em comparação com Optimistic Locking, mas zero risco de lost updates ou saldo negativo.

### 4. Idempotência Persistente
Implementada via tabela `idempotency_key_entity`.
- **Fluxo:** A chave é reservada antes do processamento. Se a requisição falhar, o status é salvo para replay seguro.

### 5. Mensageria (Outbox Pattern)
Eventos de integração são salvos na tabela `outbox_event_entity` dentro da mesma transação da aposta.
- **Consumer:** Um worker interno processa eventos pendentes e simula o envio para filas externas (SQS), garantindo entrega "at-least-once".

## Testes e Validação
- **Concorrência:** Script em Bun testa 50 requisições paralelas, validando integridade final do saldo.
- **Health Checks:** Endpoints dedicados para Liveness e Readiness do PostgreSQL.

## Autenticação e Segurança
Optamos por integrar um **Identity Provider externo (Keycloak)** via protocolo OIDC/JWT.
- **Motivo:** Evitar armazenamento de credenciais sensíveis e seguir boas práticas de mercado.
- **Implementação:** Um `JwtAuthGuard` valida a assinatura RS256 dos tokens emitidos pelo realm `jungle-realm`.
- **Exceções:** Endpoints de Health Check permanecem abertos para monitoramento de infraestrutura.