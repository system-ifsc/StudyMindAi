import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defaultPreferences } from "@/lib/core/preferences";
import { preferencesInitScript, readPreferences, savePreferences } from "@/hooks/use-preferences";
import { PreferencesSettings } from "@/components/sections/Preferences";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
});

describe("configurações com revisão", () => {
  it("pré-visualiza, descarta e só persiste ao confirmar a revisão", async () => {
    render(<PreferencesSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Aparência/ }));
    fireEvent.click(screen.getByRole("button", { name: "Rosa" }));
    expect(document.documentElement.dataset["color"]).toBe("rose");
    expect(localStorage.getItem("studymind-preferences")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(document.documentElement.dataset["color"]).toBe("green");
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Cor do tema");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem("studymind-preferences")!)).toMatchObject({
      color: "blue",
    });
  });
});

it("restaura as preferências ao sair sem salvar e conserva as confirmadas ao reabrir", async () => {
  const first = render(<PreferencesSettings />);
  fireEvent.click(screen.getByRole("switch", { name: "Modo escuro" }));
  expect(document.documentElement).toHaveClass("dark");
  first.unmount();
  expect(document.documentElement).not.toHaveClass("dark");
  const second = render(<PreferencesSettings />);
  fireEvent.click(screen.getByRole("switch", { name: "Modo escuro" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  second.unmount();
  render(<PreferencesSettings />);
  expect(screen.getByRole("switch", { name: "Modo escuro" })).toBeChecked();
  expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
});

it("sincroniza o som quando alterado pelo controle flutuante", () => {
  render(<PreferencesSettings />);
  fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
  expect(screen.getByRole("switch", { name: "Som" })).toBeChecked();
  act(() => {
    localStorage.setItem("studymind-click-sound", "off");
    window.dispatchEvent(new Event("studymind-preferences"));
  });
  expect(screen.getByRole("switch", { name: "Som" })).not.toBeChecked();
  expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
});

it("não perde uma prévia de cor quando o som é alterado em outro controle", () => {
  render(<PreferencesSettings />);
  fireEvent.click(screen.getByRole("button", { name: /Aparência/ }));
  fireEvent.click(screen.getByRole("button", { name: "Rosa" }));
  act(() => {
    localStorage.setItem("studymind-click-sound", "off");
    window.dispatchEvent(new Event("studymind-preferences"));
  });
  expect(document.documentElement.dataset["color"]).toBe("rose");
  fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("1 alteração para aplicar");
  expect(screen.getByRole("dialog")).toHaveTextContent("Cor do tema");
  expect(screen.getByRole("dialog")).not.toHaveTextContent("Som");
});

it("não grava parcialmente as preferências quando o armazenamento falha", () => {
  const before = { ...defaultPreferences, color: "green" as const };
  savePreferences(before, false);
  const original = localStorage.setItem.bind(localStorage);
  const write = vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
    if (key === "studymind-theme" && value === "dark") throw new Error("Quota exceeded");
    original(key, value);
  });
  expect(() => savePreferences({ ...before, color: "rose", sound: false }, true)).toThrow();
  expect(readPreferences()).toEqual(before);
  expect(localStorage.getItem("studymind-click-sound")).toBe("on");
  expect(localStorage.getItem("studymind-theme")).toBe("light");
  expect(document.documentElement.dataset["color"]).toBe("green");
  write.mockRestore();
});

it("respeita o som salvo quando a chave antiga ainda não existe", () => {
  localStorage.setItem(
    "studymind-preferences",
    JSON.stringify({ ...defaultPreferences, sound: false }),
  );
  expect(readPreferences().sound).toBe(false);
});

it("inicia em verde sem preferências salvas e respeita uma paleta salva", () => {
  new Function(preferencesInitScript)();
  expect(document.documentElement.dataset["color"]).toBe("green");
  expect(readPreferences().color).toBe("green");
  localStorage.setItem("studymind-preferences", JSON.stringify({ color: "violet" }));
  new Function(preferencesInitScript)();
  expect(document.documentElement.dataset["color"]).toBe("violet");
  expect(readPreferences().color).toBe("violet");
});

it("aplica os mesmos padrões na abertura e na leitura de preferências corrompidas", () => {
  localStorage.setItem("studymind-preferences", JSON.stringify({ color: "invalid", font: "mono" }));
  new Function(preferencesInitScript)();
  expect(document.documentElement.dataset["font"]).toBe(readPreferences().font);
  expect(document.documentElement.dataset["color"]).toBe(readPreferences().color);
});

it("pré-visualiza e descarta a fonte sem alterar as outras preferências", () => {
  render(<PreferencesSettings />);
  fireEvent.click(screen.getByRole("button", { name: /Aparência/ }));
  expect(screen.queryByText("Tamanho do texto")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Georgia" }));
  expect(document.documentElement.dataset["font"]).toBe("georgia");
  expect(localStorage.getItem("studymind-preferences")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Fonte do texto");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
  expect(document.documentElement.dataset["font"]).toBe("manrope");
});
