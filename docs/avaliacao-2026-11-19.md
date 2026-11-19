# Avaliação do StudyMind AI — 19/11/2026

> Atualização: os cinco defeitos deste levantamento foram corrigidos posteriormente nesta sessão, com testes de regressão. Também foram implementados E2E no CI, Markdown com cópia, backup v2 e monitoramento/recuperação. O conteúdo abaixo preserva o diagnóstico original; consulte o [guia da implementação](./operacao-e-recuperacao.md) para o estado atual.

## Parecer e nota

**Nota geral: 7,8/10.** É um MVP funcional com uma base técnica bem organizada. O fluxo de estudo é útil e os dados realmente persistem. A confiabilidade em situações de falha e alguns detalhes das regras de planejamento ainda precisam evoluir antes de ampliar a distribuição.

A nota é uma avaliação técnica, não uma certificação de segurança ou garantia de ausência de defeitos. Média simples dos critérios:

| Critério | Nota | Motivo |
| --- | --- | --- |
| Arquitetura e manutenção | 8,5 | Repo, núcleo de regras, SQLite persistente, migrações, IA no servidor e CI. |
| Funcionalidades | 8,0 | Organização, planejamento, foco, materiais, revisão e IA funcionam; backup e integração Android têm limitações. |
| Experiência e apresentação | 7,5 | Estrutura consistente e adaptação às larguras verificadas; faltam acabamento das respostas, recuperação de erros e melhor descoberta do histórico. |
| Confiabilidade | 7,0 | 103 testes passaram, mas os testes exploratórios encontraram cinco defeitos que a suíte não detecta. |

## Método e resultados gerais

- Backend real local com SQLite e uma conta criada exclusivamente para avaliação. Os registros das outras contas não foram editados.
- Desenvolvimento na porta 8081 e build Node de produção na porta 8082. A instância original da porta 8080 não foi reiniciada.
- `npm run lint`: zero erros e 14 avisos de Fast Refresh.
- `npm run typecheck`: passou.
- `npm test`: **103 testes em 13 arquivos passaram**.
- `npm run build`: passou.
- `npm run setup:check`: passou com backend local e IA configurada.
- A chave configurada do provedor não foi encontrada nos arquivos públicos gerados pelo build. Isso é uma verificação específica, não uma auditoria completa de segredos.
- As 13 seções autenticadas abriram no navegador na versão de produção, em desktop e em viewport de **390 × 844**. Não houve alertas de erro nem transbordamento horizontal nas medições feitas. Isso não substitui testes em dispositivos físicos ou uma auditoria completa de acessibilidade.

## Cobertura por área

| Área | Evidência obtida | Limites |
| --- | --- | --- |
| Cadastro e onboarding | Conta criada no navegador, código de recuperação exibido, curso/objetivo/disponibilidade salvos e acesso ao painel. Logout, redirecionamento de rota protegida e novo login confirmados no navegador; registros preservados. | Recuperação e revogação também cobertas pela suíte local real. |
| Disciplinas e atividades | Criação pela interface, vínculo da atividade à disciplina e presença após navegar/recarregar. | Exclusão, desvinculação e isolamento adicional verificados pela suíte. |
| Calendário e planejamento | Telas carregaram, atividade apareceu no plano; regras da suíte passaram. | Dois defeitos adicionais reproduzidos nas funções reais, descritos abaixo. |
| Pomodoro | Iniciado, preservado ao navegar entre telas, pausado e registrado depois de mais de um minuto. Painel passou a mostrar o minuto estudado. | Retomada após fechamento, pausa, limite e idempotência também têm testes automatizados. Não foi esperado um ciclo completo de 25 minutos. |
| Flashcards | Cartão manual criado, resposta revelada, avaliação “Bom” aplicada e cartão retirado da revisão de hoje. | Intervalos e repetição são cobertos pela suíte. |
| Exercícios fixos | Rodada iniciada e primeira resposta persistida; segunda resposta submetida com falha de gravação simulada. | A falha revelou ausência de recuperação na interface. Não foram respondidas manualmente todas as questões do catálogo. |
| Materiais | Anotação criada; TXT enviado; texto e arquivo original salvos; download retornou HTTP 200 com conteúdo idêntico. | DOCX/PPTX têm testes de extração; PDF/OCR têm testes com dependências simuladas. OCR de um documento digitalizado real não foi validado nesta avaliação. |
| Assistente | Resposta real do Gemini via API autenticada, usando material salvo; fonte e conversa persistidas; feedback gravado. | Encontrado defeito na persistência das opções da conversa. |
| Geração com IA | API real retornou HTTP 200 para resumo, cinco flashcards e questionário de cinco perguntas, com tipos estruturados válidos. | Salvamento parcial de cartões e retomada de simulados têm testes de integração; nem toda variação de prompt foi executada com o provedor. |
| Correção discursiva | API autenticada real retornou HTTP 200, resposta correta e feedback para uma questão aberta sobre SELECT. | Uma resposta simples foi testada com o provedor; a qualidade pedagógica de todas as matérias não foi avaliada. |
| Metas e desempenho | Meta criada e marcada pela interface; desempenho e métricas carregaram após registros reais. | Não houve teste de carga com históricos grandes. |
| Configurações | Tema alterado e preservado; exportação acionada e aplicação confirmou geração do backup. | O evento de download não foi capturado pelo navegador automatizado; não se afirma validação do arquivo baixado por esse caminho. Importação e rollback foram validados pela suíte. |
| Dados e autenticação | Suíte com SQLite real: persistência após reabrir conexão, arquivos privados, referências entre contas, cookies, Bearer, recuperação e logout. PGlite: migrações/RLS/cotas. | PGlite e mocks não equivalem a testar SMTP/OAuth/Storage de uma instalação Supabase real. |
| Demonstração | Isolamento por Repo e cache verificados nos testes. | Não equivale a uma exploração manual completa de cada ação em demo. |

## Defeitos reproduzidos

### 1. Prioridade média pode ficar atrás da baixa no plano

**Prioridade de correção: alta.**

Origem: [adaptive-plan.ts](../src/lib/core/adaptive-plan.ts), função `buildAdaptivePlan`.

Reprodução: três tarefas de 30 minutos, mesmo prazo, capacidade suficiente e sem histórico de exercícios. Títulos “Z prioridade alta”, “Z prioridade média” e “A prioridade baixa”, com prioridades 3, 2 e 1. O resultado foi **alta → baixa → média**.

O algoritmo reserva o grupo de foco, mas converte as prioridades das outras tarefas para 1 na ausência de dificuldade observada. O desempate por título passa a colocar a baixa antes da média. A justificativa retornada ainda diz “prioridade original”.

Melhoria: preservar a prioridade original como critério explícito depois do prazo e dos critérios adaptativos, com um teste para tarefas fora do grupo de foco.

### 2. Sessões noturnas podem não descontar o tempo já estudado

**Prioridade de correção: alta.**

Origem: [adaptive-plan.ts](../src/lib/core/adaptive-plan.ts), filtro de sessões em `adaptiveTasks`.

Reprodução: tarefa de 30 minutos e sessão de 30 minutos em `2026-11-20T01:00:00.000Z`. Em São Paulo, é **19/11 às 22h**. Ao planejar para `2026-11-19`, o algoritmo retornou **30 minutos restantes**, em vez de zero.

O filtro corta a data UTC da string, enquanto o restante da aplicação usa datas locais. O plano pode sugerir repetir um estudo concluído naquela noite.

Melhoria: adotar uma convenção única de dia de estudo, normalizar a data antes da comparação e testar a virada de dia nos fusos suportados.

### 3. Resposta de exercício perdida quando a gravação falha

**Prioridade de correção: alta.**

Origem: [Exercises.tsx](../src/components/sections/Exercises.tsx), função `answer` e botão de próxima questão.

Reprodução na versão de produção: primeira resposta gravada normalmente; na segunda, apenas a requisição de inserção de `quiz_answers` recebeu HTTP 500 simulado. A interface exibiu o erro, mas manteve todas as alternativas bloqueadas e o botão **Próxima habilitado**, sem botão para tentar salvar novamente.

O resultado local avança sem que a resposta entre nas métricas. É um defeito de tratamento de falha; não foi uma indisponibilidade espontânea do servidor.

Melhoria: manter a resposta pendente, permitir nova tentativa e usar identificador estável para evitar duplicação quando o servidor salvar, mas a confirmação se perder.

### 4. Opções alteradas do assistente não são preservadas na conversa

**Prioridade de correção: média.**

Origem: [Assistant.tsx](../src/components/sections/Assistant.tsx), criação e retomada de conversa.

Reprodução: conversa criada em Professor; selecionar Revisão ativa; abrir uma nova conversa e reabrir a anterior no histórico. O campo voltou a **Professor**.

As opções são gravadas na criação, mas as alterações posteriores ficam somente no estado da tela. O mesmo mecanismo merece revisão para material e nível.

Melhoria: definir claramente se as opções pertencem à conversa ou a cada pedido e persistir as alterações conforme essa decisão.

### 5. Disponibilidade aceita no formulário é rejeitada pelo servidor

**Prioridade de correção: baixa, caso extremo.**

Origem: [AvailabilityEditor.tsx](../src/components/app/AvailabilityEditor.tsx), [Settings.tsx](../src/components/sections/Settings.tsx) e [backup.ts](../src/lib/core/backup.ts).

Reprodução: preencher os sete dias com 960 minutos, valor permitido em cada campo. A tela calcula 112 horas semanais. Salvar retorna HTTP 400 com “Dados inválidos”, porque o schema limita a meta a 100 horas. O perfil anterior foi preservado.

Melhoria: alinhar os limites do produto e indicar o problema junto ao formulário antes do envio, com mensagem específica.

## Melhorias recomendadas

1. **Confiabilidade antes de novas telas:** corrigir os três primeiros defeitos e acrescentar testes de regressão para os casos reproduzidos.
2. **Testes de navegador no CI:** adicionar cadastro → onboarding → atividade → foco → revisão, retomada do assistente e falha de rede. A suíte atual usa Vitest/Testing Library; não há uma suíte E2E de navegador configurada.
3. **Acabamento das respostas:** renderizar Markdown com segurança para mostrar listas, títulos e código corretamente; atualmente as marcações podem aparecer como texto. Adicionar copiar resposta e rolagem acompanhando novas mensagens, respeitando quem voltou para ler mensagens anteriores.
4. **Histórico e contexto:** facilitar encontrar conversas e mostrar um resumo discreto do material/modo ativo quando o contexto estiver recolhido. Persistir a escolha por conversa.
5. **Backup recuperável completo:** incluir conversas, simulados e binários em uma versão futura. O backup V1 avisa suas exclusões, mas não recupera toda a experiência do usuário.
6. **Operação:** backup automatizado do volume SQLite, ensaio de restauração, monitoramento de erros/latência e prazo máximo para chamadas de IA. A ausência de timeout próprio foi observada no código; não foi demonstrado um travamento permanente do provedor.
7. **Desempenho:** medir carregamento em celular e rede lenta antes de otimizar. O build tem chunks de aproximadamente 385 KB para a entrada, 412 KB para desempenho e 445 KB para PDF, sem compressão; isso é um indício para medição, não prova de lentidão. Parte dos módulos já é carregada sob demanda.
8. **Consistência e acessibilidade:** revisar feedback de salvamento, estados de carregamento, foco, leitura por leitor de tela e pequenas mensagens como “1 dias” e o botão “Close”. Tratar os 14 avisos de Fast Refresh como manutenção de baixa prioridade.
9. **Privacidade apresentada ao usuário:** atualizar o texto explicativo para contemplar histórico enviado ao modelo e progresso opcional, além da pergunta/material. Isso é uma observação de consistência entre interface e comportamento, não uma análise jurídica.

## O que não foi certificado

- Não houve pentest, auditoria de dependências por base de vulnerabilidades, teste de carga ou medição de Core Web Vitals.
- Não houve execução em Safari, Firefox, aparelho físico ou leitor de tela.
- Não foram testados envio real de e-mail, OAuth Google e infraestrutura Supabase externa.
- O Android foi inspecionado por código/documentação; não havia JDK/Gradle disponíveis para compilar ou executar o APK. É um cliente WebView dependente do servidor, com limitações documentadas para downloads `blob:` e impressão.
- Os cliques automatizados tiveram dificuldades de estabilidade/animação no navegador integrado. Parte das ações foi acionada pelo evento do elemento, e as navegações foram repetidas na versão de produção. Não classifiquei essa dificuldade de automação como defeito comprovado para usuários humanos.
- Nenhuma implementação funcional foi corrigida nesta avaliação. Os cinco problemas continuam como itens de correção. Foi criado este relatório; as alterações de implementação já existentes na sessão foram preservadas.

O próximo investimento com maior retorno é uma rodada de confiabilidade: prioridades/fuso do planejador, recuperação de gravações e persistência do contexto. A base atual permite fazer isso sem reescrever o projeto.
