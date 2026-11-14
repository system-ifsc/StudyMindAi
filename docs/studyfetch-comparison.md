# Recursos educacionais: diagnóstico e entrega por etapas

Data da consulta: 14/11/2026. Projeto existente: StudyMind AI (TanStack Start, React, Tailwind/shadcn, Supabase Auth/Postgres/RLS, Lovable AI Gateway). Nenhum projeto novo, redesign, alteração de cores ou mudança do planejador foi realizado.

## Referências confirmadas

Consulta às páginas públicas oficiais; não foi feito login em uma conta StudyFetch nem testados recursos pagos. As descrições abaixo confirmam oferta anunciada, não garantem detalhes internos de implementação.

- [StudyFetch](https://www.studyfetch.com/): tutor, estudo personalizado e ferramentas a partir de materiais enviados; anuncia também gravação de aulas, áudio, vídeo, jogos e recursos visuais.
- [Notes](https://www.studyfetch.com/features/notes): transforma materiais em notas organizadas e permite variar profundidade e nível das explicações.
- [Flashcards](https://www.studyfetch.com/features/flashcards): geração a partir de materiais.
- [Quizzes](https://www.studyfetch.com/features/quizzes): questionários a partir dos materiais.
- [Practice Tests](https://www.studyfetch.com/features/practice-tests): simulados.
- [Study Guide Maker](https://www.studyfetch.com/study-guide-maker): guias de estudo.

Múltipla escolha, verdadeiro/falso e discursivas são requisitos do usuário implementados nesta etapa; não se atribui essa combinação específica ao StudyFetch sem validação adicional.

## Inventário e lacunas

| Área | Encontrado antes | Entregue nesta etapa | Ainda necessário |
|---|---|---|---|
| Materiais | PDF com texto, TXT e Markdown; texto salvo, leitura, edição e busca | Leitura real de DOCX/PPTX; ações de IA sobre material autenticado ou texto colado | Arquivo original privado, OCR, associação persistente à disciplina/conjunto |
| Tutor | Chat real autenticado, contexto de um material, histórico em sessionStorage | Carregamento do material no servidor com RLS; opção de considerar progresso, temas de dificuldade e revisões | Conversas salvas no banco e por conjunto; recomendações proativas |
| Flashcards | CRUD manual, filtro por disciplina, algoritmo SRS | Geração por IA com revisão antes de salvar, disciplina, integração ao SRS | Vínculo relacional ao documento e conjunto; histórico detalhado de cada revisão |
| Exercícios | Banco fixo de 25 questões; respostas e métricas | Questionários/simulados de 5, 10 ou 20 questões; correção objetiva, avaliação discursiva por IA, explicações, resultados em Desempenho | Persistência dos enunciados, respostas textuais, feedback e tentativas agrupadas; retomada após sair |
| Resumos/guias | Importação e edição de textos | Resumo completo, simplificado, tópicos, conceitos e guia de revisão; salvar como material Markdown | Tipo específico e vínculo relacional ao documento original |
| Anotações | Edição de material importado | Criação manual no app; melhoria de explicação com IA; geração de cartões e exercícios | Associação relacional à disciplina, material e conjunto |
| Conjuntos de estudo | Ausente | Não implementado: depende de migração | Entidade própria e vínculos entre materiais, atividades, cartões e conversas |
| Personalização | Sessões, métricas por tema, revisão espaçada e planejador determinístico | Progresso real fornecido ao tutor quando o estudante solicita | Trilhas persistentes e acompanhamento por conceito/material |
| Recursos adicionais | Calendário, Pomodoro, metas e planejamento | Guias, prática interativa e explicações didáticas | Avaliar áudio/vídeo, gravação, jogos e análise visual separadamente |

## Auditoria técnica

- Inventário de rotas, componentes de seções, regras de domínio, repositórios, autenticação, API, configuração, testes e migrações existentes. Componentes base do design e arquivos gerados são reutilizados e preservados.
- Autenticação: Supabase e rotas autenticadas; `/api/assistant` verifica o bearer token com `getUser` no servidor.
- Banco remoto: consultado `information_schema.columns` do projeto conectado; oito tabelas existentes: profiles, subjects, tasks, study_sessions, flashcards, goals, materials e quiz_answers. Conferência com o histórico local em `drizzle/migrations`.
- RLS existente isola registros por `auth.uid()`. O Repo agora também aplica filtro explícito de proprietário nas leituras/atualizações/exclusões e oferece consulta individual por ID. O servidor usa cliente com token do próprio estudante, sem chave administrativa.
- `quiz_answers` guarda apenas identificador de questão, tema, acerto e data. Assim, os resultados alimentam métricas, mas o teste e o texto respondido não são recuperáveis depois de sair da tela. A interface informa esse limite.
- DOCX e PPTX são descompactados localmente com fflate, apenas para ler XML textual. Slides seguem a ordem da apresentação quando o manifesto está presente. São recusados DTD/entidades, XML inválido, mais de 200 slides ou mais de 20 MB de XML selecionado; não há OCR, macros, imagens nem fórmulas visuais. O texto de DOCX/PPTX é salvo como Markdown, conservando o nome original. PDFs acima de 200 páginas são recusados sem cortes e o worker é liberado após a leitura.
- Materiais guardam texto extraído, não o binário enviado. Resumos e anotações novos reutilizam essa persistência real e entram no backup versão 1 existente.
- Demo continua apenas em memória; não chama o endpoint de IA nem grava na conta real.

## Bloqueio das próximas etapas

As [regras do projeto](../AGENTS.md) reservam migrações e alterações de esquema ao Lovable. Identificou-se o projeto conectado comparando seu `supabase/config.toml` ao local. Foi enviada uma solicitação de mudanças exclusivamente aditivas via Lovable MCP, mas o serviço recusou a mensagem: **workspace sem créditos**. Nenhuma migração foi aplicada ou editada manualmente.

A configuração local também não contém `LOVABLE_API_KEY`. As chamadas ao modelo exigem configuração e créditos de IA; créditos de edição do Lovable e créditos do gateway são dependências diferentes. Os testes automatizados usam dublês de rede, não comprovam uma chamada real ao provedor.

### Sequência para concluir o escopo restante

1. Repor créditos do workspace e solicitar ao Lovable migrações aditivas com RLS e validação de propriedade das referências; preservar dados existentes.
2. Criar `study_sets`; acrescentar a materials disciplina, conjunto, origem, categoria e metadados do arquivo. Criar bucket privado com caminhos por usuário, limite de tamanho e políticas de acesso.
3. Criar `study_quizzes`, `study_attempts` e `study_conversations`, com vínculo a materiais/conjuntos, questões/avaliações estruturadas e histórico persistente. Acrescentar origem/conjunto aos flashcards.
4. Atualizar Repo Cloud/memória, backup de forma compatível, telas existentes e API; testar isolamento entre duas contas, remoções e importação antes de disponibilizar.
5. Construir personalização por conceito, resultados e revisões; manter planejamento como algoritmo determinístico, explicitamente rotulado.
6. Avaliar OCR, gravação, áudio/vídeo e jogos como etapas próprias; não há simulações desses recursos nesta entrega.

## Configuração e uso

1. Use as variáveis de [`.env.example`](../.env.example). Segredos de produção são gerenciados pelo Lovable; não envie valores no chat nem os coloque no código.
2. No servidor: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`. No cliente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` públicos. Não é necessária chave service role para estas funcionalidades.
3. Garanta créditos e acesso ao modelo já utilizado pelo projeto no gateway Lovable. Reinicie o servidor após mudar configuração. `GET /api/assistant` retorna apenas disponibilidade de configuração; não verifica saldo do gateway.
4. Em Materiais, crie uma anotação ou selecione um material e use **Estudar com IA**. Revise o resultado e salve o resumo/guia ou os cartões. Flashcards e Exercícios também permitem selecionar material ou colar texto.
5. No Assistente, selecione o material e, opcionalmente, marque a opção de considerar progresso. Peça explicações, exemplos, orientação ou recomendações.
6. Responda todas as questões geradas antes de corrigir. A IA avalia discursivas; a interface identifica essa avaliação e informa que ela pode errar. Uma falha não vira uma resposta falsa: é possível tentar registrar as questões restantes.

## Contrato da API

Todos os POSTs exigem `Authorization: Bearer <token>` e passam por `/api/assistant`; chamadas ao modelo só ocorrem em módulos `*.server.ts` pelo gateway existente.

- Chat: `{ "messages": [{ "role": "user", "content": "O que revisar?" }], "material_id": "UUID opcional", "include_progress": true }` → `{ "text": "..." }`.
- Geração: `{ "action": "generate", "tool": "summary", "material_id": "UUID", "count": 10 }` → `{ "output": { ... } }`. Ferramentas: summary, simplified, keypoints, guide, concepts, improve, flashcards, quiz, exam. Origem alternativa: `material: { name, content }` com texto do próprio usuário.
- Avaliação: `{ "action": "grade", "question": { ... }, "answer": "...", "material_id": "UUID" }` → `{ "evaluation": { "correct": true, "feedback": "..." } }`.

Limites: texto colado 15 mil caracteres; material salvo para IA até 60 mil, recusado integralmente acima disso, sem corte silencioso. Até 20 itens por geração. Até 20 pedidos por minuto por usuário **por processo**, compartilhados com chat e avaliação. Limite distribuído exige infraestrutura adicional. Referências de questões e cartões têm tamanho validado. Saída fora do contrato é recusada; nenhum conteúdo de fallback é criado. Documentos são tratados como dados não confiáveis; o modelo não recebe ferramentas com permissão de modificar dados.

## Verificação

Execute `npm run typecheck`, `npm test`, `npm run lint` e `npm run build`. Há testes das regras puras, validação e correção, extração real de DOCX/PPTX, integração dos componentes com Repo em memória (salvar resumo, criar anotação, retomar lote parcial de cartões, registrar resultados) e API autenticada com mocks para token inválido, material inacessível, limite de contexto, formato inválido, progresso e falhas de serviços.

Teste de aceitação com ambiente configurado: enviar material → gerar resumo → salvar → recarregar e conferir; gerar cartões → selecionar disciplina → salvar → revisar → conferir intervalo; gerar questões → responder objetivas e discursivas → corrigir → conferir Desempenho; sair/entrar em outra conta → verificar isolamento. Executar também em `/demo/materiais` para conferir criação em memória e aviso de IA desativada.

Esta é uma entrega incremental funcional sobre as tabelas atuais, **não a conclusão de toda a equivalência ao StudyFetch**. Funcionalidades dependentes de esquema permanecem explicitamente pendentes.
