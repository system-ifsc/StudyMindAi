import { addDays, today } from "@/lib/core/dates";
import type { Profile, Tables } from "@/lib/core/types";

/** Dados FICTÍCIOS do modo demonstração. Não existem no banco e somem ao recarregar. */
export function demoSeed(): { profile: Profile } & { [K in keyof Tables]: Tables[K][] } {
  const t = today();
  const sub: { id: string; name: string; color: string }[] = [
    "Lógica de Programação",
    "Desenvolvimento Web",
    "Banco de Dados",
    "Redes de Computadores",
  ].map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    color: ["indigo", "violet", "teal", "amber"][i] ?? "indigo",
  }));
  const task = (
    title: string,
    s: number,
    due: number,
    min: number,
    p: 1 | 2 | 3,
    done = false,
  ) => ({
    id: crypto.randomUUID(),
    subject_id: sub[s]!.id,
    title,
    notes: "",
    due_date: addDays(t, due),
    duration_min: min,
    priority: p,
    done,
    completed_at: done ? new Date().toISOString() : null,
  });
  const tasks = [
    task("Variáveis e tipos de dados", 0, 1, 45, 3),
    task("HTML semântico", 1, 3, 60, 2),
    task("Modelo entidade-relacionamento", 2, 5, 90, 3),
    task("Endereçamento IP e máscaras", 3, 7, 60, 2),
    task("Flexbox na prática", 1, -1, 30, 2),
    task("Estruturas condicionais", 0, -2, 40, 1, true),
  ];
  const sessions = [0, 1, 2, 4, 5].map((d, i) => {
    const start = new Date();
    start.setDate(start.getDate() - d);
    start.setHours(19, 0, 0, 0);
    const minutes = [25, 40, 30, 50, 25][i] ?? 25;
    return {
      id: crypto.randomUUID(),
      client_id: crypto.randomUUID(),
      subject_id: sub[i % 4]!.id,
      task_id: null,
      title: "Sessão de foco",
      started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + minutes * 60000).toISOString(),
      minutes,
    };
  });
  return {
    profile: {
      id: "demo",
      display_name: "Estudante Demo",
      course: "Técnico em Informática para Internet",
      objective: "Concluir o módulo 1 com média 8",
      weekly_hours: 8,
      availability: [60, 60, 90, 60, 45, 120, 0],
      onboarded: true,
    },
    subjects: sub,
    tasks,
    study_sessions: sessions,
    flashcards: [
      {
        id: crypto.randomUUID(),
        subject_id: sub[2]!.id,
        front: "O que é uma chave primária?",
        back: "Atributo (ou conjunto) que identifica unicamente cada registro de uma tabela.",
        due_date: t,
        interval_days: 0,
        ease: 2.5,
        reps: 0,
      },
      {
        id: crypto.randomUUID(),
        subject_id: sub[3]!.id,
        front: "Quantos bits tem um IPv4?",
        back: "32 bits, em 4 octetos.",
        due_date: t,
        interval_days: 0,
        ease: 2.5,
        reps: 0,
      },
    ],
    goals: [
      {
        id: crypto.randomUUID(),
        title: "Estudar 8 horas nesta semana",
        target_date: addDays(t, 6),
        done: false,
      },
    ],
    materials: [
      {
        id: crypto.randomUUID(),
        name: "resumo-html.md",
        kind: "md",
        content:
          "# HTML semântico\n\nUse `main`, `header`, `nav`, `article` e `footer` para dar significado à estrutura.",
      },
    ],
    quiz_answers: [],
    ...emptyLearningTables(),
  };
}
import { emptyLearningTables } from "@/lib/core/learning-data";
