import type { QuizAnswer } from "./types";

/** Prioriza menor exposição; em empate, a questão há mais tempo sem resposta. */
export function selectPracticeQuestions(
  pool: Question[],
  answers: Pick<QuizAnswer, "question_id" | "answered_at">[],
  limit = 10,
): Question[] {
  const history = new Map<string, { count: number; last: string }>();
  for (const answer of answers) {
    const previous = history.get(answer.question_id) ?? { count: 0, last: "" };
    history.set(answer.question_id, {
      count: previous.count + 1,
      last: previous.last > answer.answered_at ? previous.last : answer.answered_at,
    });
  }
  if (!Number.isFinite(limit)) return [];
  return [...new Map(pool.map((q) => [q.id, q])).values()]
    .sort((a, b) => {
      const left = history.get(a.id) ?? { count: 0, last: "" };
      const right = history.get(b.id) ?? { count: 0, last: "" };
      return (
        left.count - right.count || left.last.localeCompare(right.last) || a.id.localeCompare(b.id)
      );
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}

/** Adaptação por tema com pelo menos três respostas; empates mantêm a seleção usual. */
export function selectAdaptiveQuestions(pool: Question[], answers: QuizAnswer[], limit = 10) {
  const topics = new Map<string, { total: number; correct: number }>();
  for (const a of answers) {
    const t = topics.get(a.topic) ?? { total: 0, correct: 0 };
    t.total++;
    t.correct += Number(a.correct);
    topics.set(a.topic, t);
  }
  const weakness = (topic: string) => {
    const t = topics.get(topic);
    return t && t.total >= 3 ? 1 - t.correct / t.total : 0;
  };
  if (!Number.isFinite(limit)) return [];
  return selectPracticeQuestions(pool, answers, pool.length)
    .sort((a, b) => weakness(b.topic) - weakness(a.topic))
    .slice(0, Math.max(0, Math.floor(limit)));
}

export interface Question {
  id: string;
  topic: string;
  q: string;
  opts: string[];
  correct: number;
  why: string;
}

/** Banco fixo e auditável de questões (não gerado por IA). As 3 originais foram mantidas (web-1, bd-1, log-1). */
export const QUESTIONS: Question[] = [
  {
    id: "agro-1",
    topic: "Fundamentos de Agroecologia",
    q: "Qual prática aumenta a diversidade de espécies cultivadas ao longo do tempo em uma área?",
    opts: [
      "Monocultivo permanente",
      "Rotação de culturas",
      "Impermeabilização do solo",
      "Retirada de toda a vegetação",
    ],
    correct: 1,
    why: "A rotação alterna as espécies cultivadas em uma área ao longo das safras.",
  },
  {
    id: "agro-2",
    topic: "Solos e Compostagem",
    q: "Na compostagem aeróbia, qual condição favorece a decomposição?",
    opts: [
      "Ausência total de oxigênio",
      "Material permanentemente submerso",
      "Aeração e umidade adequadas",
      "Somente resíduos plásticos",
    ],
    correct: 2,
    why: "A compostagem aeróbia depende de oxigênio e umidade para a atividade dos decompositores.",
  },
  {
    id: "agro-3",
    topic: "Sistemas Agroflorestais",
    q: "O que caracteriza um sistema agroflorestal?",
    opts: [
      "Somente árvores da mesma espécie",
      "Integração planejada de árvores com cultivos ou criação animal",
      "Ausência de plantas perenes",
      "Produção exclusivamente em laboratório",
    ],
    correct: 1,
    why: "Sistemas agroflorestais integram componentes arbóreos e agrícolas ou pecuários no espaço ou no tempo.",
  },
  {
    id: "bio-1",
    topic: "Biologia Celular",
    q: "Qual estrutura controla a passagem de substâncias entre a célula e o ambiente?",
    opts: ["Membrana plasmática", "Nucléolo", "Cromossomo", "Ribossomo"],
    correct: 0,
    why: "A membrana plasmática possui permeabilidade seletiva e delimita a célula.",
  },
  {
    id: "bio-2",
    topic: "Genética",
    q: "No DNA, qual base se pareia com a adenina?",
    opts: ["Citosina", "Guanina", "Uracila", "Timina"],
    correct: 3,
    why: "No pareamento complementar do DNA, adenina se liga à timina e citosina à guanina.",
  },
  {
    id: "bio-3",
    topic: "Bioquímica",
    q: "Qual é a função de uma enzima como catalisador biológico?",
    opts: [
      "Consumir-se em toda reação",
      "Reduzir a energia de ativação",
      "Impedir todas as reações",
      "Eliminar a necessidade de substrato",
    ],
    correct: 1,
    why: "Enzimas aceleram reações ao reduzir a energia de ativação, sem serem consumidas no processo catalítico.",
  },
  {
    id: "mec-1",
    topic: "Eletricidade e Circuitos",
    q: "Um resistor de 10 ohms recebe uma tensão de 20 volts. Qual é a corrente?",
    opts: ["0,5 A", "200 A", "2 A", "30 A"],
    correct: 2,
    why: "Pela lei de Ohm, I = V/R = 20/10 = 2 A.",
  },
  {
    id: "mec-2",
    topic: "Automação e Controle",
    q: "Qual componente converte uma grandeza física medida em um sinal utilizável pelo controle?",
    opts: ["Sensor", "Atuador", "Engrenagem", "Parafuso"],
    correct: 0,
    why: "O sensor fornece ao sistema informações sobre grandezas como temperatura, posição ou pressão.",
  },
  {
    id: "mec-3",
    topic: "Mecânica",
    q: "Em um par ideal de engrenagens, a engrenagem motora tem 10 dentes e a movida tem 20. Como fica a velocidade da movida?",
    opts: ["Dobra", "Fica igual", "Triplica", "Cai à metade"],
    correct: 3,
    why: "A velocidade angular é inversamente proporcional ao número de dentes: 10/20 = 1/2.",
  },
  {
    id: "web-1",
    topic: "Desenvolvimento Web",
    q: "Qual elemento HTML representa o conteúdo principal de uma página?",
    opts: ["<header>", "<main>", "<footer>", "<aside>"],
    correct: 1,
    why: "O elemento main representa o conteúdo principal e exclusivo do documento.",
  },
  {
    id: "web-2",
    topic: "Desenvolvimento Web",
    q: "Qual propriedade CSS cria um layout flexível em uma dimensão?",
    opts: ["display: grid", "display: flex", "position: absolute", "float: left"],
    correct: 1,
    why: "Flexbox (display: flex) organiza itens em uma linha ou coluna; Grid trabalha em duas dimensões.",
  },
  {
    id: "web-3",
    topic: "Desenvolvimento Web",
    q: "Qual código de status HTTP indica 'não encontrado'?",
    opts: ["200", "301", "404", "500"],
    correct: 2,
    why: "404 Not Found indica que o servidor não encontrou o recurso solicitado.",
  },
  {
    id: "web-4",
    topic: "Desenvolvimento Web",
    q: "Qual atributo torna uma imagem acessível para leitores de tela?",
    opts: ["title", "src", "alt", "loading"],
    correct: 2,
    why: "O atributo alt descreve a imagem para tecnologias assistivas e aparece se ela não carregar.",
  },
  {
    id: "web-5",
    topic: "Desenvolvimento Web",
    q: "Em JavaScript, qual palavra declara uma variável que não pode ser reatribuída?",
    opts: ["var", "let", "const", "static"],
    correct: 2,
    why: "const impede reatribuição da referência (o conteúdo de objetos ainda pode mudar).",
  },
  {
    id: "web-6",
    topic: "Desenvolvimento Web",
    q: "Qual método HTTP é normalmente usado para criar um recurso?",
    opts: ["GET", "POST", "HEAD", "OPTIONS"],
    correct: 1,
    why: "POST envia dados para criar recursos; GET apenas lê.",
  },
  {
    id: "bd-1",
    topic: "Banco de Dados",
    q: "Qual é a função de uma chave primária?",
    opts: [
      "Ordenar os registros",
      "Permitir valores duplicados",
      "Identificar unicamente cada registro",
      "Armazenar apenas textos",
    ],
    correct: 2,
    why: "A chave primária identifica cada registro e não permite valores nulos ou duplicados.",
  },
  {
    id: "bd-2",
    topic: "Banco de Dados",
    q: "Qual comando SQL remove linhas de uma tabela?",
    opts: ["DROP", "DELETE", "REMOVE", "TRUNCATE COLUMN"],
    correct: 1,
    why: "DELETE remove linhas (com WHERE opcional); DROP remove a tabela inteira.",
  },
  {
    id: "bd-3",
    topic: "Banco de Dados",
    q: "Uma chave estrangeira serve para…",
    opts: [
      "Criptografar dados",
      "Referenciar a chave de outra tabela",
      "Acelerar todas as consultas",
      "Evitar backups",
    ],
    correct: 1,
    why: "A chave estrangeira cria um vínculo referencial entre tabelas.",
  },
  {
    id: "bd-4",
    topic: "Banco de Dados",
    q: "Qual cláusula agrupa linhas para funções de agregação?",
    opts: ["ORDER BY", "GROUP BY", "HAVING", "LIMIT"],
    correct: 1,
    why: "GROUP BY agrupa; HAVING filtra grupos depois de agregados.",
  },
  {
    id: "bd-5",
    topic: "Banco de Dados",
    q: "Qual forma normal elimina grupos repetitivos e exige valores atômicos?",
    opts: ["1FN", "2FN", "3FN", "FNBC"],
    correct: 0,
    why: "A primeira forma normal exige atributos atômicos, sem listas repetidas em uma coluna.",
  },
  {
    id: "log-1",
    topic: "Lógica de Programação",
    q: "Qual estrutura repete um bloco de código?",
    opts: ["Variável", "Comentário", "Laço de repetição", "Constante"],
    correct: 2,
    why: "Laços como for e while executam repetidamente um bloco, conforme uma condição.",
  },
  {
    id: "log-2",
    topic: "Lógica de Programação",
    q: "Qual o resultado de 7 % 3 (resto da divisão)?",
    opts: ["0", "1", "2", "2,33"],
    correct: 1,
    why: "7 = 3 × 2 + 1, portanto o resto é 1.",
  },
  {
    id: "log-3",
    topic: "Lógica de Programação",
    q: "A expressão (verdadeiro E falso) OU verdadeiro resulta em…",
    opts: ["verdadeiro", "falso", "indefinido", "erro"],
    correct: 0,
    why: "verdadeiro E falso = falso; falso OU verdadeiro = verdadeiro.",
  },
  {
    id: "log-4",
    topic: "Lógica de Programação",
    q: "Qual estrutura escolhe entre caminhos conforme uma condição?",
    opts: ["se/senão", "enquanto", "para", "vetor"],
    correct: 0,
    why: "Estruturas condicionais (if/else) decidem qual bloco executar.",
  },
  {
    id: "log-5",
    topic: "Lógica de Programação",
    q: "Em um vetor de 10 posições indexado a partir de 0, qual é o último índice?",
    opts: ["10", "9", "11", "1"],
    correct: 1,
    why: "Índices vão de 0 a n − 1; com 10 posições, o último é 9.",
  },
  {
    id: "log-6",
    topic: "Lógica de Programação",
    q: "A busca binária exige que a lista esteja…",
    opts: ["Vazia", "Ordenada", "Com números pares", "Sem repetição"],
    correct: 1,
    why: "A busca binária descarta metade da lista a cada passo, o que só funciona com dados ordenados.",
  },
  {
    id: "red-1",
    topic: "Redes de Computadores",
    q: "Qual protocolo traduz nomes de domínio em endereços IP?",
    opts: ["HTTP", "DNS", "FTP", "SMTP"],
    correct: 1,
    why: "O DNS resolve nomes como exemplo.com para endereços IP.",
  },
  {
    id: "red-2",
    topic: "Redes de Computadores",
    q: "Quantos bits possui um endereço IPv4?",
    opts: ["16", "32", "64", "128"],
    correct: 1,
    why: "IPv4 usa 32 bits (4 octetos); IPv6 usa 128 bits.",
  },
  {
    id: "red-3",
    topic: "Redes de Computadores",
    q: "Qual protocolo de transporte garante entrega ordenada?",
    opts: ["UDP", "TCP", "ICMP", "ARP"],
    correct: 1,
    why: "TCP é orientado a conexão, com confirmação e ordenação; UDP não garante.",
  },
  {
    id: "red-4",
    topic: "Redes de Computadores",
    q: "Qual a porta padrão do HTTPS?",
    opts: ["21", "80", "443", "8080"],
    correct: 2,
    why: "HTTPS usa a porta 443 por padrão; HTTP usa 80.",
  },
  {
    id: "red-5",
    topic: "Redes de Computadores",
    q: "Qual camada do modelo OSI cuida do roteamento?",
    opts: ["Física", "Enlace", "Rede", "Aplicação"],
    correct: 2,
    why: "A camada de rede (3) faz endereçamento lógico e roteamento.",
  },
  {
    id: "est-1",
    topic: "Técnicas de Estudo",
    q: "A repetição espaçada funciona porque…",
    opts: [
      "Evita revisar",
      "Revisa perto do momento de esquecer",
      "Exige decorar tudo de uma vez",
      "Substitui exercícios",
    ],
    correct: 1,
    why: "Revisões em intervalos crescentes reforçam a memória quando ela começa a enfraquecer.",
  },
  {
    id: "est-2",
    topic: "Técnicas de Estudo",
    q: "A técnica Pomodoro clássica alterna…",
    opts: [
      "50 min de foco e 1 min de pausa",
      "25 min de foco e 5 min de pausa",
      "2 h de foco e 2 h de pausa",
      "Foco contínuo sem pausas",
    ],
    correct: 1,
    why: "O ciclo clássico é 25 minutos de foco seguidos de 5 de pausa, com pausa longa a cada 4 ciclos.",
  },
  {
    id: "est-3",
    topic: "Técnicas de Estudo",
    q: "Recuperação ativa (active recall) significa…",
    opts: [
      "Reler o texto várias vezes",
      "Tentar lembrar a resposta antes de conferir",
      "Grifar tudo",
      "Ouvir música enquanto estuda",
    ],
    correct: 1,
    why: "Forçar a memória a recuperar a informação fortalece mais do que reler passivamente.",
  },
];
QUESTIONS.push(
  {
    id: "mat-1",
    topic: "Matemática",
    q: "Quantas raízes reais distintas tem x² − 5x + 6 = 0?",
    opts: ["Nenhuma", "Uma", "Duas", "Três"],
    correct: 2,
    why: "O discriminante é 25 − 24 = 1 > 0. As raízes são 2 e 3, verificadas por substituição.",
  },
  {
    id: "mat-2",
    topic: "Matemática",
    q: "Quantas raízes reais distintas tem x² + 1 = 0?",
    opts: ["Nenhuma", "Uma", "Duas", "Infinitas"],
    correct: 0,
    why: "Para x real, x² é não negativo; logo x² + 1 ≥ 1. Equivalentemente, o discriminante é −4 < 0.",
  },
  {
    id: "mat-3",
    topic: "Matemática",
    q: "Em x² − 6x + 9 = 0, o discriminante é zero. Isso significa…",
    opts: [
      "Duas raízes reais distintas",
      "Nenhuma raiz real",
      "Uma raiz real dupla",
      "Que não é equação quadrática",
    ],
    correct: 2,
    why: "(x − 3)² = 0 tem raiz 3 com multiplicidade dois. A parábola tangencia o eixo x.",
  },
  {
    id: "mat-4",
    topic: "Matemática",
    q: "Qual é o coeficiente b em x² − 5x + 6 = 0?",
    opts: ["5", "−5", "6", "1"],
    correct: 1,
    why: "Na forma ax² + bx + c, o sinal faz parte do coeficiente. Assim a = 1, b = −5 e c = 6.",
  },
  {
    id: "mat-5",
    topic: "Matemática",
    q: "Qual é o resultado de (−3) × (−3)?",
    opts: ["−9", "−6", "6", "9"],
    correct: 3,
    why: "O produto de dois números negativos é positivo; 3 × 3 = 9.",
  },
  {
    id: "por-1",
    topic: "Português",
    q: "Em um texto argumentativo, a tese é…",
    opts: [
      "A posição defendida pelo autor",
      "Uma lista de fontes sem explicação",
      "Qualquer exemplo isolado",
      "Somente a última frase",
    ],
    correct: 0,
    why: "A tese expressa o posicionamento central sustentado pelos argumentos. Sua localização pode variar.",
  },
);
export const TOPICS = [...new Set(QUESTIONS.map((q) => q.topic))];
