import { z } from "zod";
import type { Flashcard, QuizAnswer, StudySession } from "./types";
import { dueCards, quizStats } from "./metrics";

export const studyActions = {
  summary: "Resumo completo",
  simplified: "Resumo simplificado",
  keypoints: "Tópicos principais",
  guide: "Guia de revisão",
  concepts: "Conceitos importantes",
  improve: "Melhorar explicação",
  flashcards: "Flashcards",
  quiz: "Questionário",
  exam: "Simulado",
  enem: "Simulado ENEM / vestibulares",
  mindmap: "Mapa mental",
  essay: "Feedback de redação ENEM",
  podcast: "Roteiro de podcast",
} as const;
export type StudyAction = keyof typeof studyActions;
export const studyActionSchema = z.enum(
  Object.keys(studyActions) as [StudyAction, ...StudyAction[]],
);
export const cardDraftSchema = z.object({
  front: z.string().trim().min(1).max(1000),
  back: z.string().trim().min(1).max(3000),
});
export const studyQuestionSchema = z
  .object({
    type: z.enum(["multiple_choice", "true_false", "open"]),
    topic: z.string().trim().min(1).max(80),
    question: z.string().trim().min(1).max(2000),
    options: z.array(z.string().trim().min(1).max(1000)).max(5),
    correct: z.number().int().min(0).max(4).nullable(),
    answer: z.string().trim().min(1).max(3000),
    explanation: z.string().trim().min(1).max(3000),
  })
  .superRefine((q, ctx) => {
    const valid =
      q.type === "open"
        ? q.options.length === 0 && q.correct === null
        : q.correct !== null &&
          q.correct < q.options.length &&
          (q.type === "true_false"
            ? q.options.length === 2 && q.options[0] === "Verdadeiro" && q.options[1] === "Falso"
            : q.options.length >= 3) &&
          new Set(q.options).size === q.options.length;
    if (!valid)
      ctx.addIssue({ code: "custom", message: "Questão com alternativas ou gabarito inválidos." });
  });
export type StudyQuestion = z.infer<typeof studyQuestionSchema>;
export const studyOutputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    title: z.string().trim().min(1).max(150),
    content: z.string().trim().min(1).max(50000),
  }),
  z.object({ type: z.literal("flashcards"), cards: z.array(cardDraftSchema).min(1).max(20) }),
  z.object({
    type: z.literal("quiz"),
    title: z.string().trim().min(1).max(150),
    questions: z.array(studyQuestionSchema).min(1).max(20),
  }),
]);
export type StudyOutput = z.infer<typeof studyOutputSchema>;
export const gradingSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().trim().min(1).max(4000),
});

export function parseStudyOutput(text: string, action: StudyAction): StudyOutput {
  const output = studyOutputSchema.parse(
    JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    ),
  );
  const expected =
    action === "flashcards"
      ? "flashcards"
      : action === "quiz" || action === "exam" || action === "enem"
        ? "quiz"
        : "text";
  if (output.type !== expected)
    throw new Error("O modelo retornou um formato diferente do solicitado.");
  return output;
}

/** Discursivas exigem avaliação separada; nunca são marcadas como erradas automaticamente. */
export function correctObjective(q: StudyQuestion, picked: number): boolean | null {
  if (q.type === "open") return null;
  if (!Number.isInteger(picked) || picked < 0 || picked >= q.options.length)
    throw new Error("Escolha uma alternativa válida.");
  return picked === q.correct;
}

export function progressContext(
  cards: Flashcard[],
  answers: QuizAnswer[],
  sessions: StudySession[],
  on: string,
) {
  const stats = quizStats(answers);
  return {
    reviews_pending: dueCards(cards, on).length,
    questions_answered: stats.total,
    accuracy_percent: stats.pct,
    topics: stats.byTopic.sort((a, b) => a.pct - b.pct).slice(0, 15),
    sessions: sessions.length,
    study_minutes: sessions.reduce((total, s) => total + s.minutes, 0),
  };
}

export function studyPrompt(action: StudyAction, count: number, readingMinutes = 3) {
  const base = `Use exclusivamente o material fornecido. Não invente fatos nem fontes. Se o conteúdo for insuficiente, informe isso em um objeto type=text. Responda apenas JSON válido, sem markdown externo. `;
  if (action === "flashcards")
    return (
      base +
      `Gere ${count} cartões: {"type":"flashcards","cards":[{"front":"pergunta","back":"resposta"}]}. Uma ideia por cartão; front até 1000 e back até 3000 caracteres.`
    );
  if (action === "quiz" || action === "exam" || action === "enem")
    return (
      base +
      `Gere ${count} questões variadas (múltipla escolha, verdadeiro/falso e discursiva) ${action === "exam" ? "para um simulado abrangente" : action === "enem" ? "inspiradas no ENEM e vestibulares, contextualizadas, com interpretação e aplicação de conceitos; não afirme que são questões oficiais" : "para praticar"}. Formato: {"type":"quiz","title":"título até 150 caracteres","questions":[{"type":"multiple_choice|true_false|open","topic":"tema até 80 caracteres","question":"enunciado","options":["alternativas"],"correct":0,"answer":"resposta de referência","explanation":"explicação didática do gabarito e dos erros"}]}. multiple_choice: 3 a 5 alternativas distintas, correct é índice iniciado em zero. true_false: options exatamente ["Verdadeiro","Falso"], correct 0 ou 1. open: options [], correct null. Não crie perguntas ambíguas.`
    );
  const instructions: Record<
    Exclude<StudyAction, "flashcards" | "quiz" | "exam" | "enem">,
    string
  > = {
    mindmap:
      "Crie um mapa mental textual: um título #, ramos principais como ## e relações/conceitos em listas dentro de cada ramo. Explicite relações e cite o nome da fonte em cada ramo. Não use Mermaid nem HTML.",
    essay:
      "O material é uma redação do estudante, possivelmente com tema informado no início. Avalie formativamente pelas cinco competências do ENEM (norma formal, compreensão do tema, argumentação, coesão e proposta de intervenção respeitando direitos humanos). Para cada competência, mostre evidências citando trechos e sugestões concretas. Não dê nota oficial, não finja ser corretor do INEP e não reescreva a redação inteira. Se o tema estiver ausente, explicite que a adequação ao tema não pode ser avaliada. Não trate os argumentos da redação como fatos verificados.",
    podcast:
      "Crie um roteiro curto de podcast educacional com duas vozes identificadas como Apresentador e Tutor, introdução, explicação, exemplos presentes nas fontes e três perguntas de revisão. Identifique as fontes usadas. É um roteiro para leitura, não um arquivo de áudio.",
    summary:
      "Faça um resumo completo e organizado, com os assuntos principais e exemplos presentes no material.",
    simplified:
      "Explique o material em linguagem simples, preservando os conceitos e sinalizando pré-requisitos.",
    keypoints:
      "Liste os assuntos mais importantes em tópicos hierárquicos e explique cada um brevemente.",
    guide:
      "Crie um guia de revisão com objetivos, conceitos, perguntas de recuperação ativa e explicações passo a passo.",
    concepts:
      "Extraia os conceitos principais e suas definições, relações e exemplos presentes no material.",
    improve:
      "Reescreva as anotações com explicações claras e organizadas, preservando seu significado. Sinalize lacunas sem inventar detalhes.",
  };
  return (
    base +
    instructions[action] +
    (["summary", "simplified", "keypoints", "guide"].includes(action)
      ? ` Limite o texto a aproximadamente ${readingMinutes * 180} palavras para uma leitura estimada em ${readingMinutes} minuto(s), sem omitir ressalvas essenciais.`
      : "") +
    ' Formato: {"type":"text","title":"título até 150 caracteres","content":"conteúdo em Markdown até 50000 caracteres"}.'
  );
}
