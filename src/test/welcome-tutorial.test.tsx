import { TUTORIAL_STEPS } from "@/lib/core/tutorial";
import { SECTIONS } from "@/components/sections/registry";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorialProvider } from "@/components/app/WelcomeTutorial";
import { useTutorial } from "@/hooks/use-tutorial";
import { DataProvider } from "@/hooks/use-data";
import type { Repo } from "@/lib/repo/types";
import type { Profile } from "@/lib/core/types";

afterEach(cleanup);
const profile: Profile = {
  id: "user",
  display_name: "Ana",
  course: "",
  objective: "",
  weekly_hours: 8,
  availability: [60, 60, 60, 60, 60, 0, 0],
  onboarded: true,
};
function Replay() {
  const restart = useTutorial();
  return <button onClick={restart}>Refazer tutorial</button>;
}
function setup(completed = false, mode: "real" | "demo" = "real", fail = false) {
  const revealSection = vi.fn();
  const updateProfile = vi.fn(async () => {
    if (fail) throw new Error("Falha ao salvar");
  });
  const repo = {
    mode,
    getProfile: async () => ({ ...profile, tutorial_completed: completed }),
    updateProfile,
  } as unknown as Repo;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DataProvider repo={repo}>
        <TutorialProvider mode={mode} section="painel" revealSection={revealSection}>
          <Replay />
        </TutorialProvider>
      </DataProvider>
    </QueryClientProvider>,
  );
  return { updateProfile, revealSection };
}
describe("tutorial de boas-vindas", () => {
  it("apresenta todas as abas cadastradas, com um passo exclusivo por aba", () => {
    const targets = TUTORIAL_STEPS.flatMap((step) => (step.target ? [step.target] : []));
    expect([...targets].sort()).toEqual(SECTIONS.map((section) => section.key).sort());
    expect(new Set(targets).size).toBe(targets.length);
  });
  it("abre no primeiro acesso, permite avançar e voltar e persiste ao pular", async () => {
    const { updateProfile } = setup();
    await screen.findByRole("dialog");
    expect(screen.getByText("Boas-vindas ao StudyMind AI!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(screen.getByText("Seu painel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Boas-vindas ao StudyMind AI!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pular tutorial" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateProfile).toHaveBeenCalledWith({ tutorial_completed: true });
  });
  it("não reabre para quem concluiu e permite refazer e concluir", async () => {
    const { updateProfile } = setup(true);
    await screen.findByRole("button", { name: "Refazer tutorial" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refazer tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    for (const step of TUTORIAL_STEPS.slice(1, -1)) {
      expect(screen.getByRole("heading", { name: step.title })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateProfile).toHaveBeenCalledOnce();
  });
  it("revela o planejamento para destacar as abas Atividades e Calendário", async () => {
    const { revealSection } = setup();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    while (!screen.queryByRole("heading", { name: "Acompanhe suas atividades" })) {
      fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    }
    expect(revealSection).toHaveBeenLastCalledWith("planejador");
    revealSection.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.getByRole("heading", { name: "Veja seu calendário" })).toBeInTheDocument();
    expect(revealSection).toHaveBeenLastCalledWith("planejador");
  });
  it("mantém aberto quando a persistência falha", async () => {
    const { updateProfile } = setup(false, "real", true);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Pular tutorial" }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("não inicia automaticamente no modo demonstração", async () => {
    setup(false, "demo");
    await screen.findByRole("button", { name: "Refazer tutorial" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
