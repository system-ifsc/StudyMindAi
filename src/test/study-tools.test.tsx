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
    await screen.findByLabelText("Pergunta do cartão 1");
    expect(await repo.list("flashcards")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Pergunta do cartão 1"), {
      target: { value: "Onde se localiza o DNA?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cartões para revisão" }));
    await screen.findByRole("alert");
    expect((await repo.list("flashcards")).length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Salvar cartões para revisão" }));
    await screen.findByRole("button", { name: "Salvo" });
    const cards = await repo.list("flashcards");
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((c) => c.id)).size).toBe(2);
    expect(cards[0]).toMatchObject({
      front: "Onde se localiza o DNA?",
      interval_days: 0,
      ease: 2.5,
      reps: 0,
    });
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
    await screen.findByRole("button", { name: "Salvar progresso novamente" }, { timeout: 4000 });
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

it("mantém mapa gerado na biblioteca e agenda revisões sem duplicar", async () => {
  const repo = createMemoryRepo(() => ({ ...demoSeed(), materials: [material], tasks: [] }));
  ai.request.mockResolvedValue({
    output: { type: "text", title: "Mapa: DNA", content: "# DNA\n\n## Núcleo\n- Contém DNA" },
  });
  mount(<StudyTools material={material} initialAction="mindmap" />, repo);
  fireEvent.click(screen.getByRole("button", { name: "Gerar com IA" }));
  await screen.findByRole("button", { name: "Salvo" });
  expect(screen.getByText("Núcleo").closest("details")).toHaveAttribute("open");
  expect((await repo.list("materials")).some((m) => m.name === "Mapa: DNA")).toBe(true);
  cleanup();
  mount(<Materials />, repo);
  fireEvent.click(await screen.findByRole("button", { name: /Biologia txt/ }));
  const schedule = screen.getByRole("button", { name: "Agendar revisões em 1, 7 e 30 dias" });
  fireEvent.click(schedule);
  await waitFor(async () => expect(await repo.list("tasks")).toHaveLength(3));
  await waitFor(() => expect(schedule).not.toBeDisabled());
  fireEvent.click(schedule);
  await waitFor(() => expect(schedule).not.toBeDisabled());
  expect(await repo.list("tasks")).toHaveLength(3);
});

import { ErrorNotebook } from "@/components/sections/ErrorNotebook";
import { ExamSprint } from "@/components/sections/ExamSprint";
import { Focus } from "@/components/sections/Focus";
import { SourcePreview } from "@/components/sections/SourcePreview";
import { timerStorageKey } from "@/lib/core/pomodoro";

it("revisa um erro sem IA, retoma confirmação perdida e cria cartão sem apagar histórico", async () => {
  const repo = createMemoryRepo(() => ({
    ...demoSeed(),
    flashcards: [],
    quiz_answers: [
      {
        id: "old-error",
        question_id: "mat-4",
        topic: "Matemática",
        correct: false,
        answered_at: "2020-01-01T12:00:00Z",
      },
    ],
  }));
  const original = repo.insert.bind(repo);
  let lost = false;
  repo.insert = async (table, row) => {
    await original(table, row);
    if (table === "quiz_answers" && !lost) {
      lost = true;
      throw new Error("Confirmação perdida");
    }
  };
  mount(<ErrorNotebook />, repo);
  fireEvent.click(await screen.findByRole("button", { name: /coeficiente b/ }));
  fireEvent.click(screen.getByRole("radio", { name: "−5" }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar nova tentativa" }));
  await screen.findByRole("alert");
  expect(await repo.list("quiz_answers")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Tentar salvar revisão novamente" }));
  await screen.findByRole("button", { name: "Tentativa registrada" });
  const history = await repo.list("quiz_answers");
  expect(history).toHaveLength(2);
  expect(history.map((a) => a.correct)).toEqual([false, true]);
  expect(ai.request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Criar flashcard deste erro" }));
  await screen.findByRole("button", { name: "Cartão disponível na revisão" });
  expect((await repo.list("flashcards"))[0]?.back).toContain("−5");
});

it("retoma salvamento parcial do roteiro de prova sem duplicar tarefas", async () => {
  const repo = createMemoryRepo(() => ({ ...demoSeed(), materials: [material], tasks: [] }));
  const original = repo.insert.bind(repo);
  let count = 0;
  repo.insert = async (table, row) => {
    if (table === "tasks" && ++count === 2) throw new Error("Falha temporária");
    await original(table, row);
  };
  mount(<ExamSprint />, repo);
  await waitFor(() => expect(screen.getByRole("option", { name: "Biologia" })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Conteúdo da prova"), { target: { value: material.id } });
  fireEvent.click(screen.getByRole("button", { name: "Montar revisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar etapas ao cronograma" }));
  await screen.findByRole("alert");
  expect(await repo.list("tasks")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar etapas ao cronograma" }));
  await screen.findByRole("button", { name: "Revisão no cronograma" });
  const tasks = await repo.list("tasks");
  expect(tasks).toHaveLength(3);
  expect(tasks.reduce((sum, t) => sum + t.duration_min, 0)).toBe(40);
});

it("exibe os campos reais da sessão restaurada inclusive se a atividade foi concluída", async () => {
  const taskId = "11111111-1111-4111-8111-111111111112";
  const repo = createMemoryRepo(() => ({
    ...demoSeed(),
    tasks: [
      {
        id: taskId,
        subject_id: null,
        title: "Atividade em andamento",
        notes: "",
        due_date: "2026-11-26",
        duration_min: 90,
        priority: 2,
        done: true,
        completed_at: "2026-11-25T12:00:00Z",
      },
    ],
  }));
  const profile = await repo.getProfile();
  const key = timerStorageKey(repo.mode, profile.id);
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  localStorage.setItem(
    key,
    JSON.stringify({
      clientId: crypto.randomUUID(),
      taskId,
      subjectId: null,
      label: "Atividade em andamento",
      targetMin: 5,
      startedAt: Date.now(),
      accumulatedMs: 0,
      runningSince: null,
    }),
  );
  try {
    mount(<Focus />, repo);
    await waitFor(() => expect(screen.getByLabelText("Duração do ciclo (min)")).toHaveValue(5));
    expect(screen.getByLabelText("Atividade")).toHaveValue(taskId);
    expect(screen.getByLabelText("Atividade")).toBeDisabled();
    expect(screen.getByLabelText("Duração do ciclo (min)")).toBeDisabled();
  } finally {
    localStorage.removeItem(key);
    vi.unstubAllGlobals();
  }
});

it("abre a citação literal no contexto do documento salvo", async () => {
  const repo = createMemoryRepo(() => ({ ...demoSeed(), materials: [material] }));
  mount(
    <SourcePreview materialId={material.id} title="Biologia" excerpt="O núcleo contém DNA." />,
    repo,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Abrir fonte: Biologia" }));
  await screen.findByRole("dialog");
  await waitFor(() => expect(document.querySelector("mark")?.textContent).toBe(material.content));
});
