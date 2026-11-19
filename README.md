# StudyMind AI

Organização de estudos em português: disciplinas, atividades, planejamento determinístico, Pomodoro, flashcards, exercícios, materiais e tutor opcional. Aplicativo independente com React 19, TanStack Start, Vite, Tailwind e servidor Node. O backend padrão usa SQLite local; Supabase é opcional. Não exige conta em editor de aplicativos.

## Instalar

O catálogo oferece somente **Informática para Internet**, **Agroecologia**, **Biotecnologia** e **Mecatrônica**. Escolha o curso no onboarding ou nas configurações; disciplinas sugeridas e exercícios fixos contemplam as quatro áreas. As sugestões não representam uma matriz curricular oficial. A demonstração começa em Informática e permite explorar os demais cursos nas configurações e no filtro de exercícios.

Para a versão Android (APK), veja o [projeto Android](./android/README.md), com configuração do servidor e geração pelo GitHub Actions ou SDK local.

Requer Node 22.13+ e npm. Não precisa de Supabase, Docker ou serviços externos para criar conta e salvar estudos.

```bash
npm ci
npm run setup:check
npm run dev
```

Abra http://localhost:8080/cadastro, crie sua conta, guarde o código de recuperação e conclua o onboarding. O banco é criado automaticamente em `data/studymind.sqlite`. Dados e arquivos persistem após recarregar ou reiniciar o servidor. O modo `/demo/*` continua separado, apenas em memória.

## Backend local (padrão)

Na ausência das variáveis do Supabase, o app seleciona SQLite. Para usar o modo local mesmo com variáveis antigas, defina `VITE_BACKEND=local` no `.env` e refaça o build. O arquivo [`.env.example`](./.env.example) já usa esse padrão. Cliente e servidor precisam usar o mesmo modo; não se alterna de backend após uma falha de rede.

- Cadastro e login com e-mail/senha, sessão em cookie HttpOnly, senha com scrypt e Bearer curto para a API de IA.
- Recuperação sem e-mail: o código privado exibido no cadastro redefine a senha, invalida as sessões e é substituído por um novo código. Guarde-o; não há envio fictício de e-mails.
- Perfil, disciplinas, atividades, sessões, cartões, metas, materiais, conversas, simulados e arquivos privados passam pelo Repo e ficam no servidor, separados por usuário.
- `LOCAL_DATA_DIR` altera a pasta de armazenamento (padrão `./data`). Ela contém dados privados e está fora do Git.
- Para backup integral local, pare o servidor e copie a pasta de dados inteira para local seguro. O JSON v2 da interface inclui todos os estudos, conversas, simulados e arquivos originais, mas não contas/senhas. O snapshot administrativo inclui o backend local inteiro; veja [operação e recuperação](./docs/operacao-e-recuperacao.md).

Para hospedar esse modo, use um servidor Node com disco/volume persistente, HTTPS e uma única instância compartilhando esse banco. Hospedagens com sistema de arquivos temporário ou apenas estático não preservam o SQLite. Não exponha a pasta de dados como diretório público. Se usar proxy reverso, configure `APP_ORIGIN` com a origem HTTPS pública quando a origem interna for diferente.

Google depende de um provedor externo e fica oculto no modo local. Cadastro/login próprios funcionam sem Google.

## Servidor compartilhado pelo site e Android

A instalação com Docker Compose na raiz inclui o servidor Node, SQLite em volume persistente e HTTPS automático com Caddy. Em um servidor com Docker Compose, aponte o DNS do seu domínio para o servidor e libere as portas 80 e 443. Execute, substituindo o domínio:

```bash
STUDYMIND_DOMAIN=estudos.seudominio.com docker compose up -d --build
```

Abra `https://estudos.seudominio.com/cadastro`. Gere o APK com `studyMindServerUrl=https://estudos.seudominio.com` ou informe essa mesma origem no workflow Android. Contas e estudos ficam no mesmo servidor; cada dispositivo entra com o mesmo e-mail e senha. O volume `study-data` preserva contas, arquivos e sessões após recriar o contêiner. Não execute `docker compose down -v`, pois esse comando apaga os volumes. Esta instalação cria um banco novo no volume; não importa automaticamente o banco de desenvolvimento existente.

O contêiner não copia o arquivo `.env` nem credenciais locais. A IA é opcional e pode ser configurada por variáveis de ambiente apenas no serviço `app`. Antes de distribuir, valide também o APK em um aparelho Android; os testes mobile do Playwright cobrem o navegador, não o WebView nativo.

## Supabase opcional: configurar cadastro e login

1. Defina `VITE_BACKEND=supabase` e crie um projeto no [painel Supabase](https://supabase.com/dashboard).
2. Copie a URL e a chave **publishable** (ou anon pública) para `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no arquivo `.env`. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com os mesmos valores para o servidor. Nenhuma chave administrativa é necessária para cadastro/login.
3. Copie a conexão PostgreSQL do painel **Connect** para `DATABASE_URL`. Se sua rede não tiver IPv6, use o pooler de sessão. A senha é a senha do banco, não a chave pública. Execute `npm run db:setup` para instalar tabelas, RLS, criação automática do perfil, Storage privado, backup e cotas de IA.
4. Em **Authentication**, habilite cadastro e o provedor de e-mail/senha. Em **URL Configuration**, defina a Site URL e autorize `http://localhost:8080/auth/callback` e `http://localhost:8080/reset-password`. Na publicação, autorize as mesmas rotas no seu domínio HTTPS.
5. Para confirmação e recuperação por e-mail em produção, configure SMTP próprio no Supabase. O envio padrão tem restrições e não substitui um serviço de e-mail de produção. Confira [a documentação de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
6. Reinicie `npm run dev` após alterar o ambiente. Em produção, faça novo build após alterar variáveis `VITE_*`.

O cadastro chama Auth diretamente. Se a confirmação estiver habilitada, o usuário recebe um link; a rota `/auth/callback` valida a sessão e leva ao onboarding. Se o backend entregar uma sessão imediatamente, o cadastro abre o onboarding. A recuperação valida a sessão antes de permitir salvar a senha. É possível reenviar a confirmação pela tela de cadastro.

Google é opcional: configure suas credenciais no provedor Google do Supabase, autorize o callback do Supabase no Google Cloud e somente então defina `VITE_GOOGLE_AUTH_ENABLED=true`. O login usa `supabase.auth.signInWithOAuth`, sem intermediário.

`npm run setup:check` verifica presença das variáveis e acessibilidade do Auth sem imprimir valores secretos. Não cria contas nem confirma entrega de e-mails.

## Banco e dados

As migrações PostgreSQL opcionais estão em [supabase/migrations](./supabase/migrations); o schema SQLite fica em [supabase/migrations/sqlite](./supabase/migrations/sqlite). No modo local, o banco é inicializado automaticamente ou por `npm run db:setup`. As instruções a seguir nesta seção sobre transações PostgreSQL aplicam-se ao modo Supabase. `npm run db:setup` aplica tudo em uma transação, registra checksums e pode ser repetido. Para proteger dados, recusa um banco com tabelas StudyMind preexistentes sem esse histórico. Não aplica SQL no backend antigo e não migra usuários automaticamente.

O diretório [drizzle](./drizzle) contém apenas o histórico legado; não é a fonte para uma instalação nova. A transferência de contas existentes exige um plano próprio de exportação/importação de Auth e Storage. O backup JSON v2 recupera todos os dados de estudo e arquivos originais; v1 continua aceito. Nenhum JSON da interface transfere usuários ou senhas. A importação é aditiva e preserva referências com novos IDs. Veja [operação e recuperação](./docs/operacao-e-recuperacao.md).

Toda operação da interface passa pelo contrato Repo: SQLite ou Supabase para contas reais e memória para demonstração. As tabelas têm RLS; referências compostas impedem vínculos entre contas. Arquivos ficam no bucket privado `study-materials`. Sessões são idempotentes por `(user_id, client_id)`.

## Desenvolvimento com Supabase local

Também é possível usar Supabase local, com Docker e CLI Supabase atual (v2.108+ ou v3):

```bash
npx supabase start
npx supabase status
```

A CLI aplica as migrações e informa URL/chaves locais; coloque os valores no `.env`. Neste caminho não execute `db:setup`, pois a CLI gerencia seu próprio histórico. O servidor de e-mails de teste fica em http://localhost:54324 e permite validar confirmação e recuperação sem enviar mensagens reais. Veja [o guia oficial](https://supabase.com/docs/guides/auth/testing-auth-flows).

## IA independente e opcional

Escolha um provedor compatível com Chat Completions e configure apenas no servidor:

- `AI_BASE_URL`: endpoint do provedor, normalmente terminado em `/v1`.
- `AI_MODEL`: identificador de um modelo disponível na sua conta.
- `AI_API_KEY`: chave do provedor.
- Somente no modo Supabase: `SUPABASE_SERVICE_ROLE_KEY`, usada pelas cotas no servidor. No modo local, as cotas ficam no SQLite e não precisam de chave administrativa.
- `AI_DAILY_REQUEST_LIMIT` e `AI_MONTHLY_REQUEST_LIMIT`: inteiros positivos; mensal maior ou igual ao diário. No modo local, os padrões são 20 e 200.

O tutor, a geração e a correção discursiva usam `/api/assistant` com Bearer verificado e cotas distribuídas. Sem essas configurações, o app avisa e não fabrica respostas. Cadastro, planejamento, estudo e banco fixo de exercícios funcionam sem IA. `GET /api/assistant` informa a configuração; não testa saldo ou acesso ao modelo.

## Testar e publicar

```bash
npm run check
npm run build
npm start
```

O build padrão gera `.output/server/index.mjs`, pronto para servidor Node. O Nitro também permite publicar em outros destinos, como Vercel, conforme [a documentação do TanStack](https://tanstack.com/start/latest/docs/framework/react/guide/hosting). Configure variáveis no provedor escolhido e os redirects de Auth no Supabase. O arquivo `.env` local não configura sua hospedagem. Sirva pelo processo Node ou adaptador de servidor; uma hospedagem apenas estática não executa a API.

### Publicar na Vercel

O SQLite local exige disco persistente e não funciona como banco de contas nas Functions da Vercel. Uma instalação com `VITE_BACKEND=local` pode renderizar páginas, mas falhar ao cadastrar com “Não foi possível salvar os dados no servidor”. Mudar `LOCAL_DATA_DIR` para `/tmp` não resolve a persistência. O build na Vercel recusa essa configuração.

1. Crie ou use um projeto Supabase. Em Vercel → projeto → Settings → Environment Variables, configure `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para Production (e Preview, se usado). Copie a URL e a chave **pública** do mesmo projeto Supabase. Nunca use uma chave secreta em `VITE_*`.
2. Em um ambiente administrativo, configure `VITE_BACKEND=supabase` e `DATABASE_URL` no `.env` privado e execute `npm run db:setup`. Isso aplica as migrações versionadas sem apagar dados. A conexão administrativa não precisa ficar na Vercel para cadastro e login.
3. No Supabase, habilite Email em Authentication → Providers. Configure Site URL como `https://studyminds.vercel.app` e autorize `https://studyminds.vercel.app/auth/callback` e `https://studyminds.vercel.app/reset-password`. Configure SMTP para os e-mails de confirmação e recuperação.
4. Faça um novo deploy na Vercel: as variáveis `VITE_*` são incorporadas no build. Teste cadastro, confirmação, login e gravação de uma matéria no site e no aplicativo conectado ao mesmo domínio. O endpoint de saúde em modo Supabase informa `external-not-probed`; ele não substitui esses testes.

Para os recursos de IA, configure também as variáveis de servidor descritas acima com o mesmo projeto Supabase. Contas do SQLite existente não são transferidas automaticamente para o Supabase. Para continuar com SQLite, use o servidor com volume persistente descrito na seção de hospedagem independente.

## Limites

OCR depende do download inicial dos idiomas e da qualidade do documento. Pomodoro fica no navegador até concluir. A demonstração perde seus dados ao recarregar. Backups v1 mantêm seu escopo antigo; novos backups são v2, com limite de 64 MB. Os testes PostgreSQL usam PGlite com schemas mínimos de Auth/Storage: validam SQL, RLS, relacionamentos, perfil e cotas, mas não substituem testar envio de e-mail e OAuth no backend real.

## Confiabilidade e operação

Há testes E2E de desktop/celular no CI, Markdown seguro e cópia de respostas, backup v2, snapshots consistentes do SQLite, saúde em `/api/health` e métricas autenticadas em `/api/monitoring`. Consulte [o guia de operação e recuperação](./docs/operacao-e-recuperacao.md) para executar os testes, aplicar a migração opcional do Supabase e ensaiar a restauração sem sobrescrever dados.
