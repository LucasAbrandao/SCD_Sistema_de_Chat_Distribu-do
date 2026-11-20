# Contratos REST e Socket.IO — v1

Estado: cadastro, login, usuários, conversas privadas, histórico e eventos autenticados implementados. Criação de grupos permanece HTTP 501 `NOT_IMPLEMENTED`. Não existe bypass de autenticação.

## Convenções

JSON UTF-8; identificadores UUID; horários ISO 8601 UTC. Posições são inteiros positivos enviados como strings decimais para preservar precisão. Campos desconhecidos e entradas inválidas serão rejeitados. Limite de corpo HTTP previsto: 16 KiB. Tipos compartilhados em `packages/contracts/src/index.ts`.

HTTP protegido usa `Authorization: Bearer <JWT>`. JWT RS256, `sub` UUID do usuário, `iss=scd-auth`, `aud=scd-chat`, `iat` e `exp`, validade de 3600 segundos. Auth assina com chave privada; Chat verifica com pública e algoritmo fixo. Sem refresh token neste escopo; expiração exige novo login. Nunca registrar tokens ou senhas.

Erro HTTP: `{ "error": { "code": "UNAUTHENTICATED", "message": "Autenticação necessária.", "requestId": "uuid" } }`. Respostas não expõem stack, consultas ou credenciais.

| HTTP | code | Situação |
|---|---|---|
| 400 | VALIDATION_ERROR | Corpo, parâmetros ou cursor inválidos |
| 401 | UNAUTHENTICATED | Token ausente, inválido ou expirado; credenciais incorretas |
| 403 | FORBIDDEN | Usuário sem participação; cadastro desabilitado |
| 404 | NOT_FOUND | Recurso inexistente |
| 409 | CONFLICT | Login duplicado ou reutilização incompatível de clientMessageId |
| 503 | DEPENDENCY_UNAVAILABLE | Banco, Redis ou Auth interno indisponível |
| 501 | NOT_IMPLEMENTED | Operação ainda não entregue |
| 500 | INTERNAL_ERROR | Falha inesperada |

## REST

| Método e caminho | Entrada | Sucesso |
|---|---|---|
| POST /api/auth/register | `{username,password}` | 201 `{id,username}` |
| POST /api/auth/login | `{username,password}` | 200 `{accessToken,tokenType:"Bearer",expiresIn:3600,user:{id,username}}` |
| GET /api/auth/users?q=&limit=20&after=UUID | Bearer; busca por prefixo de username, cursor por ID | 200 `{items:User[],nextCursor:string\|null}` |
| POST /internal/users/resolve | Bearer do solicitante; `{ids:UUID[]}` (1–100 únicos) | 200 `{users:User[],missingIds:UUID[]}` |
| POST /api/chat/conversations | Bearer; `{type:"private"\|"group",name?,participantIds:UUID[]}` | 201 Conversation; 200 se privada já existe |
| GET /api/chat/conversations?limit=20&after=UUID | Bearer; cursor por ID | 200 `{items:Conversation[],nextCursor:string\|null}` |
| GET /api/chat/conversations/:id/messages?after=0&limit=50 | Bearer; posição exclusiva | 200 `{items:Message[],nextCursor:string\|null}` |

`User={id,username}`. `Conversation={id,type,name,participantIds,createdAt}`; nome nulo para privada. `Message={id,conversationId,senderId,clientMessageId,content,position,createdAt}`. Paginação em ordem crescente por ID nas listas e por posição no histórico; limite máximo 100, mínimo 1. `nextCursor` aponta para o último item quando houver mais; caso contrário, nulo. Ausência de `after` inicia a lista/histórico. Somente conversas do solicitante são retornadas.

Username: 3–32 caracteres ASCII `[a-z0-9_]`, minúsculo, único; senha: 12–128 caracteres, sem trim ou normalização silenciosa. Conteúdo: 1–4000 caracteres Unicode, rejeitar somente espaços, preservar texto aceito. Grupo: nome com 1–100 caracteres após trim; 2–100 participantes únicos incluindo criador. Privada: exatamente dois participantes distintos incluindo criador, sem nome. Chat valida IDs na API interna de Auth com timeout de 2 segundos; falha resulta em 503, sem criar conversa parcial. Endpoint interno fica fora das rotas públicas do Traefik e valida o mesmo JWT.

## Socket.IO

Path `/socket.io`, namespace `/`, cliente e servidor `transports:['websocket']`. Handshake `auth:{token:JWT}`; token validado antes de associar salas autorizadas. `connect_error` usa mensagem legível e `data:{code,message,requestId}`. Frames Socket.IO limitados a 64 KiB para acomodar conteúdo Unicode e envelope; a regra de mensagem permanece 1–4000 caracteres. Corpo HTTP limitado a 16 KiB.

| Evento | Direção | Payload / resposta |
|---|---|---|
| message:send | cliente → Chat | `{conversationId,clientMessageId,content}`, callback obrigatório |
| ack de message:send | Chat → remetente | `{ok:true,message:Message}` ou `{ok:false,error:{code,message,requestId}}` |
| message:new | Chat → membros | `Message` persistida, após commit |
| auth:expired | Chat → cliente | sem payload; servidor desconecta em seguida |

Remetente vem de `sub`; clientes não enviam senderId, position ou createdAt. `clientMessageId` UUID estável por tentativa lógica e único por remetente. Mesmo ID com conversa/conteúdo iguais retorna mensagem existente; diferentes geram CONFLICT. Posição cresce por conversa mediante bloqueio transacional da linha da conversa, com restrições únicas. Ack confirma persistência, sem confirmar leitura. Se o ack não chegar em 5 segundos, o cliente pode reenviar com o mesmo ID.

Eventos Redis ocorrem após commit e podem se perder. Não há promessa de entrega exatamente uma vez: deduplicar por ID e ordenar por posição. Recuperar histórico ao conectar, reconectar, detectar lacuna e a cada cinco segundos na conversa aberta. Atualizar lista ao recuperar foco e periodicamente (cinco segundos). Servidor associa salas de usuário; somente membros podem consultar/enviar/receber. Expiração durante conexão emite auth:expired e exige novo login.

## Saúde implementada

`GET /health/live`: processo ativo; `GET /health/ready`: PostgreSQL acessível e, em Chat, ambas as conexões Redis prontas e PING concluído. Prontidão retorna 200 `{status:"ok",service,instance}` ou 503 `{status:"unavailable",service}`. Aliases públicos `/api/auth/health` e `/api/chat/health` permitem conferir roteamento e réplica. Healthchecks não validam regras de negócio.

Referências: [Socket.IO, opções](https://socket.io/docs/v4/server-options/), [adaptador Redis](https://socket.io/docs/v4/redis-adapter/), [Traefik, balanceamento e saúde](https://doc.traefik.io/traefik/reference/routing-configuration/http/load-balancing/service/).
