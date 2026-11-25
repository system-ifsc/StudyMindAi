import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Feedback } from "@/components/sections/Feedback";
const mocks = vi.hoisted(() => ({ mode: "real", session: vi.fn() }));
vi.mock("@/hooks/use-data", () => ({ useRepo: () => ({ mode: mocks.mode }) }));
vi.mock("@/lib/auth/client", () => ({ auth: { getSession: mocks.session } }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.mode = "real";
  vi.clearAllMocks();
});
it("bloqueia envio e acesso à API na demonstração", () => {
  mocks.mode = "demo";
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<Feedback />);
  expect(screen.getByRole("button", { name: "Enviar feedback" })).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it("mantém o contato no app quando o servidor não está configurado", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ configured: false })),
  );
  render(<Feedback />);
  await screen.findByText(/O contato pelo app está temporariamente indisponível/);
  expect(screen.getByRole("button", { name: "Enviar feedback" })).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("mantém a mensagem após falha e limpa somente quando o servidor confirma", async () => {
  mocks.session.mockResolvedValue({ data: { session: { access_token: "test" } } });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ configured: true }))
    .mockResolvedValueOnce(Response.json({ error: "Falha ao enviar" }, { status: 502 }))
    .mockResolvedValueOnce(Response.json({ saved: true, sent: true, id: "receipt-123" }));
  vi.stubGlobal("fetch", fetcher);
  render(<Feedback />);
  const button = screen.getByRole("button", { name: "Enviar feedback" });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Ana Silva" } });
  fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "ana@gmail.com" } });
  const input = screen.getByLabelText("Sua mensagem");
  fireEvent.change(input, { target: { value: "Melhorar o calendário de estudos" } });
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao enviar");
  expect(input).toHaveValue("Melhorar o calendário de estudos");
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Ana Silva");
  expect(screen.getByLabelText("Seu e-mail")).toHaveValue("ana@gmail.com");
  fireEvent.click(button);
  await screen.findByText(/Feedback recebido!/);
  expect(input).toHaveValue("");
  expect(fetcher).toHaveBeenNthCalledWith(
    2,
    "/api/feedback",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer test" }),
      body: JSON.stringify({
        name: "Ana Silva",
        email: "ana@gmail.com",
        category: "Opinião",
        message: "Melhorar o calendário de estudos",
      }),
    }),
  );
});

it("valida o e-mail antes de chamar a API de envio", async () => {
  const fetcher = vi.fn(async () => Response.json({ configured: true }));
  vi.stubGlobal("fetch", fetcher);
  render(<Feedback />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Enviar feedback" })).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Ana Silva" } });
  fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "email-invalido" } });
  fireEvent.change(screen.getByLabelText("Sua mensagem"), {
    target: { value: "Melhorar calendário" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Enviar feedback" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("e-mail válido");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("não confirma o feedback quando o registro não foi enviado por e-mail", async () => {
  mocks.session.mockResolvedValue({ data: { session: { access_token: "test" } } });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ configured: true, emailConfigured: false }))
      .mockResolvedValueOnce(
        Response.json(
          { error: "Não foi possível enviar o feedback por e-mail.", saved: true, sent: false },
          { status: 502 },
        ),
      ),
  );
  render(<Feedback />);
  const button = screen.getByRole("button", { name: "Enviar feedback" });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Ana Silva" } });
  fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "ana@gmail.com" } });
  fireEvent.change(screen.getByLabelText("Sua mensagem"), {
    target: { value: "Melhorar o calendário" },
  });
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar");
  expect(screen.queryByText(/receipt-123/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Sua mensagem")).toHaveValue("Melhorar o calendário");
});
