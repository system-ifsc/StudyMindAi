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

export type TutorialRect = { top: number; left: number; width: number; height: number };

/** Posiciona o cartão dentro da tela, preservando espaço para o alvo e a seta. */
export function tutorialLayout(
  viewport: { width: number; height: number },
  contentHeight: number,
  target: TutorialRect | null,
) {
  const margin = 16;
  const gap = 24;
  const width = Math.max(0, Math.min(448, viewport.width - margin * 2));
  const fullHeight = Math.max(0, viewport.height - margin * 2);
  const height = Math.min(contentHeight, fullHeight);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const center = {
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
    width,
    maxHeight: fullHeight,
    side: "center" as const,
  };
  if (!target) return center;
  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const alignY = clamp(
    target.top + target.height / 2 - height / 2,
    margin,
    viewport.height - margin - height,
  );
  if (viewport.width - right - gap - margin >= width)
    return { left: right + gap, top: alignY, width, maxHeight: fullHeight, side: "right" as const };
  if (target.left - gap - margin >= width)
    return {
      left: target.left - gap - width,
      top: alignY,
      width,
      maxHeight: fullHeight,
      side: "left" as const,
    };
  const above = Math.max(0, target.top - gap - margin);
  const below = Math.max(0, viewport.height - bottom - gap - margin);
  const left = clamp(
    target.left + target.width / 2 - width / 2,
    margin,
    viewport.width - margin - width,
  );
  if (below >= height || (above < height && below >= above))
    return {
      left,
      top: bottom + gap,
      width,
      maxHeight: Math.min(fullHeight, below),
      side: "below" as const,
    };
  return {
    left,
    top: Math.max(margin, target.top - gap - Math.min(height, above)),
    width,
    maxHeight: Math.min(fullHeight, above),
    side: "above" as const,
  };
}
