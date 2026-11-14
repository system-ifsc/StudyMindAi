import { z } from "zod";
import { studyActionSchema, studyQuestionSchema } from "./study-tools";

export const assistantRequestSchema = z.object({
  action: z.literal("chat").optional(),
  material_id: z.string().uuid().nullable().optional(),
  include_progress: z.boolean().optional(),
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
