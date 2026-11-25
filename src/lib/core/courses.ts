/** Catálogo do produto. As disciplinas são sugestões, não uma matriz curricular oficial. */
export const COURSES = [
  {
    name: "Informática para Internet",
    subjects: [
      "Lógica de Programação",
      "Desenvolvimento Web",
      "Banco de Dados",
      "Redes de Computadores",
    ],
  },
  {
    name: "Agroecologia",
    subjects: [
      "Fundamentos de Agroecologia",
      "Solos e Compostagem",
      "Sistemas Agroflorestais",
      "Produção Vegetal",
    ],
  },
  {
    name: "Biotecnologia",
    subjects: ["Biologia Celular", "Genética", "Microbiologia", "Bioquímica"],
  },
  {
    name: "Mecatrônica",
    subjects: ["Eletricidade e Circuitos", "Eletrônica", "Mecânica", "Automação e Controle"],
  },
  {
    name: "Ensino médio",
    subjects: [
      "Matemática",
      "Português",
      "Biologia Celular",
      "Genética",
      "Eletricidade e Circuitos",
    ],
  },
  {
    name: "ENEM e vestibulares",
    subjects: [
      "Matemática",
      "Português",
      "Biologia Celular",
      "Genética",
      "Eletricidade e Circuitos",
    ],
  },
  { name: "Outro curso", subjects: ["Matemática", "Português"] },
] as const;

export function findCourse(value: string) {
  const name = value.trim().replace(/^Técnico em\s+/i, "");
  return COURSES.find((course) => course.name === name);
}

export function requireCourse(value: string): string {
  const course = findCourse(value);
  if (!course) throw new Error("Selecione uma opção de estudo disponível.");
  return course.name;
}

export function questionsForCourse<T extends { topic: string }>(
  questions: T[],
  value: string,
): T[] {
  const course = findCourse(value);
  if (!course) return [];
  return questions.filter(
    (question) =>
      question.topic === "Técnicas de Estudo" ||
      course.subjects.some((subject) => subject === question.topic),
  );
}
