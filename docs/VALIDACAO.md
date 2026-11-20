# Funcionamento e roteiro de validação

## O que foi implementado

Auth recebe cadastro, valida username/senha, gera salt aleatório e armazena somente hash derivado da senha. O login verifica o hash e emite JWT assinado por RSA com validade de uma hora. Auth possui a chave privada; Chat verifica apenas com a pública. HTTP protegido e handshake do socket verificam assinatura, emissor, audiência e expiração. Ao expirar, a interface exige novo login.

Chat cria uma única conversa por dupla. Antes de criá-la, consulta a API interna de Auth para conferir os participantes. A criação da conversa e seus participantes é transacional. Apenas participantes podem consultar histórico ou enviar mensagens; o servidor controla as salas de recebimento, sem aceitar salas ou remetente fornecidos pelo cliente.

Ao enviar, o navegador cria um clientMessageId. Chat bloqueia a tentativa e a conversa no PostgreSQL, gera a próxima posição e grava a mensagem. Somente depois do commit ele publica o evento via Redis e confirma ao remetente. Repetir a mesma tentativa retorna o mesmo registro; mudar seus dados causa conflito. Uma falha antes do commit não confirma o envio. Uma falha de evento após commit não remove a mensagem: o histórico permite recuperá-la.

A interface deduplica por ID e ordena numericamente por posição. Consulta páginas de histórico ao abrir, reconectar e periodicamente. O cursor só avança com o histórico recebido, evitando perder mensagens quando eventos chegam fora de ordem. O login fica em sessionStorage, separado por aba; sair limpa o estado local e encerra o socket, sem revogar um JWT já emitido.

## Conferir no seu computador

Siga a preparação do README. No PowerShell desta instalação, use:

```powershell
npm ci
npm run setup
npm run typecheck
npm run build
wsl -u root -- docker compose up --build -d --wait --wait-timeout 180
wsl -u root -- docker compose ps -a
npm run smoke
```

Mantenha um terminal Ubuntu aberto. Resultado esperado: oito componentes healthy e migrate Exited (0). Smoke aprovado verifica interface, duas réplicas de Auth/Chat e um fluxo de cadastro/login, mensagem e histórico; deixa apenas dados fictícios.

1. Abra http://localhost:8080 em duas sessões independentes (janela normal e janela anônima).
2. Crie `alice_teste` e `bob_teste`, com senhas fictícias de pelo menos 12 caracteres. Se os nomes já existirem, entre com a senha anterior ou use nomes novos.
3. Alice procura Bob, abre a conversa e envia uma mensagem. Bob abre a conversa recebida na lista e responde. Confira o conteúdo nas duas janelas.
4. Atualize a página de Alice. Ela deve continuar autenticada; abra a conversa e confira o histórico.
5. Procure Bob novamente e abra a conversa. Ela deve ser reutilizada.
6. No DevTools de Bob, ative Network > Offline. Envie mensagens como Alice. Desative Offline e confira a recuperação sem duplicações.
7. Tente mensagem com espaços e username já cadastrado. O sistema deve impedir operações inválidas ou mostrar erro legível.
8. Reduza a largura para 390 pixels. Confira navegação de volta, conteúdo legível e ausência de rolagem horizontal.
9. Clique Sair. A interface deve voltar ao login e encerrar a conexão.
10. Para persistência, execute `wsl -u root -- docker compose down`, depois `wsl -u root -- docker compose up -d --wait`. Entre novamente e confira usuários e histórico. Não use `-v`.

## Testes reproduzíveis e evidências

`npm run test:unit` compila e testa senhas, validação e JWT. `npm run test:integration` constrói um ambiente isolado e testa concorrência, autorização, paginação, expiração e recuperação; inclui falha de gravação e falha de publicação injetadas somente pelo teste. `npm run test:e2e` usa Chromium real com duas sessões, offline, reload, saída e viewports desktop/celular.

Antes do E2E, execute `npx playwright install chromium`. As suítes isoladas informam o diretório temporário; `execution.log` fica no diretório pai e relatório/capturas ficam em `source/playwright-report` e `source/test-results`. Um teste falho encerra a suíte com código diferente de zero e preserva o log. Volumes são preservados, sem apagar banco de desenvolvimento.

`node tests/clean-clone.mjs` verifica um clone local sem dependências, chaves ou configuração anterior e repete preparação, tipos, build e smoke. Os resultados efetivamente executados estão em [PROGRESSO.md](PROGRESSO.md); essa lista de cenários não significa, por si só, que todos passaram.

## Limites desta entrega

Grupos continuam 501. Não há refresh token, revogação no logout ou confirmação de leitura. PostgreSQL, Redis, proxy e host continuam pontos únicos de falha. Os testes atuais não substituem os estudos futuros de queda de réplica e carga. Nenhuma publicação externa faz parte da execução local.
