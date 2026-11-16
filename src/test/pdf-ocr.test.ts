import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
  destroy: vi.fn(),
  text: vi.fn(),
  render: vi.fn(),
  createWorker: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: mocks.text,
        getViewport: () => ({ width: 100, height: 100 }),
        render: mocks.render,
        cleanup: vi.fn(),
      }),
      loadingTask: { destroy: mocks.destroy },
    }),
  }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "pdf-worker.js" }));
vi.mock("tesseract.js", () => ({ createWorker: mocks.createWorker }));
vi.mock("tesseract.js/dist/worker.min.js?url", () => ({ default: "ocr-worker.js" }));
import { extractPdfText } from "@/lib/pdf-extract";
const file = { arrayBuffer: async () => new ArrayBuffer(0) } as File;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.text.mockResolvedValue({ items: [] });
  mocks.render.mockReturnValue({ promise: Promise.resolve() });
  mocks.recognize.mockResolvedValue({ data: { text: "Texto reconhecido" } });
  mocks.createWorker.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
});
describe("extração de PDF e OCR", () => {
  it("recusa página sem texto quando OCR está desativado", async () => {
    await expect(extractPdfText(file)).rejects.toThrow("Ative o OCR");
    expect(mocks.createWorker).not.toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("reconhece página digitalizada e libera recursos", async () => {
    expect(await extractPdfText(file, { ocr: true })).toBe("Texto reconhecido");
    expect(mocks.createWorker).toHaveBeenCalledWith("por+eng", 1, { workerPath: "ocr-worker.js" });
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("libera o documento e worker se o reconhecimento falhar", async () => {
    mocks.recognize.mockRejectedValueOnce(new Error("download failed"));
    await expect(extractPdfText(file, { ocr: true })).rejects.toThrow("download failed");
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
