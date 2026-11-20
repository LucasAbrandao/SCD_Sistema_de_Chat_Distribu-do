# Sistema de chat distribuído

Chat privado com cadastro/login, mensagens em tempo real e histórico PostgreSQL. Monorepo TypeScript com React/Vite, Auth e Chat separados, duas réplicas por serviço, Redis e Traefik. Grupos, carga e testes formais de queda pertencem aos próximos marcos.

Documentos: [arquitetura](docs/ARQUITETURA.md), [contratos](docs/CONTRATOS.md), [progresso e evidências](docs/PROGRESSO.md), [como funciona e como validar](docs/VALIDACAO.md).

## Preparar e iniciar

Requisitos: Git, Node 22.19.0, npm 11 e Docker Engine/Compose v2.20+ ou Docker Desktop com containers Linux. Porta local 8080 livre. Não é necessário instalar banco, Redis ou ferramentas globais.

```sh
npm ci
npm run setup
npm run typecheck
npm run build
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
npm run smoke
```

Abra http://localhost:8080. Cadastre dois usuários em sessões independentes e procure o outro usuário para conversar. Username: 3–32 letras minúsculas ASCII, números ou `_`; senha: 12–128 caracteres.

No Windows desta instalação, Docker está no WSL: substitua cada comando `docker ...` por `wsl -u root -- docker ...` e **mantenha um terminal Ubuntu aberto**. Encerrar a distribuição pode parar a infraestrutura. Node/npm podem rodar no PowerShell; não compartilhe node_modules entre Node Windows e Linux.

`setup` preserva configuração/chaves existentes, gera senha aleatória e RSA em arquivos ignorados pelo Git, e acrescenta `REGISTRATION_ENABLED=true` apenas se ausente. Para demonstração com cadastro fechado, configure `REGISTRATION_ENABLED=false` no `.env` e recrie Auth com Compose. O smoke cria usuários fictícios e exige cadastro habilitado.

Somente Traefik publica uma porta em 127.0.0.1. A API interna, PostgreSQL e Redis permanecem na rede Docker. Nenhum serviço externo ou túnel é publicado automaticamente.

## Operação e dados

```sh
docker compose ps -a
docker compose logs --tail=100
docker compose run --rm migrate
docker compose down
docker compose up -d --wait
```

`down` preserva dados; não use `down -v` em dados importantes. Migrações são executadas antes das réplicas, em ordem, com transações, lock e registro de versão/checksum. Repetir a execução não reaplica arquivos concluídos. Alteração de arquivo aplicado gera erro; crie uma nova migração. Esquemas pertencem a cada serviço, com um usuário PostgreSQL compartilhado no ambiente local.

O cliente mantém login na aba por até uma hora. Mensagem “Persistida” confirma gravação no servidor, sem indicar leitura. Mensagens e lista sincronizam a cada cinco segundos e ao recuperar conexão/foco. Reenvio após timeout mantém o identificador para evitar duplicação.

## Testes

```sh
npm run test:unit
npm run test:integration
npx playwright install chromium
npm run test:e2e
node tests/clean-clone.mjs
```

Integração e E2E criam snapshots isolados, configuração, chaves, projeto Compose e volume exclusivos. Usam porta 8082 (`TEST_PORT` permite outra); execute as duas suítes sequencialmente. Ao terminar, param seus containers e informam snapshot, log e volume preservados. Não limpam dados de desenvolvimento. E2E gera relatório HTML, traces em falhas e capturas desktop/celular no snapshot informado.

Os executores isolados e clone limpo usam RTK conforme a convenção deste ambiente. O uso normal do aplicativo e testes unitários não exige RTK. Clone limpo usa porta 8081 e um commit apenas no snapshot temporário, sem alterar o histórico original.

Se uma porta estiver ocupada, altere `PORT` no `.env` e `BASE_URL` ao executar smoke. Não imprima `.env`, senhas ou tokens para diagnosticar. A consulta interna de Auth ainda aponta para `auth-1`; balanceamento interno e estudo de falhas ficam no marco de réplicas. A interpretação de alta disponibilidade aguarda confirmação da professora.
