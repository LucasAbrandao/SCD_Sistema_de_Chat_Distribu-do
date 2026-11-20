# Progresso do trabalho final

Atualizado em 20/11/2026. A e B são identificadores provisórios dos integrantes.

| Marco | Responsável | Estado | Evidência ou condição |
|---|---|---|---|
| Documentação inicial | Ambos | concluído | AGENTS.md na raiz; arquitetura e progresso em docs/ |
| Colocação no novo repositório | Ambos | concluído | Arquivos no clone local de LucasAbrandao/SCD_Sistema_de_Chat_Distribu-do |
| Organização do diretório principal | Ambos | concluído | Documentação em docs/ e PDF em docs/enunciado/; links locais e referências conferidos |
| Validação da interpretação de disponibilidade | Ambos | pendente | Confirmar com a professora máquinas distintas e falhas de infraestrutura |
| Ambiente e contratos | Ambos | concluído | Build, tipos, oito componentes saudáveis, migração exit 0 e smoke aprovados também em clone limpo local |
| Auth, interface e chat privado | A / B | pendente | Login, envio e histórico entre duas sessões |
| Grupos e autorização | A / B | pendente | Entrega a membros e bloqueio de terceiros |
| Réplicas e recuperação | B / A | pendente | Entrega entre instâncias e retomada após queda |
| Testes e carga | A / B | pendente | 100 usuários, 20 grupos e medições |
| Relatório e apresentação | Ambos | pendente | Até 10 páginas, URL do código e ensaio |

**Agora** — Marco Ambiente e contratos concluído. Organização da raiz na branch `codex/organizar-raiz`, preservando a implementação existente. Repositório original ainda sem commit inicial; nenhuma publicação ou PR realizado.

**Próximo passo** — Revisão pela dupla; aguardar tarefa para Auth, interface e chat privado. Confirmar disponibilidade com a professora antes da entrega final.

**Parada desta etapa** — Encerrar após os critérios de Ambiente e contratos. Próximos marcos exigem nova tarefa.

## Evidências executadas em 20/11/2026

Ambiente: Windows, Node 22.19.0, npm 11.7.0; Docker Engine 29.7.2 e Compose 5.5.0 no Ubuntu 24.04/WSL2. Docker não está no PATH Windows; comandos Docker executados com `wsl -u root --` porque o usuário Linux não tem acesso ao socket. Não foi necessário instalar ferramentas globais. Dependências npm instaladas e fixadas no lockfile.

| Comando executado | Resultado |
|---|---|
| `npm run setup` | `.env` e chaves RSA locais gerados, ignorados pelo Git |
| `npm run typecheck` | Web, Auth, Chat e contracts aprovados |
| `npm run build` | Quatro workspaces compilados; bundle React/Vite gerado |
| `npm audit` | Zero vulnerabilidades reportadas após atualizar Vite para 7.3.8 |
| `wsl -u root -- docker compose config --quiet` | Configuração válida |
| `wsl -u root -- docker compose up --build -d --wait --wait-timeout 180` | Imagens construídas; após corrigir healthcheck IPv4 do Nginx e porta interna do Traefik, subida aprovada com `up -d --wait --wait-timeout 180` |
| `npm run smoke` | Interface 200; duas instâncias distintas de Auth e Chat; healthchecks 200; rotas de negócio 501; Socket.IO recusa namespace com NOT_IMPLEMENTED pelo Traefik |
| `node tests/clean-clone.mjs` | PASS: clone Git local sem dependências, `.env` ou chaves; repetiu npm ci/setup/tipos/build, Compose build/up e smoke na porta 8081 |
| `docker compose ps -a` no clone | Oito componentes healthy; tarefa migrate finalizada com código 0 |

Snapshot de validação aprovado: `C:\Users\lucas\AppData\Local\Temp\scd-clean-DfL4oL\clone`, projeto `scdclean1795207773811`. O script encerrou os containers desse projeto; snapshot e volume de teste foram preservados. Como o repositório original não tem commits, o script fez um commit somente no snapshot temporário e clonou esse snapshot, sem alterar o índice ou histórico da dupla. Duas tentativas anteriores detectaram os problemas corrigidos de healthcheck e porta; a execução final passou integralmente.

Contratos REST, autenticação, erros, paginação e Socket.IO revisados em `CONTRATOS.md`, com tipos em `packages/contracts`. Cadastro/login/envio/grupos/carga não foram implementados nem testados neste marco. A interface inicial mostra o estado dos serviços; não houve validação visual em navegador nesta etapa.

## Pendências e limites

- Sem bloqueio técnico para este marco. Para usar Docker pelo usuário Linux sem root, o administrador pode configurar o acesso ao socket; o procedimento WSL como root já foi validado.
- Manter terminal WSL aberto ao operar Docker Engine nesta instalação; o encerramento automático da distribuição pode parar os containers. README registra o procedimento.
- Professora: confirmar abrangência de alta disponibilidade (infraestrutura e máquinas distintas). Permanece pendente sem impedir esta base.
- Revisão pela dupla e publicação via PR ainda pendentes; nenhum push foi feito. Demais marcos permanecem pendentes.
- Base usa um usuário PostgreSQL local, esquemas separados e migrações iniciais idempotentes. Executor de migrações de negócio, autorização real e balanceamento de consultas internas Auth serão tratados nos marcos correspondentes.
