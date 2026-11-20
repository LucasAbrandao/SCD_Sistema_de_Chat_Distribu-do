# Progresso do trabalho final

Atualizado em 20/11/2026. A e B são identificadores provisórios dos integrantes.

| Marco | Responsável | Estado | Evidência ou condição |
|---|---|---|---|
| Documentação inicial e organização | Ambos | concluído | Documentos em docs/ e enunciado preservado |
| Ambiente e contratos | Ambos | concluído | Tipos, build, Compose e smoke em clone limpo |
| Auth, interface e chat privado | A / B | concluído | Tipos/build, cinco testes unitários, integração, E2E isolado, reinício e clone limpo aprovados |
| Revisão pela dupla e publicação | Ambos | pendente | Branch local codex/auth-chat-privado; sem push ou PR |
| Validação da interpretação de disponibilidade | Ambos | pendente | Confirmar com professora máquinas distintas e falhas de infraestrutura |
| Grupos e autorização de grupos | A / B | pendente | Entrega a membros e bloqueio de terceiros |
| Réplicas e recuperação | B / A | pendente | Estudos formais de falha e balanceamento interno Auth |
| Testes e carga | A / B | pendente | 100 usuários, 20 grupos e medições |
| Relatório e apresentação | Ambos | pendente | Até 10 páginas, URL do código e ensaio |

**Agora** — Cadastro/login, JWT, usuários, conversas privadas, histórico, socket autenticado e interface implementados. Migrações versionadas com checksums, lock e transações integradas ao Compose. Restrições e locks garantem conversa única por dupla, idempotência por remetente/tentativa e posição crescente. Sessão por aba; sincronização após reconexão e a cada cinco segundos. Autorização de conversa privada testada.

**Versionamento** — Base registrada no commit local `ec7ab11`. Autor obtido do perfil GitHub do usuário, com endereço privado de commits GitHub. Trabalho na branch `codex/auth-chat-privado`; nenhuma publicação externa.

**Próximo passo** — Revisão da dupla e validação manual pelo roteiro [VALIDACAO.md](VALIDACAO.md). Grupos, carga e estudos formais de queda exigem tarefa posterior. Confirmar abrangência de disponibilidade com a professora antes da entrega final.

## Evidências executadas em 20/11/2026

Windows, Node 22.19.0, npm 11.7.0, Docker 29.7.2 no WSL2. Docker executado por `wsl -u root --`; terminal WSL ativo necessário nesta instalação. `.env` e chaves preservados e ignorados pelo Git. Dependências fixadas no lockfile.

| Verificação executada | Resultado |
|---|---|
| `npm run setup` | Configuração anterior preservada; cadastro local habilitado quando variável ausente |
| `npm run typecheck` | Quatro workspaces aprovados |
| `npm run test:unit` | Build completo e cinco testes aprovados: senhas, validação, JWT e erros públicos |
| `npm run test:integration` | Dois cenários de API/socket aprovados; testes de persistência transacional e migrações aprovados; reinício completo preservou credenciais/histórico; cadastro desabilitado retornou 403 |
| `npm run test:e2e` | Chromium real: duas sessões, cadastro, envio/resposta, reload com sessão, offline/reconexão, saída, desktop 1440×900 e celular 390×844; sem pageerror |
| `node tests/clean-clone.mjs` | Clone local sem dependências, .env ou chaves: npm ci/setup/tipos/build, Compose build/up, oito healthy, migração exit 0 e smoke funcional aprovados |
| `npm run smoke` | Interface, duas instâncias Auth/Chat, cadastro/login, criação privada, envio pelo proxy e histórico aprovados |
| Instalações npm | Audit reportou zero vulnerabilidades nas instalações executadas |
| `git diff --check` | Sem erros de whitespace |

Snapshots e logs preservados:

- Integração completa: `C:\Users\lucas\AppData\Local\Temp\scd-test-rcdV7R\execution.log`; projeto `scdtest1795216691601`.
- E2E isolado: `C:\Users\lucas\AppData\Local\Temp\scd-test-mwILyC\execution.log`; relatório em `source/playwright-report/index.html`.
- Clone limpo: `C:\Users\lucas\AppData\Local\Temp\scd-clean-Sr2cld\clone`; projeto `scdclean1795216531668`.
- Containers dos projetos de teste encerrados; snapshots e volumes preservados. Desenvolvimento na porta 8080 mantido disponível.
- Capturas revisadas: [desktop](evidencias/desktop.png) e [celular](evidencias/mobile.png). Roteiro e explicação em [VALIDACAO.md](VALIDACAO.md).

Um teste detectou ordenação textual de posições (`1,10,11,2`); a consulta foi corrigida para ordenar a coluna bigint, e o teste concorrente/paginado passou. Uma primeira tentativa de smoke encontrou a infraestrutura parada pelo encerramento do WSL; com sessão WSL ativa, subida e smoke passaram.

## Limites

Grupos permanecem 501. Não há refresh token, revogação no logout ou confirmação de leitura. Falha de publicação após commit é recuperável pelo histórico; não existe promessa de entrega exatamente uma vez. Banco/Redis/proxy/host ainda são pontos únicos de falha. Auth interno aponta para auth-1 até o marco de réplicas. Não foram executados estudos de queda de réplica, carga de 100 usuários/20 grupos ou publicação externa. O teste de falha de publicação usa injeção na camada de entrega; não equivale a derrubar Redis em produção.
