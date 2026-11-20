# Sistema de chat distribuído

Base do marco **Ambiente e contratos**. Autenticação e mensagens funcionais pertencem aos próximos marcos. Consulte [arquitetura](docs/ARQUITETURA.md), [contratos](docs/CONTRATOS.md) e [progresso](docs/PROGRESSO.md).

## Requisitos

Git, Node.js 22.19.0 (npm 11) e Docker Engine com Compose v2.20+ ou Docker Desktop com containers Linux. Reserve a porta local 8080 e acesso ao npm/Docker Hub. No Windows, execute Docker Desktop ou use Docker Engine no WSL2. Não é necessário instalar PostgreSQL, Redis ou Traefik no host.

## Iniciar a partir de um clone limpo

Na raiz do clone, execute:

```sh
npm ci
npm run setup
npm run typecheck
npm run build
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
npm run smoke
```

Abra http://localhost:8080. `setup` gera `.env` com senha local aleatória e um par RSA em `secrets/`, preservando arquivos existentes. Não versionar esses arquivos. As chaves estão preparadas para o próximo marco e ainda não são usadas para emitir JWT. `.env.example` documenta a configuração sem segredos reais. Apenas Traefik publica porta, ligada a 127.0.0.1; nenhuma infraestrutura externa é criada.

Se Docker estiver apenas no WSL, mantenha um terminal Ubuntu aberto e execute os comandos `docker compose ...` na mesma pasta (ou prefixe-os com `wsl -u root --` se o usuário Linux ainda não tiver acesso ao socket). O terminal mantém a distribuição ativa; encerrá-la pode parar também os containers. Node e npm podem rodar no PowerShell. Não compartilhe `node_modules` entre instalações Node Linux/Windows; o build Docker usa seu próprio `npm ci`.

## Organização e operação

- `apps/web`: React/Vite, página inicial responsiva com estado dos serviços; imagem Nginx.
- `services/auth` e `services/chat`: processos Express separados; Chat prepara Socket.IO e adaptador Redis. Transporte em `src/index.ts`; regras e repositórios serão separados quando implementados.
- `packages/contracts`: tipos públicos REST e eventos; `docs/CONTRATOS.md` define semântica e validação futura.
- `docs`: arquitetura, contratos e progresso; `docs/enunciado` guarda o PDF original da professora.
- `infra`: Nginx e configuração dinâmica de Traefik via arquivo, sem acesso ao socket Docker.
- `tests/smoke.mjs`: verifica interface, duas réplicas por serviço, healthchecks, respostas 501 e recusa do handshake pelo proxy.

Compose inicia PostgreSQL com volume persistente, Redis, tarefa única `migrate`, duas réplicas de cada serviço, web e Traefik. Migrações versionadas criam apenas os esquemas `auth` e `chat`, são transacionais e idempotentes; nenhuma tabela de negócio foi criada. Próximas migrações devem ter executor versionado antes de incluir alterações não idempotentes. Esta base compartilha um usuário PostgreSQL de desenvolvimento; isolamento de propriedade é por esquema.

```sh
docker compose ps
docker compose logs --tail=100
docker compose run --rm migrate
docker compose down
```

`down` preserva o volume PostgreSQL. Não executar `down -v` em dados que devam ser preservados. Não há seed neste marco. Para reiniciar, use `docker compose up -d --wait`; para reconstruir, `npm run up`. Rotas públicas `/api/auth`, `/api/chat`, `/socket.io` e `/` preservam os prefixos; `/internal` não é exposto como API. Healthchecks do proxy retiram instâncias não aptas. A URL interna de Auth está preparada para a primeira réplica; balanceamento da consulta interna será entregue no marco de réplicas antes dos testes de falha.

Se `up --wait` falhar, confira `docker compose ps -a` e logs. Se a porta estiver ocupada, altere `PORT` no `.env` e use `BASE_URL` correspondente no smoke. Se houver acesso negado ao socket Docker no WSL, use um terminal com acesso ao daemon ou solicite ao administrador a configuração do usuário. Não registre o conteúdo do `.env` nos logs de evidência.

Alta disponibilidade de infraestrutura e exigência de máquinas distintas aguardam confirmação da professora; isso não impede a preparação local. Não iniciar o próximo marco sem nova tarefa.

## Verificação isolada de clone limpo

`node tests/clean-clone.mjs` exige também RTK no PATH (convenção deste ambiente). O verificador copia somente arquivos não ignorados, cria um snapshot Git temporário e faz um clone local, sem criar commits no repositório da dupla. Executa os passos acima usando a porta 8081 e projeto Compose exclusivo; no Windows usa Docker no WSL como root. Ao terminar, remove os containers e preserva o snapshot e o volume de teste, informando seus caminhos. O uso normal pelo README não exige RTK.
