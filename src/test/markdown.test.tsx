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
