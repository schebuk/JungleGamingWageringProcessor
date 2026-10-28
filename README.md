# Jungle Gaming Wagering Processor

Sistema distribuído para processamento financeiro de iGaming, desenvolvido com NestJS, Bun e MikroORM. Focado em consistência absoluta, concorrência segura e entrega confiável de eventos.

## Como Rodar

1. **Suba a infraestrutura:**
```bash
docker compose up -d
```

2. **Inicie as tabelas do banco:**

```bash
  bun run bootstrap
```
3. **Rode a aplicação:**
```bash
bun run start
```
## Configure a autenticação (Keycloak):
- Acesse `http://localhost:8080` (admin / admin)
- Crie o realm `jungle-realm` e o client `jungle-api-client`
- Ative **Client Authentication** e **Service Account Roles**
- Copie o Client Secret e configure na Collection do Postman (OAuth 2.0 > Client Credentials)

## Testes de Concorrência

Todos os testes (funcionais + concorrência) rodam em um único comando contra a API na porta 3000:

```bash
  bun test tests/integration.test.ts
```
Cenários cobertos:
- 11 testes funcionais (Health, Wallet, Apostas, Idempotência, Ledger, Reconciliação, Validações)
- 2 testes de concorrência (Race condition com Pessimistic Locking + Estresse de 50 req/s)

## Health Checks
- Liveness: `GET /health/live` — Verifica se o processo está vivo
- Readiness: `GET /health/ready` — Verifica conexão com PostgreSQL

## Observabilidade
Todos os logs são estruturados em JSON e incluem `correlationId` para rastreamento de requisições entre serviços. O correlationId é gerado automaticamente ou respeita o header `x-correlation-id` enviado pelo cliente.

##Estrutura do Projeto
- `src/core/domain` — Value Objects (Money), Aggregates (Wallet) e Entidades puras
- `src/application/use-cases` — Lógica de negócio orquestrada (ProcessWager, Inbox, Outbox)
- `src/infrastructure/messaging` — Consumer SQS simulado e Producer via Outbox Pattern
- `src/interfaces/http` — Controllers e DTOs da API REST
- `tests/` — Testes de integração e concorrência com Bun Test Runner

## Decisões Arquiteturais
Consulte o arquivo `ARCHITECTURE.md` para detalhes sobre:
- Escolha de Pessimistic Locking vs Optimistic Locking
- Implementação do Outbox Pattern para mensageria confiável
- Estratégia de idempotência persistente
- Modelagem de Money com Decimal.js