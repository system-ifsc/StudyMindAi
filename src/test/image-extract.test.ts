import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn() }));
vi.mock("tesseract.js", () => ({ createWorker: async () => mocks }));
vi.mock("tesseract.js/dist/worker.min.js?url", () => ({ default: "/worker.js" }));
import { extractImageText } from "@/lib/image-extract";
function setup() {
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 4000;
      naturalHeight = 3000;
      decode = async () => {};
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("extrai texto sem enviar a imagem ao servidor e libera os recursos", async () => {
  setup();
  mocks.recognize.mockResolvedValue({ data: { text: "  Conteúdo da aula  " } });
  expect(await extractImageText(new File(["image"], "a.png"))).toBe("Conteúdo da aula");
  const canvas = mocks.recognize.mock.calls[0]![0] as HTMLCanvasElement;
  expect(canvas.width).toBe(0);
  expect(mocks.terminate).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
});
it("não inventa texto para imagem sem caracteres reconhecidos", async () => {
  setup();
  mocks.recognize.mockResolvedValue({ data: { text: "  " } });
  await expect(extractImageText(new File(["image"], "a.png"))).rejects.toThrow("Nenhum texto");
  expect(mocks.terminate).toHaveBeenCalled();
});
