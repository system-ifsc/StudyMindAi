# Operação, monitoramento e recuperação

## Verificar a entrega

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

O CI executa essas verificações, instala as dependências de sistema do Chromium e publica relatório, screenshot e trace quando há falhas. Os testes de navegador usam Chromium desktop e emulação Pixel 7, com fuso de São Paulo. Executam o build Node na porta 8190, com SQLite em `test-results/server-data`, IA externa desativada e contas exclusivas de teste. A instância e os dados usados normalmente pelo projeto não são reutilizados. Antes do E2E local, gere o build com `VITE_BACKEND=local` se seu ambiente estiver configurado para Supabase.

## Monitoramento

`GET /api/health` retorna HTTP 200 quando a aplicação responde e, no modo local, consegue consultar o SQLite. Falha local retorna 503. No modo Supabase, a resposta identifica que o serviço externo não foi sondado; não promete disponibilidade de Auth/Storage/IA.

Cada resposta recebe `X-Request-Id`. O servidor acumula número de requisições, eventos de erro, erros do cliente, latência média e uptime. `GET /api/monitoring` exige `Authorization: Bearer <MONITORING_TOKEN>`; sem configuração ou token válido retorna 401. O token fica apenas no ambiente do servidor. Os contadores são por processo e reiniciam junto com ele.

Configure no ambiente e reinicie o servidor:

```dotenv
MONITORING_TOKEN=gere-um-segredo-longo-e-privado
MONITORING_LOG_DIR=./data/monitoring
```

Com a pasta configurada, os eventos são persistidos em JSONL, com permissões privadas e rotação ao atingir aproximadamente 5 MB; um arquivo anterior é mantido. Erros também são enviados à saída padrão. Eventos incluem rota normalizada, status, duração e identificador, sem corpo de requisição/resposta, query string, cabeçalhos, e-mail, tokens ou conteúdo estudado. A gravação é assíncrona; falha da coleta não bloqueia o produto.

Erros JavaScript e rejeições não tratadas do navegador são contados quando há sessão válida; não enviam mensagens, stack ou dados do estudante. A coleta é limitada no cliente e no servidor. A demonstração não envia esses eventos ao banco/servidor real. A API de IA também tem prazo máximo de 60 segundos para comunicação com o provedor.

Para acompanhamento contínuo, um coletor pode consultar a saúde e as métricas protegidas ou ler JSONL/stdout. Esta implementação fornece os sinais; não configura uma conta externa nem envio de alertas por e-mail/Slack.

## Backup por conta na interface

Configurações → Exportar gera o **formato v2**, com perfil, todas as tabelas de estudo, conversas, mensagens, fontes, feedback, simulados, alternativas, tentativas e arquivos originais. Os binários são incluídos no JSON em base64 com SHA-256. Limite do arquivo completo: 64 MB; arquivos originais individuais continuam limitados a 10 MB. Contas, senhas, cookies e chaves de infraestrutura não fazem parte dessa exportação.

A importação verifica estrutura, referências, tamanhos e hashes antes de gravar. Cria novos IDs por tabela, recria caminhos privados e preserva relações. Adiciona os dados à conta atual e atualiza seu perfil; **reimportar cria cópias**, conforme o aviso da interface. Backups v1 continuam aceitos.

No SQLite, registros, binários e perfil são gravados em uma transação. Na memória da demonstração, a restauração permanece exclusivamente na memória. No Supabase, os objetos são enviados primeiro ao bucket privado e a nova RPC insere todas as linhas/perfil em uma transação com RLS. Em falhas confirmadas, o adaptador tenta remover os objetos novos. Se a remoção também falhar, será necessária limpeza administrativa. Se a resposta da RPC se perder e o estado não puder ser consultado, objetos são conservados para evitar apagar arquivos de uma importação confirmada; pode ser necessária reconciliação administrativa de objetos sem metadados. Storage e Postgres não compartilham uma transação física.

Antes de usar a importação v2 no Supabase, aplique a nova [migração SQL](../supabase/migrations/202611190001_full_backup.sql) pelo procedimento normal. Nenhuma migração anterior foi reescrita. A exportação/restauração pela interface depende das APIs de download/upload do navegador; o cliente Android WebView mantém as limitações de downloads documentadas no [guia Android](../android/README.md).

## Snapshot integral do backend local

Para recuperar **contas, hashes de senhas, configurações, registros e binários**, use o snapshot administrativo. É um arquivo privado; mantenha cópias em outro disco/servidor, com controle de acesso. Um SHA-256 detecta corrupção acidental, mas não autentica um arquivo contra adulteração intencional de quem também possa trocar seu checksum.

```bash
npm run backup:local -- create ./backups/studymind-2026-11-19.sqlite
```

O comando usa `VACUUM INTO` para uma cópia consistente, inclusive com dados no WAL, e grava um checksum ao lado do arquivo. Recusa sobrescrever um snapshot existente. O banco original não é resetado.

Para um ensaio ou recuperação, escolha uma pasta **que ainda não exista**:

```bash
npm run backup:local -- restore ./backups/studymind-2026-11-19.sqlite ./data-restaurada
```

O comando valida checksum, schema e `PRAGMA integrity_check`, restaura para a pasta nova e verifica o banco resultante. Recusa destinos existentes. Não altera a pasta em produção.

Para colocar a restauração em uso: pare a instância, preserve o volume anterior, configure `LOCAL_DATA_DIR` para a pasta restaurada, reinicie e verifique `/api/health`, login e download de um original. Faça esse ensaio em ambiente separado primeiro. Como o snapshot inclui sessões e a chave de assinatura, restaure somente snapshots confiáveis e considere revogar sessões em uma recuperação de incidente.

Os testes automatizados restauram as 18 tabelas entre contas, conferem relações e bytes, retomam um simulado restaurado, recusam hashes/referências inválidos, simulam falha de disco com rollback e restauram um snapshot em um segundo banco. Também verificam recusa de destino existente e checksum adulterado.

## Verificação desta entrega

- `npm run check`: 119 testes em 17 arquivos, tipagem da aplicação e E2E e build passaram; lint sem erros, com os 14 avisos de Fast Refresh preexistentes.
- Oito casos de navegador passaram: seis dos fluxos gerais e dois adicionais do assistente, em desktop e emulação de celular.
- As chaves configuradas de IA e monitoramento não foram encontradas nos assets públicos gerados.
- A integração Supabase foi validada com mocks de Storage e SQL real em PGlite; não houve implantação nem teste contra uma conta Supabase externa.
