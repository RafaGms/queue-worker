# Retry e Dead-Letter Queue

Este documento descreve como a fila de pagamentos trata falhas.

## Política de retry

Todo job enfileirado em `payments` nasce com estas opções padrão (`defaultJobOptions` em `queue.module.ts`):

- `attempts: 5` — até cinco tentativas antes de desistir.
- `backoff: { type: 'exponential', delay: 1000 }` — o intervalo entre tentativas dobra a cada falha: ~1s, 2s, 4s, 8s.
- `removeOnComplete: 1000` — mantém apenas os últimos mil jobs concluídos, para não encher o Redis.
- `removeOnFail: false` — jobs que falham não são apagados, para preservar o rastro da falha.

O backoff é exponencial, e não retry imediato, porque a maioria das falhas de gateway é transitória (timeout, indisponibilidade momentânea). Repetir na hora só empilha pressão sobre um serviço que já está em apuros; espaçar as tentativas dá tempo de ele se recuperar e evita efeito manada.

## Quando um job vai para a DLQ

O `PaymentProcessor` escuta o evento `failed` do worker. A cada falha o BullMQ reenfileira o job com o backoff acima, incrementando `attemptsMade`. Quando `attemptsMade` alcança `attempts` (5), as tentativas se esgotaram e o job é copiado para a fila `payments-dlq` com:

- os dados originais do pagamento;
- `reason` — a mensagem da última falha (`failedReason`);
- `attemptsMade` — quantas tentativas foram feitas;
- `failedAt` — timestamp da desistência.

O `DlqProcessor` consome `payments-dlq` e registra o pagamento morto. Num sistema real esse consumidor dispararia alerta, gravaria em banco para conciliação ou abriria um ticket; aqui ele apenas loga, mantendo o job visível no painel.

## Por que uma DLQ em vez de descartar o job

Descartar um pagamento que falhou cinco vezes é perder dinheiro e contexto. A dead-letter queue separa o que falhou de forma definitiva do fluxo normal, sem bloquear a fila principal, e mantém o job inteiro — payload e histórico — disponível para inspeção e reprocessamento manual. É a diferença entre "o pagamento sumiu" e "o pagamento está aqui, parado, com o motivo anotado".
