# Reavaliação do StudyMind AI — 19/11/2026

Nota geral: **8,5/10**. A nota anterior era 7,8/10. Avaliação técnica subjetiva da versão local atual: houve avanço concreto em persistência do assistente, tratamento de falhas, apresentação das respostas, backup, restauração e automação. O projeto está bem estruturado para uso local e validação com usuários; ainda precisa de mais evidência operacional para receber uma nota de produto maduro em produção.

## Verificação executada novamente

- `npm run check`: passou. **119 testes em 17 arquivos**, TypeScript e compilação de produção aprovados. ESLint: zero erros e 14 avisos de Fast Refresh.
- `npm run test:e2e`: **8/8 passaram**, em uma execução de 1,3 minuto: quatro cenários em Chromium desktop e os mesmos quatro em emulação Pixel 7.
- Teste exploratório adicional de componente reproduziu o estado incorreto do botão de cópia após mudança de texto. O teste temporário foi removido depois da reprodução.
- Execução de uma cópia idêntica do utilitário de snapshot em um caminho com espaço reproduziu saída silenciosa sem criação do arquivo.
- `npm audit --json`: 11 entradas moderadas, nenhuma alta ou crítica. As cadeias afetadas são de desenvolvimento, ligadas a `drizzle-kit`/esbuild e `typescript-eslint`/minimatch. Essas entradas incluem dependências relacionadas e não representam 11 causas independentes. O resultado é uma auditoria de dependências, não uma prova de explorabilidade nem uma auditoria de segurança completa.
- Conferência da página compartilhada: painel autenticado disponível; identificado texto “1 dias”.

## Cobertura e seus limites

| Área | Evidência desta rodada | Resultado |
| --- | --- | --- |
| Autenticação e recuperação | Testes de interface/API: cadastro, login, código local, revogação e isolamento; cadastro/onboarding real em cada cenário E2E | Passou |
| Disciplinas e atividades | Criação, persistência após recarregar e inclusão no backup via navegador | Passou |
| Painel, calendário, metas e desempenho | Abertura das páginas no navegador; regras e métricas por testes automatizados | Passou nos cenários cobertos |
| Planejador | Regressões de prioridade, prazo, disponibilidade e dia local | Passou |
| Foco | Regras de pausa, retomada, encerramento e idempotência das sessões por testes | Passou; não repeti uma sessão completa cronometrada no navegador nesta rodada |
| Flashcards | Criação e revisão no navegador; algoritmo SRS por testes | Passou |
| Exercícios e simulados | Falha de confirmação após gravação real, nova tentativa sem duplicação; geração, correção e retomada por testes | Passou |
| Materiais | Upload TXT real no navegador; extração DOCX/PPTX/PDF e OCR por testes, alguns com serviços simulados | Passou nos cenários cobertos |
| Assistente e ferramentas de IA | Markdown, código, listas, cópia, contexto salvo e retomada via navegador; validação/API por testes | Passou; o cenário E2E usa conversa previamente gravada e disponibilidade simulada, sem chamar Gemini |
| Backup e restauração | Exportação/importação no navegador; 18 tabelas, arquivos, hashes, referências, corrupção, rollback e snapshot WAL por testes | Passou nos caminhos padrão |
| Monitoramento | Saúde e bloqueio de acesso anônimo no navegador; contadores, token e sanitização por testes | Passou; não simula operação prolongada nem entrega de alertas externos |
| Responsividade | Treze seções sem transbordamento horizontal nos dois perfis E2E | Passou; celular é emulado, não aparelho físico |

As cinco falhas do relatório anterior têm regressões aprovadas nesta execução. Isso aumenta a confiança nas correções; não significa que todas as combinações possíveis das funcionalidades foram exercitadas.

## Problemas confirmados

### 1. Snapshot administrativo não executa em caminho com espaços — prioridade média

Em [local-backup.mjs](../scripts/local-backup.mjs), a condição que detecta execução direta compara o caminho normalizado com `new URL(import.meta.url).pathname`. URLs codificam espaços como `%20`, mas o caminho do processo contém espaços normais. A condição fica falsa e a rotina não é chamada.

Reprodução: copiar o mesmo script para `data/audit path/local-backup.mjs` e executar `node 'data/audit path/local-backup.mjs' create data/audit-path-snapshot.sqlite`. O processo termina com código zero, sem mensagem, e o snapshot não existe. O caminho atual do projeto não contém espaços e os testes de snapshot nesse caminho passaram. A falha também afeta o comando de restauração quando o script estiver instalado em caminho com espaços.

Recomendação: converter `import.meta.url` usando `fileURLToPath`, adicionar regressão em pasta com espaços e exigir confirmação explícita da existência do snapshot no procedimento operacional.

### 2. Botão informa “Copiado” para resposta que ainda não foi copiada — prioridade baixa

[CopyText](../src/components/app/MarkdownContent.tsx) mantém `copied=true` mesmo quando a propriedade `text` muda. [StudyTools](../src/components/sections/StudyTools.tsx) reutiliza esse componente entre resultados de texto.

Reprodução em componente: copiar “Resposta antiga”, renderizar novamente o mesmo botão com “Resposta nova”. O rótulo continua “Texto copiado”, enquanto a área de transferência ainda contém “Resposta antiga”. Clicar novamente copia o texto novo corretamente; o defeito é o estado de confirmação enganoso.

Recomendação: associar a confirmação ao conteúdo efetivamente copiado e reiniciar a indicação quando houver novo resultado.

### 3. Concordância no painel — prioridade baixa

O painel compartilhado exibiu “1 dias”. [Overview](../src/components/sections/Overview.tsx) utiliza o plural fixo ao apresentar a sequência.

Recomendação: tratar singular/plural. É um detalhe pequeno, mas visível na apresentação profissional do produto.

### 4. Dependências com avisos moderados — prioridade média de manutenção

Atualizar e validar as cadeias de desenvolvimento afetadas, sem aplicar atualizações automáticas indiscriminadas. Os avisos consultados descrevem acesso indevido ao servidor de desenvolvimento esbuild e potencial negação de serviço no processamento de padrões minimatch. Os nós vulneráveis identificados no lockfile estão marcados como desenvolvimento. Não confirmei exploração desses avisos neste aplicativo.

## Melhorias prioritárias

1. Corrigir as quatro pendências acima e conservar regressões para os dois defeitos funcionais.
2. Ampliar os testes de navegador para editar/excluir registros vinculados, concluir foco, manipular calendário/metas, recuperar senha pela interface e retomar operações após navegação ou desconexão. Hoje algumas seções têm apenas abertura de tela no E2E, complementada por testes de regras/API.
3. Criar uma validação controlada do provedor real de IA, separada do CI comum, para detectar credencial inválida, mudança de modelo, demora, interrupção de streaming e indisponibilidade externa.
4. Programar backups e uma restauração periódica em ambiente separado, com verificação e alerta de falha. A implementação atual oferece ferramentas e testes, mas isso não substitui um procedimento operacional recorrente.
5. Ligar o monitoramento a alertas externos e definir limites de erro/latência e retenção. Contadores em memória reiniciam com o processo.
6. Fazer auditoria de acessibilidade com teclado/leitor de tela e testes de carga com volume representativo. A ausência de transbordamento não comprova toda a qualidade visual ou acessibilidade.

## Parecer

A arquitetura tem bons fundamentos: regras determinísticas separadas da interface, contrato Repo, isolamento da demonstração, SQLite persistente e IA no servidor. A cobertura de falhas e restauração melhorou bastante. Minha maior reserva é a distância entre os cenários automatizados atuais e a operação contínua em ambientes externos.

Não revalidei nesta rodada chamadas reais ao Gemini, Supabase hospedado, OAuth/SMTP externos, APK em aparelho físico, OCR com um acervo real, carga simultânea ou segurança por teste de invasão. Não encontrei falha bloqueadora nos cenários locais executados, mas não classifico o projeto inteiro como livre de erros. Esta rodada alterou apenas este relatório; os defeitos identificados permanecem para correção.
