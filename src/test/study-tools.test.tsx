import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataProvider } from "@/hooks/use-data";
import { createMemoryRepo } from "@/lib/repo/memory";
import { demoSeed } from "@/lib/repo/demo-seed";
import { StudyTools } from "@/components/sections/StudyTools";
import { GeneratedQuiz } from "@/components/sections/StudyQuiz";
import { Materials } from "@/components/sections/Materials";
import type { Repo } from "@/lib/repo/types";
const ai = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/hooks/use-study-ai", () => ({
  useStudyAI: () => ({
    status: "ready",
    busy: false,
    error: "",
    request: ai.request,
    cancel: vi.fn(),
    demo: false,
  }),
}));
const material = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Biologia",
  kind: "txt" as const,
  content: "O núcleo contém DNA.",
};
function mount(children: React.ReactNode, repo: Repo) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DataProvider repo={repo}>{children}</DataProvider>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("integração das ferramentas com Repo", () => {
  it("salva flashcards no SRS e retoma lote parcialmente salvo sem duplicar", async () => {
    const repo = createMemoryRepo(() => ({ ...demoSeed(), flashcards: [] }));
    const originalInsert = repo.insert.bind(repo);
    let attempts = 0;
    repo.insert = async (table, row) => {
      if (table === "flashcards" && ++attempts === 2) throw new Error("Falha de rede");
      return originalInsert(table, row);
    };
    ai.request.mockResolvedValue({
      output: {
        type: "flashcards",
        cards: [
          { front: "Onde está o DNA?", back: "No núcleo." },
          { front: "O que é DNA?", back: "Material genético." },
        ],
      },
    });
    mount(
      <StudyTools material={material} initialAction="flashcards" allowed={["flashcards"]} />,
      repo,
    );
    fireEvent.click(screen.getByRole("button", { name: "Gerar com IA" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar cartões para revisão" }));
    await screen.findByRole("alert");
    expect((await repo.list("flashcards")).length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Salvar cartões para revisão" }));
    await screen.findByRole("button", { name: "Salvo" });
    const cards = await repo.list("flashcards");
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((c) => c.id)).size).toBe(2);
    expect(cards[0]).toMatchObject({ interval_days: 0, ease: 2.5, reps: 0 });
    expect(ai.request).toHaveBeenCalledWith(
      expect.objectContaining({ material_id: material.id, action: "generate" }),
    );
  });
  it("salva um resumo como material real e mantém o documento original", async () => {
    const repo = createMemoryRepo(() => ({ ...demoSeed(), materials: [material] }));
    ai.request.mockResolvedValue({
      output: { type: "text", title: "Resumo de biologia", content: "O núcleo contém DNA." },
    });
    mount(<StudyTools material={material} />, repo);
    fireEvent.click(screen.getByRole("button", { name: "Gerar com IA" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar em Materiais" }));
    await screen.findByRole("button", { name: "Salvo" });
    const materials = await repo.list("materials");
    expect(materials).toHaveLength(2);
    expect(materials.find((m) => m.id === material.id)).toEqual(material);
    expect(materials.find((m) => m.name === "Resumo de biologia")).toMatchObject({
      kind: "md",
      content: "Fonte: Biologia\n\nO núcleo contém DNA.",
    });
  });
  it("corrige objetivas, avalia discursiva e registra resultados", async () => {
    const repo = createMemoryRepo(() => ({ ...demoSeed(), quiz_answers: [] }));
    ai.request.mockResolvedValue({ evaluation: { correct: true, feedback: "Conceito correto." } });
    mount(
      <GeneratedQuiz
        source={{ material_id: material.id }}
        quiz={{
          type: "quiz",
          title: "Prática",
          questions: [
            {
              type: "true_false",
              question: "O núcleo contém DNA?",
              topic: "Biologia",
              options: ["Verdadeiro", "Falso"],
              correct: 0,
              answer: "Verdadeiro",
              explanation: "O núcleo contém o material genético.",
            },
            {
              type: "open",
              question: "Explique a função do núcleo.",
              topic: "Biologia",
              options: [],
              correct: null,
              answer: "Armazenar DNA.",
              explanation: "Contém o material genético.",
            },
          ],
        }}
      />,
      repo,
    );
    fireEvent.click(screen.getByLabelText("Verdadeiro"));
    fireEvent.change(screen.getByLabelText("Resposta da questão 2"), {
      target: { value: "Armazena o DNA." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Corrigir e registrar resultados" }));
    await screen.findByRole("button", { name: "Resultados registrados" });
    const answers = await repo.list("quiz_answers");
    expect(answers).toHaveLength(2);
    expect(answers.every((a) => a.correct && a.topic === "Biologia")).toBe(true);
    expect(ai.request).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Conceito correto.")).toBeInTheDocument();
  });
  it("cria uma anotação sem precisar importar arquivo ou chamar IA", async () => {
    const repo = createMemoryRepo(() => ({ ...demoSeed(), materials: [] }));
    mount(<Materials />, repo);
    fireEvent.click(screen.getByRole("button", { name: "Nova anotação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Minha aula" } });
    fireEvent.change(screen.getByLabelText("Anotação"), {
      target: { value: "O núcleo contém DNA." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar anotação" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await repo.list("materials"))[0]).toMatchObject({
      name: "Minha aula",
      kind: "md",
      content: "O núcleo contém DNA.",
    });
    expect(ai.request).not.toHaveBeenCalled();
  });
});

describe("histórico persistente de atividades", () => {
  it("salva enunciados e respostas e retoma a tentativa após remontar", async () => {
    const { SavedQuizzes } = await import("@/components/sections/SavedQuizzes");
    const repo = createMemoryRepo(() => ({ ...demoSeed(), materials: [material] }));
    const quiz = {
      type: "quiz" as const,
      title: "Simulado salvo",
      questions: [
        {
          type: "multiple_choice" as const,
          topic: "Biologia",
          question: "Onde está o DNA?",
          options: ["Núcleo", "Parede", "Membrana"],
          correct: 0,
          answer: "Núcleo",
          explanation: "O núcleo contém DNA.",
        },
      ],
    };
    const view = mount(<GeneratedQuiz quiz={quiz} source={{ material_id: material.id }} />, repo);
    fireEvent.click(screen.getByRole("radio", { name: "Núcleo" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar para continuar depois" }));
    await screen.findByRole("button", { name: "Salvar progresso novamente" });
    expect(await repo.list("generated_questions")).toHaveLength(1);
    expect(await repo.list("question_attempt_answers")).toHaveLength(1);
    view.unmount();
    mount(<SavedQuizzes />, repo);
    fireEvent.click(await screen.findByRole("button", { name: "Simulado salvo · Continuar" }));
    expect(await screen.findByRole("radio", { name: "Núcleo" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Corrigir e registrar resultados" }));
    await screen.findByRole("button", { name: "Resultados registrados" });
    expect((await repo.list("question_attempts"))[0]).toMatchObject({
      status: "evaluated",
      score: 100,
    });
    expect((await repo.list("question_attempt_answers"))[0]).toMatchObject({
      correct: true,
      answer: "0",
    });
  });
});
