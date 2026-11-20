import type { Profile } from "./types";

export function shouldShowTutorial(profile: Profile | undefined, mode: "real" | "demo") {
  return mode === "real" && !!profile?.onboarded && !profile.tutorial_completed;
}

export const TUTORIAL_STEPS = [
  {
    target: null,
    title: "Boas-vindas ao StudyMind AI!",
    description:
      "Vamos conhecer seu espaço de estudos? Este passeio mostra onde encontrar os principais recursos. Você pode voltar ou pular quando quiser.",
  },
  {
    target: "painel",
    title: "Seu painel",
    description:
      "Clique em Início (ou Painel) para acompanhar seus estudos e encontrar os próximos passos do dia.",
  },
  {
    target: "disciplinas",
    title: "Organize suas disciplinas",
    description:
      "Abra Disciplinas no menu lateral (Mais no celular) para cadastrar as matérias que estuda. Elas ajudam a organizar suas atividades, materiais e sessões por assunto.",
  },
  {
    target: "planejador",
    title: "Organize seu plano",
    description:
      "Em Meu plano (ou Planejamento), organize atividades e consulte o calendário. O planejador usa um algoritmo determinístico para distribuir seus estudos conforme sua disponibilidade.",
  },
  {
    target: "atividades",
    title: "Acompanhe suas atividades",
    description:
      "Dentro de Planejamento (Meu plano no celular), clique em Atividades para cadastrar tarefas, definir prazos e prioridades e marcar o que já concluiu.",
  },
  {
    target: "calendario",
    title: "Veja seu calendário",
    description:
      "Dentro de Planejamento, clique em Calendário para consultar suas atividades por data e visualizar os compromissos de estudo.",
  },
  {
    target: "foco",
    title: "Hora de se concentrar",
    description: "Abra Foco para iniciar o cronômetro e registrar suas sessões de estudo.",
  },
  {
    target: "flashcards",
    title: "Revise e pratique",
    description:
      "Clique em Revisar (ou Flashcards) para estudar seus cartões e manter as revisões em dia.",
  },
  {
    target: "exercicios",
    title: "Pratique com exercícios",
    description:
      "Abra Exercícios no menu lateral (Mais no celular) para responder questões, conferir o resultado e identificar o que precisa revisar.",
  },
  {
    target: "materiais",
    title: "Guarde seus materiais",
    description:
      "Abra Materiais no menu lateral (Mais no celular) para adicionar e consultar seus materiais de estudo. Organize os arquivos por disciplina para encontrá-los com facilidade.",
  },
  {
    target: "assistente",
    title: "Conheça o Assistente IA",
    description:
      "Acesse Assistente IA pelo menu lateral ou por Mais no celular. Ele ajuda com seus estudos quando o provedor de IA está configurado; caso contrário, você verá um aviso.",
  },
  {
    target: "feedback",
    title: "Envie seu feedback",
    description:
      "Abra Feedback no menu lateral (Mais no celular) para enviar sugestões, relatar problemas ou contar o que pode melhorar na plataforma.",
  },
  {
    target: "metas",
    title: "Defina suas metas",
    description:
      "Abra Metas no menu lateral (Mais no celular) para acompanhar sua meta semanal e cadastrar objetivos pessoais de estudo.",
  },
  {
    target: "desempenho",
    title: "Acompanhe seu desempenho",
    description:
      "Abra Desempenho no menu lateral (Mais no celular) para consultar seu tempo de estudo, sessões por disciplina e resultados dos exercícios.",
  },
  {
    target: "configuracoes",
    title: "Tudo pronto para começar!",
    description:
      "Clique no seu perfil para ajustar sua disponibilidade, aparência e backups. Em Configurações → Tutorial de boas-vindas, você pode refazer este passeio a qualquer momento.",
  },
] as const;
