# Instruções para agentes e colaboradores

## Objetivo da etapa atual

A etapa atual implementa o marco **Auth, interface e chat privado**, autorizado pelo usuário após aprovação do plano: migrações versionadas, cadastro/login, JWT, conversas privadas, mensagens persistentes, interface e testes. Termina quando duas sessões autenticadas conversarem e recuperarem histórico, com evidências em `docs/PROGRESSO.md`. Grupos, carga e estudos formais de queda ficam para tarefas posteriores. A dúvida de alta disponibilidade permanece aberta para a professora.

## Antes de qualquer alteração

1. Ler este arquivo, `docs/ARQUITETURA.md` e `docs/PROGRESSO.md`, além das instruções aplicáveis do ambiente.
2. Conferir o repositório, a branch e o estado do Git. Identificar alterações existentes e preservar o trabalho da dupla.
3. Entender a tarefa ou issue, os critérios de conclusão, os contratos e os componentes afetados. Se faltar uma decisão essencial, registrar a dúvida e solicitar esclarecimento.
4. Definir a menor alteração suficiente e a validação necessária. Conferir se ela corresponde à etapa autorizada.

## Durante o trabalho

- Usar branch por tarefa e PR focado, com revisão pelo outro integrante. Seguir a convenção do ambiente ao nomear branches.
- Reaproveitar a estrutura existente. Separar transporte, regras e persistência. Evitar abstrações sem uso concreto.
- Usar nomes descritivos e comentários que expliquem decisões, concorrência e tratamento de falhas. Documentar contratos públicos e procedimentos de execução.
- Validar entradas e autorização no servidor. Preservar idempotência, ordenação por conversa e consistência transacional.
- Manter configurações externas, exemplo de variáveis sem valores reais e versões reproduzíveis. Evitar senhas, tokens e conteúdo sensível nos logs.
- Para mudanças de dados, criar migração versionada e avaliar compatibilidade com dados existentes e réplicas em execução.
- Fazer alterações de arquitetura explicitamente no documento correspondente. Se afetarem o escopo, obter uma decisão do usuário antes de expandir a implementação.
- Operações destrutivas, publicação externa e alterações em infraestrutura exigem autorização aplicável à tarefa.

## Validação e conclusão de uma tarefa

1. Rodar as verificações relevantes para o comportamento alterado. No desenvolvimento, incluir tipos, build e testes pertinentes. Fluxos de concorrência e falha precisam de testes que reproduzam essas condições.
2. Conferir o diff e os critérios de aceitação. Documentação deve ser revisada quanto a requisitos, links, diagramas e consistência entre arquivos.
3. Atualizar `docs/PROGRESSO.md` ao iniciar, bloquear ou concluir um marco. Manter apenas o estado atual e referências curtas às evidências.
4. Informar o resultado, as validações realizadas e qualquer pendência. Distinguir validação planejada de teste efetivamente executado.
5. Parar ao atingir o critério da tarefa. Próximos marcos permanecem pendentes até receberem uma tarefa de desenvolvimento.

## Evidência e acompanhamento

Usar os estados `pendente`, `em andamento`, `bloqueado` e `concluído`. Conclusão exige documento revisado, PR ou resultado verificável. Se houver bloqueio, registrar causa e condição de desbloqueio. Evitar percentuais estimados e históricos extensos no acompanhamento.
