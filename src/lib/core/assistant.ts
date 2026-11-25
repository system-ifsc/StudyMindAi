import { z } from "zod";
import { studyActionSchema, studyQuestionSchema } from "./study-tools";

/** Erros do provedor nunca devem expor respostas brutas ou credenciais. */
export function assistantProviderError(status: number, code?: string) {
  if (status === 402 || code === "insufficient_quota" || code === "credit_balance_exhausted")
    return "Os créditos de API da IA acabaram. Adicione créditos na conta do provedor para continuar.";
  if (status === 401)
    return "A chave de API da IA é inválida ou foi revogada. Atualize a configuração do servidor.";
  if (status === 403) return "O acesso ao modelo de IA foi negado para este projeto.";
  if (status === 404)
    return "O modelo de IA configurado não está disponível. Verifique o modelo no servidor.";
  if (status === 429)
    return "O provedor atingiu o limite de solicitações. Aguarde um pouco e tente de novo.";
  return "O assistente está indisponível no momento.";
}

export const tutorModeSchema = z.enum(["teacher", "evaluator", "review"]);
export const explanationLevelSchema = z.enum(["simple", "standard", "advanced"]);
export type TutorMode = z.infer<typeof tutorModeSchema>;
export type ExplanationLevel = z.infer<typeof explanationLevelSchema>;

/** Instruções selecionadas de uma lista fechada; nenhum texto do cliente vira regra. */
export function tutorInstructions(mode: TutorMode, level: ExplanationLevel): string {
  const modes = {
    teacher:
      "Modo professor: explique conceitos passo a passo, use exemplos e termine com uma pergunta de compreensão.",
    evaluator:
      "Modo avaliador: solicite uma resposta do estudante antes de avaliar; explique critérios, acertos, erros e próximos passos. Não invente uma resposta do estudante.",
    review:
      "Modo revisão: use recuperação ativa, faça uma pergunta por vez e espere a resposta antes de revelar a explicação.",
  };
  const levels = {
    simple:
      "Nível introdutório: linguagem simples, explique termos técnicos e use analogias concretas.",
    standard: "Nível intermediário: combine explicação conceitual e aplicação prática.",
    advanced: "Nível avançado: aprofunde fundamentos, hipóteses, limitações e casos difíceis.",
  };
  return `${modes[mode]} ${levels[level]} Em qualquer modo, se o estudante pedir pistas, uma pergunta por vez ou para esperar, revele apenas a próxima pista e encerre a mensagem aguardando a tentativa, sem entregar a solução junto da pergunta. Ao analisar uma resolução, localize o primeiro passo problemático e ajude a corrigi-lo antes de avançar. Verifique sinais e substitua resultados na expressão original. Explicite hipóteses e domínio; não faça afirmações universais sem condições. Ao reconhecer um erro seu, diga claramente qual afirmação anterior estava errada e apresente a correção. Em equações quadráticas reais, distinga discriminante positivo, nulo e negativo; um quadrado real é não negativo, e zero não é positivo. Não confunda desempenho pontual com domínio comprovado.`;
}

export const assistantRequestSchema = z.object({
  action: z.literal("chat").optional(),
  material_id: z.string().uuid().nullable().optional(),
  material_ids: z.array(z.string().uuid()).max(5).optional(),
  include_progress: z.boolean().optional(),
  mode: tutorModeSchema.default("teacher"),
  level: explanationLevelSchema.default("standard"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(12)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "Envie uma pergunta ao final da conversa.",
    }),
  material: z
    .object({
      name: z.string().min(1).max(150),
      content: z.string().max(15000),
    })
    .nullable()
    .optional(),
});

const source = {
  material_id: z.string().uuid().nullable().optional(),
  material: z
    .object({
      name: z.string().trim().min(1).max(150),
      content: z.string().trim().min(1).max(15000),
    })
    .nullable()
    .optional(),
};
export const generationRequestSchema = z
  .object({
    action: z.literal("generate"),
    tool: studyActionSchema,
    reading_minutes: z.number().int().min(1).max(10).default(3),
    count: z.number().int().min(1).max(20).default(10),
    ...source,
  })
  .refine((b) => !!b.material_id || !!b.material, {
    message: "Selecione um material ou forneça um texto.",
  });
export const gradeRequestSchema = z
  .object({
    action: z.literal("grade"),
    question: studyQuestionSchema,
    answer: z.string().trim().min(1).max(4000),
    ...source,
  })
  .refine((b) => b.question.type === "open" && (!!b.material_id || !!b.material), {
    message: "Informe uma questão discursiva e seu material.",
  });
export const aiRequestSchema = z.union([
  generationRequestSchema,
  gradeRequestSchema,
  assistantRequestSchema,
]);

/** IDs estáveis permitem retomar o salvamento de várias fontes sem duplicá-las. */
export function messageSourceId(messageId: string, index: number): string {
  const suffix = ((BigInt(`0x${messageId.slice(-12)}`) + BigInt(index)) % 2n ** 48n)
    .toString(16)
    .padStart(12, "0");
  return messageId.slice(0, -12) + suffix;
}

export function messageSourcePosition(sourceId: string, messageId: string): number {
  return Number(
    (BigInt(`0x${sourceId.slice(-12)}`) - BigInt(`0x${messageId.slice(-12)}`) + 2n ** 48n) %
      2n ** 48n,
  );
}

/** O rótulo bibliográfico preserva a numeração mesmo quando um backup troca os UUIDs. */
export function citationTitle(name: string, position: number): string {
  return `[${position + 1}] ${name}`;
}
export function citationDetails(title: string, sourceId: string, messageId: string) {
  const label = title.match(/^\[([1-5])\] ([\s\S]+)$/);
  return label
    ? { position: Number(label[1]) - 1, name: label[2]! }
    : { position: messageSourcePosition(sourceId, messageId), name: title };
}
