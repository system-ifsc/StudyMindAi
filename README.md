# StudyMind AI

Plataforma de organização de estudos em pt-BR: disciplinas, atividades, calendário semanal, planejador automático por prazo, Pomodoro, flashcards com revisão espaçada, metas, gráficos, exercícios comentados, materiais e assistente de IA.

## Expansão das ferramentas educacionais

Leitura de DOCX/PPTX, resumos e guias salvos, anotações manuais, geração de flashcards, questionários/simulados com correção e tutor contextualizado pelo progresso foram integrados às seções existentes. Veja o [comparativo, configuração, limites e etapas pendentes](./docs/studyfetch-comparison.md). Migrações para conjuntos, arquivos originais e histórico persistente aguardam créditos do Lovable; não foram aplicadas.

## Stack
- TanStack Start v1 (React 19, Vite 7, SSR) rodando como Worker (Cloudflare/workerd) — substitui o Vinext/App Router e o empacotamento "Sites" da versão original.
- Lovable Cloud (Postgres + Auth + RLS) — substitui Cloudflare D1/Drizzle e o login "ChatGPT/Sites".
- Tailwind CSS v4 + shadcn/ui; Recharts; pdf.js (extração real de texto de PDF no navegador).
- Assistente: Lovable AI Gateway via AI SDK, somente no servidor (`src/lib/ai/assistant.server.ts`, rota `POST /api/assistant`).

## O que mudou em relação ao ZIP original
| Original | Agora |
|---|---|
| Login hospedado ChatGPT (só funcionava no Sites) | Cadastro/login por e-mail e senha + Google, confirmação de e-mail e redefinição de senha |
| Estado inteiro em um JSON por usuário no D1 | Tabelas normalizadas com RLS por `auth.uid()` (`supabase/migrations` / `drizzle/migrations`) |
| Timer por `setInterval` | Pomodoro por timestamps, com pausa, sobrevive a recarregar; registro idempotente por `client_id` |
| 3 questões fixas | 25 questões comentadas em 5 temas, respostas gravadas e resultado agregado por tema |
| Sem plano automático | Planejador determinístico (algoritmo explícito, **não IA**) |
| Só TXT | TXT/MD (1 MB) e PDF com texto (10 MB), limite de 200 mil caracteres, leitura e edição |
| Sem IA | Assistente real no servidor; se a chave não existir, a tela informa e não simula respostas |
| Exportação JSON | Exportação + importação validada (zod) com confirmação de substituição |
| — | Modo demonstração em `/demo/*`, só em memória, separado dos dados reais |

Funções preservadas: disciplinas, atividades (data, duração, prioridade), sessões, indicadores, metas, cartões com revisão, banco de questões (as 3 originais mantidas), materiais, exportação, tema claro/escuro, método 80/20 (no Planejador), onboarding de nome/curso/meta.

## Executar localmente
```bash
bun install          # ou npm install
cp .env.example .env # preencha com a URL e a chave pública do seu backend
bun run dev          # http://localhost:8080
bunx vitest run      # testes
bunx tsgo -b --noEmit   # checagem de tipos (ou npx tsc --noEmit)
bun run build
```
O histórico do banco está em `drizzle/migrations/`. Alterações de schema e aplicação de migrações devem seguir o fluxo gerenciado pelo Lovable, conforme [AGENTS.md](./AGENTS.md). O assistente exige a variável de servidor `LOVABLE_API_KEY`; sem ela, `GET /api/assistant` responde `configured:false` e a tela avisa.

Melhorias recentes:
- O [`.env.example`](./.env.example) documenta variáveis públicas, privadas, cliente admin e segredos opcionais de rotinas agendadas.
- O planejador permite testar horizontes de 1 a 28 dias e blocos mínimos configuráveis sem alterar as atividades salvas.
- Materiais podem ser filtrados por nome ou conteúdo; flashcards podem ser filtrados por disciplina.
- O assistente mantém a conversa na sessão atual, permite limpá-la e aplica limite de 20 perguntas por usuário a cada minuto no servidor.
- O desempenho exibe a sequência atual de dias estudados.
- A aplicação inclui manifesto PWA e service worker com cache apenas de arquivos públicos em `/assets/`. Páginas autenticadas e respostas de API não são armazenadas; acesso completo offline ainda não está disponível.

## Estrutura
```
src/lib/core/      regras puras e testadas (planner, srs, pomodoro, metrics, backup, files, questions, dates, types)
src/lib/repo/      contrato Repo + implementação Cloud (real) e memória (demonstração)
src/lib/ai/        assistente (somente servidor)
src/hooks/         use-data (react-query + feedback), use-theme (tema persistido)
src/components/    app/ (shell, UI comum), sections/ (uma tela por seção), auth/, brand/
src/routes/        /, /login, /cadastro, /reset-password, /privacidade, /onboarding, /app/$section, /demo/$section, /api/assistant
```

## Limitações conhecidas
- PDFs digitalizados (imagem) não têm texto extraível — o upload é recusado com aviso; não há OCR.
- O Pomodoro depende do navegador (estado guardado no próprio aparelho); não sincroniza entre dispositivos até ser concluído.
- O planejador permite até 28 dias, mas não reserva pausas nem considera dependências entre atividades.
- O banco fixo foi preservado. Questionários e simulados gerados são corrigidos e seus resultados registrados, mas os enunciados e tentativas completas ainda não persistem entre sessões.
- Assistente guarda histórico apenas na sessão atual do navegador. A IA aceita materiais salvos de até 60 mil caracteres e textos colados de até 15 mil; materiais maiores são recusados sem truncamento silencioso.
- Importação substitui tudo; IDs vindos de outra conta podem conflitar (a importação falha sem apagar nada, pois roda em transação).
- O app não foi publicado em produção.

Próximas evoluções que dependem do schema do Lovable: histórico persistente do assistente, tags e pastas para materiais, questões personalizadas, notificações persistentes, OCR para PDFs digitalizados e sincronização do cronômetro entre dispositivos.
