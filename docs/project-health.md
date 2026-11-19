# Verificação do backend independente

O app agora funciona sem Supabase. O backend padrão usa SQLite no servidor e cria o banco automaticamente. Contas, perfil, estudos e arquivos persistem em disco; a demonstração permanece em memória.

## Validação

Os testes locais executam o SQLite real e a API: cadastro, login, perfil, sessão privada, Bearer assinado, revogação, recuperação por código, isolamento entre contas, bloqueio de referências cruzadas, arquivos privados, importação validada e cotas de IA sem Supabase.

O teste de persistência fecha a conexão e reabre o mesmo banco. Os testes de frontend também cobrem o caminho Supabase opcional. O comando `setup:check` aceita o modo local sem exigir URL, chave ou acesso de rede.

Para executar e hospedar, veja [README](../README.md). A pasta local precisa de disco persistente e backup. IA requer um modelo configurado; respostas não são simuladas. Google e e-mail dependem de serviços externos e não fazem parte da autenticação local.

## Resultado final

- `npm run check`: 119 testes em 17 arquivos; TypeScript e build passaram. Lint sem erros, com 14 avisos de Fast Refresh preexistentes.
- `npm run setup:check` e `npm run db:setup`: sucesso sem variáveis Supabase.
- Navegador: conta local criada, código de recuperação exibido, onboarding concluído, disciplina criada e preservada após recarregar; sair e entrar novamente funcionou.
- As 13 seções autenticadas abriram no backend local.
- `npm start` iniciou o build Node de produção. A pasta local de dados permanece fora do Git.

## Confiabilidade e recuperação

Os cinco defeitos identificados na avaliação foram corrigidos com regressões. Oito casos E2E passaram em Chromium desktop e emulação de celular e agora integram o CI. Backup v2 inclui conversas, simulados e binários; os testes verificam restauração completa, corrupção, rollback, compensação de objetos no adaptador Cloud e snapshot SQLite consistente com WAL. Saúde, métricas protegidas e logs estruturados foram implementados. Consulte [operação e recuperação](./operacao-e-recuperacao.md).
