# queue-worker

Um serviço em NestJS que recebe pagamentos e processa cada um numa fila com BullMQ, em vez de resolver tudo dentro da requisição. Montei pra estudar de perto os problemas que aparecem quando você tira o processamento do fluxo síncrono: o que fazer quando o gateway falha, como não cobrar o mesmo pagamento duas vezes e como enxergar o que está rolando com os jobs.

O gateway aqui é fake e falha de propósito parte das vezes, justamente pra esses casos acontecerem.

![Painel do Bull Board com a fila de pagamentos (jobs concluídos e falhados) e a dead-letter queue](docs/bull-board.png)

## Stack

- NestJS + TypeScript
- BullMQ + Redis
- Bull Board pro painel das filas (`/admin/queues`)
- Swagger pra documentação da API (`/docs`)
- Docker Compose pro Redis
- Jest + Supertest nos testes

## Como funciona e por quê

O caminho de um pagamento é curto: chega no `POST /payments`, a API valida, joga um job na fila e responde 202 na hora. Quem faz o trabalho de verdade é um worker separado, que puxa o job e chama o gateway.

Coloquei fila no meio porque cobrar depende de um serviço externo, lento e que pode cair. Se isso rodasse dentro da requisição, o cliente ficaria preso esperando o gateway e qualquer lentidão dele viraria erro na tela. Com a fila, a resposta sai na hora e o resto acontece atrás, onde dá pra tentar de novo sem ninguém ver.

Quando o gateway falha, o job não morre na primeira tentativa: são cinco, com backoff exponencial (1s, 2s, 4s, 8s). Fui de backoff em vez de tentar na hora porque quase toda falha de gateway é passageira, tipo um timeout ou um pico de indisponibilidade. Repetir no mesmo segundo só bate de novo num serviço que já está mal; esperar um pouco entre as tentativas dá margem pra ele voltar.

Esgotadas as cinco, o job vai pra uma segunda fila, a `payments-dlq` (dead-letter queue), levando junto o motivo da última falha e quantas vezes tentou. Preferi isso a descartar o job. Um pagamento que falhou não pode simplesmente sumir; na DLQ ele fica parado, fora do caminho principal, mas ainda inteiro pra eu olhar depois ou reprocessar na mão.

A parte que mais me interessava era a idempotência. Fila entrega "pelo menos uma vez": o mesmo job pode rodar duas vezes se o worker cai no meio, se tem reentrega, ou se o cliente reenvia a requisição. Num sistema de pagamento, isso é cobrança dobrada. Então cada requisição manda um `eventId` (um UUID), e antes de cobrar o worker tenta registrar esse id no Redis com `SET eventId NX`. Se gravou, é a primeira vez e ele processa; se não gravou, é porque já passou por ali e ele pula.

Usei `SET NX` de propósito, e não um `GET` pra checar seguido de um `SET`. Com duas operações separadas fica uma brecha no meio: dois workers leem "não existe" ao mesmo tempo e os dois cobram. O `NX` resolve isso porque é atômico — o Redis decide num passo só quem gravou primeiro.

## Como rodar

```bash
docker compose up -d
npm install
cp .env.example .env
npm run start:dev
```

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| POST | `/payments` | Enfileira um pagamento e responde 202 |
| GET | `/admin/queues` | Painel do Bull Board com as filas e a DLQ |
| GET | `/docs` | Documentação Swagger |

## Testando na mão

Enfileirar um pagamento (o `eventId` é um UUID que você gera no cliente):

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -d '{"eventId":"550e8400-e29b-41d4-a716-446655440000","amount":2500,"currency":"BRL"}'
# 202 Accepted
# {"paymentId":"...","status":"queued"}
```

Manda a mesma requisição de novo, com o mesmo `eventId`: entra outro job na fila, mas o worker vê que já processou aquele evento e pula. Cobra uma vez só.

Pra forçar um job até a DLQ, sobe a API com o gateway falhando sempre:

```bash
GATEWAY_FAILURE_RATE=1 npm run start:dev
```

Aí qualquer pagamento vai falhar as cinco vezes e parar na `payments-dlq` com o motivo. Dá pra acompanhar tudo ao vivo no painel em `/admin/queues`.

## O que ficou de fora

Coisas que eu deixaria pra uma próxima:

- Guardar o resultado dos pagamentos num banco. Hoje o histórico é só o estado das filas no Redis, não dá pra consultar direito.
- Um endpoint pra reprocessar o que está na DLQ; por enquanto só dá pra olhar pelo painel.
- Proteger `/payments` e `/admin/queues`, que hoje estão abertos.
