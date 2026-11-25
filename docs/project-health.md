# Verificação do backend independente

O app agora funciona sem Supabase. O backend padrão usa SQLite no servidor e cria o banco automaticamente. Contas, perfil, estudos e arquivos persistem em disco; a demonstração permanece em memória.

## Validação

Os testes locais executam o SQLite real e a API: cadastro, login, perfil, sessão privada, Bearer assinado, revogação, recuperação por código, isolamento entre contas, bloqueio de referências cruzadas, arquivos privados, importação validada e cotas de IA sem Supabase.

O teste de persistência fecha a conexão e reabre o mesmo banco. Os testes de frontend também cobrem o caminho Supabase opcional. O comando `setup:check` aceita o modo local sem exigir URL, chave ou acesso de rede.

Para executar e hospedar, veja [README](../README.md). A pasta local precisa de disco persistente e backup. IA requer um modelo configurado; respostas não são simuladas. Google e e-mail dependem de serviços externos e não fazem parte da autenticação local.

## Registro histórico da verificação inicial

- `npm run check`: 119 testes em 17 arquivos; TypeScript e build passaram. Lint sem erros, com 14 avisos de Fast Refresh preexistentes.
- `npm run setup:check` e `npm run db:setup`: sucesso sem variáveis Supabase.
- Navegador: conta local criada, código de recuperação exibido, onboarding concluído, disciplina criada e preservada após recarregar; sair e entrar novamente funcionou.
- As 13 seções autenticadas abriram no backend local.
- `npm start` iniciou o build Node de produção. A pasta local de dados permanece fora do Git.

## Confiabilidade e recuperação

Os cinco defeitos identificados na avaliação foram corrigidos com regressões. Oito casos E2E passaram em Chromium desktop e emulação de celular e agora integram o CI. Backup v2 inclui conversas, simulados e binários; os testes verificam restauração completa, corrupção, rollback, compensação de objetos no adaptador Cloud e snapshot SQLite consistente com WAL. Saúde, métricas protegidas e logs estruturados foram implementados. Consulte [operação e recuperação](./operacao-e-recuperacao.md).

## Correções do relatório de experiência de 21/11/2026

A rodada de implementação de 25/11 preserva o relatório original como evidência histórica e acrescenta:

- Campos do Foco coerentes com a sessão restaurada, inclusive para atividade concluída/excluída; duração inválida gera orientação antes de iniciar.
- Confirmação de cópia vinculada ao texto efetivamente copiado e CLI de backup compatível com caminhos contendo espaços.
- Fórmulas com KaTeX/MathML, HTML externo descartado e comandos não confiáveis desativados; dependências transitivas corrigidas e verificadas por testes de renderização, transformação TypeScript e lint.
- Ensino médio, ENEM/vestibulares e outro curso no catálogo, mantendo as opções anteriores e disciplinas personalizáveis.
- Roteiro “Prova amanhã”, caderno de erros com novas tentativas idempotentes e cartões, além de simulação temporária de disponibilidade no planejador.
- Revisão e edição dos flashcards gerados antes do salvamento; estimativas de leitura e dos intervalos do SRS.
- Contexto do tutor visível e citações literais conferidas no documento; a numeração bibliográfica é preservada na restauração do backup.
- Entrada direta do tutorial para criar uma atividade, preservando o passeio completo. Rótulos de navegação/fechamento em português e contato de feedback sem restrição a Gmail.

Os testes de IA usam respostas controladas: as instruções pedagógicas e a checagem de equações reduzem falhas específicas, mas não garantem a correção de respostas de um provedor real. Citações verificadas significam correspondência literal com o documento, não prova de que a conclusão está correta. Pacote de revisão offline com sincronização, alertas externos, agendamento operacional de backups e ensaios em APK/aparelho físico continuam fora desta implementação.

### Validação final desta rodada

- 212 testes unitários e de integração em 25 arquivos aprovados, incluindo PostgreSQL/PGlite, SQLite, backup com caminhos contendo espaços e preservação da numeração das fontes.
- 32 cenários de navegador aprovados: 28 regressões anteriores e quatro novos cenários, distribuídos entre Chromium desktop e emulação mobile.
- `npm run typecheck`, `npm run lint` e build padrão aprovados. O lint mantém 14 avisos preexistentes de Fast Refresh, sem erros.
- Auditoria final de dependências: zero vulnerabilidades conhecidas no resultado consultado nesta rodada.
- Cadastros E2E protegidos por verificação do backend SQLite; dados de teste isolados. O build padrão foi restaurado conforme as variáveis existentes, sem editar essas variáveis.

Um ensaio simultâneo de banco/navegador atingiu o tempo-limite de inicialização do banco. A execução final isolada passou com os limites originais dos testes. Não houve publicação, commit ou push.
