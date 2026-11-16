# Roadmap StudyMind — entrega de 16/11/2026

## Estado verificável

Esta entrega implementa parte substancial do roadmap; não declara o produto pronto para produção. O projeto existente já possuía onboarding, disciplinas, atividades, calendário, planejamento determinístico, foco, metas semanais, revisão espaçada, métricas, geração/correção com IA e carregamento das seções sob demanda.

| Área solicitada | Entrega e limite |
|---|---|
| Segurança e estabilidade | Cache isolado por instância de Repo, limite de bytes de entrada, token Bearer obrigatório, respostas de IA sem cache, segredos fora do bundle e arquivo de ambiente retirado do índice Git. |
| RLS e relacionamentos | Lovable aplicou políticas por conta, referências compostas por proprietário e permissões mínimas. Os testes com duas contas reais e concorrência ainda precisam ser executados. |
| Conversas e memória | Conversas persistentes por disciplina, retomada manual do histórico, últimas 12 mensagens no contexto, material e progresso opcionais. Não há memória ilimitada nem recuperação semântica de todos os documentos. |
| Tutor personalizado | Professor, avaliador e revisão ativa; explicações introdutórias, intermediárias e avançadas. |
| Fontes e feedback | Material de contexto identificado a partir do Repo e feedback útil/precisa melhorar persistente. Identificação do material não equivale a uma citação verificada por página. |
| Simulados e respostas | Definições normalizadas, alternativas, respostas, correções e tentativas persistentes. Salvar progresso permite continuar em Exercícios. O aluno precisa salvar antes de fechar uma tentativa incompleta. |
| Arquivos privados | Originais no bucket privado study-materials; upload/download passam pelo Repo. Demo guarda blobs em memória. Texto extraído é salvo primeiro; uma falha no original é informada. |
| OCR e PDF | OCR local opcional em português/inglês para até 20 páginas sem texto; dependências e idiomas são baixados no primeiro uso. Impressão de materiais/resumos com opção nativa Salvar como PDF. |
| Integração e interface | Navegação única de Planejamento para plano, atividades e calendário; central de aprendizagem com ações por prazos, SRS, desempenho e última sessão. |
| Progresso e recomendações | Métricas reais existentes e sugestões determinísticas. Dificuldades só são sugeridas após pelo menos três respostas por tema. Não se presume domínio acadêmico a partir de poucos acertos. |
| Cotas e custos | Reserva atômica de pedidos por conta, limites diário/mensal e limite local por minuto; teto de saída por operação. São cotas de chamadas, não faturamento exato em moeda. |
| Backup e recuperação | V1 validado, paginado, aditivo e transacional; novos IDs evitam conflitos entre contas. Perfil atualizado na mesma transação. Conversas, conjuntos/tentativas completas e binários ainda não estão no backup V1. |
| Testes e performance | Integrações de retomada, feedback, repositório, OCR com doubles e regras puras. Seções, PDF e OCR carregados sob demanda. Leitura completa paginada evita histórico truncado. |
| Operação | CI de qualidade já existente; documentação de arquitetura, API e operação abaixo. Staging, monitoramento hospedado e recuperação de desastre precisam de configuração externa. |

## Banco gerenciado e sincronização

Projeto confirmado comparando o identificador público de backend com o arquivo de configuração remoto: [StudyMind no Lovable](https://lovable.dev/projects/8a0de338-571a-4d02-8866-14eeacadcd01).

O Lovable informou a aplicação das migrações 0002 (conteúdo normalizado e Storage), 0003 (reservas de IA), 0004 (importação aditiva), 0005 (privilégios mínimos) e 0006 (verificações de backup). Nenhum SQL foi escrito manualmente nesta cópia local. O retorno informou que o commit/sincronização final dos arquivos remotos ficou pendente. Sincronize pelo fluxo gerenciado antes de recriar o banco em outro ambiente.

Uma segunda solicitação, para estender a recuperação a conversas e tentativas completas, foi recusada por falta de créditos do workspace. Repor créditos e pedir essa extensão ao Lovable é necessário; não substituir essa dependência por gravação manual de migrações. Binários exigem backup próprio do Storage.

## Arquitetura

- Componentes chamam Repo para tabelas e arquivos. Cloud impõe user_id e usa JWT com RLS; memória isola a demonstração. Chaves do React Query incluem a identidade da instância de Repo para não reutilizar dados de outra conta.
- Regras de planejamento, SRS, métricas, recomendações, validação e reconstrução de atividades ficam em funções puras de src/lib/core. Mapeamentos de persistência e operações com rede ficam em src/lib/repo.
- A rota /api/assistant valida o token com Auth, valida e limita o corpo, lê materiais com o cliente do usuário e chama exclusivamente o gateway Lovable no servidor. A chave de serviço é usada somente pelas RPCs de cota.
- A gravação de uma conversa ocorre antes da chamada. Se salvar a resposta falhar, o texto permanece visível e pode ser salvo novamente com o mesmo ID.
- Questionários usam IDs estáveis. A gravação de várias tabelas é retomável, mas não atômica: falhas parciais exigem repetir Salvar. As definições incompletas não devem ser consideradas prontas para aplicação.

## API do assistente

GET /api/assistant devolve configured, indicando presença das variáveis requeridas. Isso não verifica saldo do gateway, disponibilidade de rede nem acesso efetivo ao modelo.

POST /api/assistant exige Authorization: Bearer TOKEN. Todas as respostas são JSON com Cache-Control: no-store.

- Chat: messages (1–12 mensagens; user/assistant; até 4000 caracteres cada), material_id opcional, include_progress opcional, mode teacher/evaluator/review, level simple/standard/advanced. Retorno: text e sources com id/nome do material utilizado como contexto.
- Geração: action generate, tool summary/simplified/keypoints/guide/concepts/improve/flashcards/quiz/exam, count de 1 a 20, material_id ou material {name,content}. Retorno: output validado.
- Correção: action grade, question discursiva validada, answer, material_id ou material. Retorno: evaluation {correct,feedback}.
- Erros: 400 entrada inválida, 401 sessão inválida, 404 material inacessível, 413 corpo acima de 300 mil bytes, 429 cota/frequência, 502 integração ou saída inválida, 503 configuração/serviço indisponível. Erros do gateway também podem devolver seus códigos 402/403.

Materiais salvos: até 60 mil caracteres por chamada. Texto colado: até 15 mil. Conteúdo longo é recusado, sem truncamento silencioso. Histórico enviado pela interface é limitado às últimas 12 mensagens e a 4000 caracteres por mensagem. Não há respostas fictícias quando o gateway não estiver disponível.

## Configuração e homologação

Use Secrets do Lovable para LOVABLE_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, AI_DAILY_REQUEST_LIMIT e AI_MONTHLY_REQUEST_LIMIT. Apenas as variáveis VITE_SUPABASE_* públicas vão ao navegador. Os dois limites devem ser inteiros positivos; o mensal deve ser pelo menos o diário.

Uma unidade corresponde a uma chamada ao gateway, incluindo correção discursiva. A reserva conta mesmo se uma chamada despachada falhar, pois ela pode ter custo. Reservas não finalizadas continuam contando. Os limites são provisionados para contas novas sem sobrescrever limites administrativos existentes; altere contas existentes pelo fluxo administrativo do Lovable. As janelas são UTC.

Crie um projeto separado de homologação pelo Lovable, aplique as migrações gerenciadas e use backend, Storage, Auth e Secrets próprios. Não apontar staging ao banco de produção. Configure URLs de redirecionamento de Auth para o domínio escolhido. Não há um ambiente remoto de homologação criado por esta entrega.

Antes da publicação:

1. Sincronizar os arquivos das migrações aplicadas pelo Lovable e concluir a extensão do backup.
2. Executar npm run check. A auditoria de dependências de produção usa npm audit --omit=dev.
3. Testar duas contas: usuário B não pode ler/alterar/excluir registros nem baixar objetos de A; tentar gravar vínculos cruzados deve falhar.
4. Testar salvar/recarregar conversa, feedback, material original e tentativa parcial. Falhar uma gravação intermediária e repetir sem duplicar.
5. Testar cotas concorrentes, virada das janelas UTC, conta desabilitada e indisponibilidade do gateway.
6. Fazer uma restauração em homologação. Confirmar que a importação adiciona dados e modifica o perfil; importar novamente duplica os registros deliberadamente.
7. Configurar retenção e backup/PITR do banco conforme o plano contratado, backup separado do Storage e rotina de restauração. Exportação JSON não substitui recuperação de desastre.
8. Conectar monitoramento/alertas para erros, latência e custo do gateway. Não registrar tokens, chaves, textos dos estudantes ou documentos em logs.
9. Validar responsividade e OCR com documentos reais no navegador. Testes de OCR com mocks não validam a precisão do reconhecimento nem downloads dos idiomas.

A publicação e a contratação/configuração de infraestrutura não foram realizadas.

## Verificação desta entrega

A suíte passou com 63 testes em 9 arquivos. A checagem de tipos passou; o lint não encontrou erros e manteve 14 avisos de Fast Refresh já existentes. A auditoria das dependências de produção retornou zero vulnerabilidades conhecidas. A rota de demonstração respondeu HTTP 200 no servidor local. O navegador integrado não ficou acessível nesta sessão, portanto não se afirma validação visual ou teste real do OCR. Testes de IA, Storage e banco usam mocks ou Repo em memória; falta a aceitação com contas reais nas novas tabelas.
