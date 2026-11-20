import { z } from "zod";

export const FEEDBACK_EMAIL = "system.ifsc@gmail.com";
export const feedbackCategories = ["Opinião", "Sugestão", "Problema"] as const;
export const feedbackSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(120)
    .refine((value) => !/[\r\n]/.test(value), "Nome inválido."),
  email: z
    .email("Informe um Gmail válido.")
    .trim()
    .toLowerCase()
    .refine((value) => value.endsWith("@gmail.com"), "Informe um endereço @gmail.com."),
  category: z.enum(feedbackCategories),
  message: z.string().trim().min(10, "Escreva pelo menos 10 caracteres.").max(5000),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
