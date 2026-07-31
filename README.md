# queue-worker

API em NestJS que enfileira pagamentos e os processa de forma assíncrona com BullMQ, lidando com falha, reprocessamento, duplicidade e visibilidade operacional.

![Painel do Bull Board mostrando a fila de pagamentos com jobs concluídos e falhados e a dead-letter queue](docs/bull-board.png)

## Stack

- NestJS + TypeScript
- BullMQ + Redis
- Bull Board (painel em `/admin/queues`)
- Swagger (`/docs`)
- Docker Compose (Redis)
- Jest + Supertest

## Como rodar

```bash
docker compose up -d
npm install
cp .env.example .env
npm run start:dev
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/payments` | Enfileira um pagamento e retorna 202 |
| GET | `/admin/queues` | Painel do Bull Board (filas e DLQ) |
| GET | `/docs` | Documentação Swagger da API |

## Exemplo de fluxo

Enfileirar um pagamento. O `eventId` é um UUID gerado pelo cliente e serve de chave de idempotência:

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -d '{"eventId":"550e8400-e29b-41d4-a716-446655440000","amount":2500,"currency":"BRL"}'
# 202 Accepted
# {"paymentId":"...","status":"queued"}
```

Reenviar o mesmo `eventId` enfileira outro job, mas o worker pula o processamento por já ter visto o evento — o pagamento é cobrado uma vez só.

Para ver um job cair na dead-letter queue, suba a API com o gateway sempre falhando:

```bash
GATEWAY_FAILURE_RATE=1 npm run start:dev
```

Qualquer pagamento enfileirado vai falhar, ser retentado cinco vezes com backoff exponencial e, esgotadas as tentativas, aparecer na fila `payments-dlq` com o motivo da falha. Acompanhe tudo em `/admin/queues`.
