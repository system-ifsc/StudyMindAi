import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MarkdownContent, CopyText } from "@/components/app/MarkdownContent";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renderiza listas e código sem executar HTML nem carregar imagens remotas", () => {
  const { container } = render(
    <MarkdownContent
      content={
        "## SQL\n\n- Consultar\n- Filtrar\n\n```sql\nSELECT * FROM alunos;\n```\n\n<script>alert(1)</script>\n\n![imagem](https://example.test/tracker)\n\n[ataque](javascript:alert(1))"
      }
    />,
  );
  expect(screen.getByRole("heading", { name: "SQL" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(container.querySelector("pre code")?.textContent).toContain("SELECT");
  expect(container.querySelector("script, img")).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
});
it("copia o texto original e confirma o resultado", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<CopyText text="SELECT 1;" />);
  fireEvent.click(screen.getByRole("button", { name: "Copiar resposta" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Texto copiado" })).toBeInTheDocument(),
  );
  expect(writeText).toHaveBeenCalledWith("SELECT 1;");
});

it("não confirma a cópia de um conteúdo novo nem de uma cópia antiga ainda pendente", async () => {
  let complete: (() => void) | undefined;
  const writeText = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const { rerender } = render(<CopyText text="Resposta antiga" />);
  fireEvent.click(screen.getByRole("button", { name: "Copiar resposta" }));
  rerender(<CopyText text="Resposta nova" />);
  complete?.();
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("Resposta antiga"));
  expect(screen.getByRole("button", { name: "Copiar resposta" })).toBeInTheDocument();
});

it("renderiza fórmulas com MathML acessível sem permitir comandos LaTeX inseguros", () => {
  const { container } = render(
    <MarkdownContent
      content={
        "Fórmula: \\(x^2 - 5x + 6 = 0\\).\n\n$$\\frac{-b+\\sqrt{b^2-4ac}}{2a}$$\n\n$\\href{javascript:alert(1)}{ataque}$\n\n$\\includegraphics{https://example.test/tracker.png}$"
      }
    />,
  );
  expect(container.querySelector("math")).not.toBeNull();
  expect(container.querySelector("annotation")?.textContent).toContain("x^2");
  expect(container.querySelector("img, script, iframe, a[href^='javascript:']")).toBeNull();
});
