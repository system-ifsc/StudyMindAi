# StudyMind AI — Menos dispersão. Mais direção.

Filme horizontal de **42 segundos**, 1280 × 720, 30 fps, MP4 H.264 com áudio AAC. Tipografia cinética centralizada, fundos de luz verde em movimento, cartões com entradas escalonadas, textos em português, identidade verde e trilha instrumental sintetizada localmente, sem locução. A mensagem funciona também com o som desligado.

- [Assistir e baixar](index.html)
- [Vídeo MP4](studymind-propaganda.mp4)
- [Storyboard](storyboard.jpg)
- [Capa](capa.jpg)
- [Renderizador](render.py)

## Direção da campanha

**Público:** estudantes que precisam conciliar disciplinas, prazos e volume de materiais.

**Promessa:** conectar organização, foco e revisão em uma rotina de estudos. A campanha apresenta ações concretas, sem prometer aumento de notas ou resultados garantidos.

**Chamada:** “Abra. Explore. Comece hoje.” A página encaminha para a demonstração sem cadastro. O endereço público e os créditos foram preservados do material anterior; confirme a disponibilidade da instalação antes de divulgar.

## Roteiro e direção visual

| Tempo | Mensagem | Recurso visual |
| --- | --- | --- |
| 00–06 | Por onde começar? | Abertura em dois momentos: “Provas. Prazos.” e “Por onde começar?”. |
| 06–12 | Menos dispersão. Mais direção. | Organização, estudo e revisão apresentados como uma sequência. |
| 12–18 | Sua rotina. Seu plano. | Prazos, disponibilidade e blocos de estudo; identificação do algoritmo determinístico. |
| 18–24 | Uma tarefa. Um momento. | Pomodoro com arco animado, pausas e registro de sessões. |
| 24–30 | Vá além da releitura. | Pilha de flashcards ilustrativa com troca de mensagem; repetição espaçada e prática. |
| 30–36 | Do conteúdo à prática. | Material → resumos, guias, cartões e questões; condição de configuração da IA visível. |
| 36–42 | Abra. Explore. Comece hoje. | Endereço, convite para a demonstração e créditos. |

Os cartões são **ilustrações dos recursos**, não capturas da interface. A página inclui roteiro textual acessível e reprodução manual, sem autoplay.

## Base da revisão

A análise percorreu a documentação geral, a organização das telas, as regras de planejamento e revisão, ferramentas de estudo, métricas, adaptadores de dados e documentação Android. Estas fontes sustentam as mensagens escolhidas:

| Mensagem publicitária | Evidência no projeto |
| --- | --- |
| Planejamento por prazo e disponibilidade | [Algoritmo](../src/lib/core/planner.ts) e [tela do planejador](../src/components/sections/Planner.tsx). |
| Pomodoro e sessões | [Foco](../src/components/sections/Focus.tsx). |
| Revisão com repetição espaçada | [SRS](../src/lib/core/srs.ts). |
| Materiais e geração de conteúdo | [Materiais](../src/components/sections/Materials.tsx) e [ferramentas de estudo](../src/lib/core/study-tools.ts). |
| Tempo e acertos registrados | [Desempenho](../src/components/sections/Performance.tsx). |
| IA condicionada à configuração | [Assistente](../src/components/sections/Assistant.tsx) e [configuração no servidor](../src/lib/ai/config.server.ts). |
| Demonstração separada dos dados reais | [Rota demo](../src/routes/demo.$section.tsx) e [Repo em memória](../src/lib/repo/memory.ts). |

Esta versão substitui a composição fixa em duas colunas por títulos centralizados, luz difusa em movimento, cartões escalonados e uma abertura com mudança de mensagem aos 2,5 segundos. Mantém seis segundos por etapa para preservar a leitura das funcionalidades e uma chamada final estável. A divulgação não afirma funcionamento completo offline, disponibilidade na Play Store, IA ilimitada ou melhoria garantida de desempenho. O [cliente Android](../android/README.md) é uma WebView dependente de servidor; por isso não é o foco desta peça.

## Editar e renderizar

Requer Python 3, Pillow, FFmpeg com libx264 e fontes Noto Sans em `/usr/share/fonts/noto/`. Na raiz do projeto:

```bash
python3 video/render.py
```

O comando recria o MP4, a trilha WAV, a capa e o storyboard nesta pasta. Textos estão em `SCENES`; o tempo por cena está em `SCENE_SECONDS`. Ao mudar a duração, atualize também `DURATION`, a amostra da capa, o roteiro e a página. Não há chamadas de IA, downloads ou acesso ao banco durante a renderização.

Para assistir, abra [index.html](index.html) no navegador. Para publicar esta página, sirva a pasta com seus arquivos de mídia no mesmo diretório. Para compartilhar apenas o filme, envie o MP4.

## Texto sugerido para publicação

Prazos chegando e conteúdo acumulado? Dê um próximo passo com o StudyMind AI. Organize suas tarefas, reserve tempo de foco e revise com flashcards e exercícios — tudo no mesmo lugar. Com IA configurada, transforme seus materiais em resumos e questões para praticar. Explore a demonstração: https://studyminds.vercel.app/demo/painel

#StudyMindAI #OrganizaçãoDeEstudos #Pomodoro #Flashcards

## Análise das três referências — 21/11/2026

Foram inspecionados metadados e oito quadros distribuídos ao longo de cada arquivo de [Referencia](../Referencia/). A análise é visual por amostragem; não inclui transcrição ou avaliação auditiva das trilhas originais. Os arquivos são gravações verticais de telas, e não os masters dos anúncios exibidos. O formato horizontal do anúncio existente foi mantido para aproveitar a área da peça, sem reproduzir o ambiente filmado.

| Arquivo | Formato e duração | Linguagem observada | Aplicação nesta versão |
| --- | --- | --- | --- |
| `WhatsApp Video 2026-11-21 at 13.31.40.mp4` | 576 × 1024; 34 s | Anúncio azul exibido em notebook; frases centralizadas, palavras destacadas, cartões de benefícios, sequência de três passos e CTA. | Narrativa de problema → solução → recursos → ação; destaques verdes e três cartões no planejamento. |
| `WhatsApp Video 2026-11-21 at 13.31.40(1).mp4` | 576 × 1024; 53,64 s | Tipografia em destaque, luz quente desfocada, palavras em cápsulas e elementos empilhados. | Luz difusa animada, revelação de frases por etapas, cápsulas e pilha de flashcards. |
| `WhatsApp Video 2026-11-21 at 13.31.40(2).mp4` | 576 × 1024; 11,7 s | Apresentação de produto com preto e verde, alternância de interface e frases curtas, assinatura final. | Contraste escuro/verde, telas com uma mensagem principal e encerramento com marca e endereço. |

Não foram incorporados pixels, marcas, falas ou músicas dessas referências. A trilha instrumental é a síntese local do renderizador; esta revisão concentra a mudança na direção visual. Não há locução.

## Leitura do projeto para orientar o filme

A análise abrangeu o mapa de rotas e seções, documentação geral e Android, núcleo de regras, contrato e adaptadores Repo, banco local e migrações, configuração e endpoint de IA e pipeline de qualidade. É uma revisão da arquitetura e das capacidades para comunicação do produto, não uma auditoria exaustiva de segurança nem homologação de todos os fluxos.

- **Produto:** a organização por Estudo, Prática e Conta permite contar uma jornada coerente, em vez de apresentar todas as telas. Calendário, metas, configurações e feedback são recursos de apoio e ficam fora dos 42 segundos.
- **Planejamento:** ordena tarefas por prazo, prioridade e critérios estáveis, distribuindo minutos conforme disponibilidade. A identificação como algoritmo determinístico permanece visível na peça.
- **Foco e revisão:** o temporizador usa timestamps; o registro é idempotente por cliente. O SRS adapta intervalos conforme a resposta. O filme mostra ações e não promete resultados acadêmicos.
- **Materiais e IA:** há saídas estruturadas para resumos, cartões e questões. A geração depende de provedor configurado no servidor. A condição e o pedido de revisão do conteúdo aparecem na cena.
- **Dados:** SQLite persistente é o padrão; Cloud é alternativa. A demonstração instancia Repo em memória. Isso fundamenta o CTA de explorar sem criar conta, sem anunciar persistência dos dados da demo.
- **Distribuição:** o cliente Android é WebView dependente do servidor. O filme não anuncia funcionamento integral offline nem distribuição pela Play Store.
- **Qualidade:** o projeto tem pipeline de lint, tipos, testes, build e E2E. Nesta tarefa foram executados os testes do núcleo: **62 testes aprovados**. A aplicação não foi alterada e o pipeline completo não foi executado.

## Validação desta entrega

A composição foi inspecionada em oito momentos, incluindo os dois momentos da abertura e todas as etapas seguintes. O MP4 é validado por metadados e decodificação completa após renderizar. A página de reprodução, capa e storyboard acompanham a versão atual. O endereço público é o já presente no projeto; a disponibilidade do serviço publicado não foi verificada nesta tarefa.
