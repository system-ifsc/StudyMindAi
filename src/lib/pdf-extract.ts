/** Extração local; OCR opcional apenas para páginas sem camada de texto. */
export async function extractPdfText(
  file: File,
  options: { ocr?: boolean; onProgress?: (text: string) => void } = {},
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let ocr: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | undefined;
  let scanned = 0;
  try {
    if (doc.numPages > 200)
      throw new Error(
        "Este PDF ultrapassa 200 páginas. Divida o arquivo para analisar todo o conteúdo.",
      );
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = content.items
        .map((it: object) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text && !options.ocr)
        throw new Error(
          `A página ${i} não tem texto extraível. Ative o OCR para importar o documento completo.`,
        );
      if (!text && options.ocr) {
        if (++scanned > 20)
          throw new Error(
            "O OCR aceita até 20 páginas digitalizadas por arquivo. Divida o PDF e tente novamente; nada foi salvo.",
          );
        options.onProgress?.(`Reconhecendo página ${i} de ${doc.numPages}…`);
        if (!ocr) {
          const { createWorker } = await import("tesseract.js");
          const workerUrl = await import("tesseract.js/dist/worker.min.js?url");
          ocr = await createWorker("por+eng", 1, { workerPath: workerUrl.default });
        }
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, Math.sqrt(8_000_000 / (base.width * base.height))),
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        text = (await ocr.recognize(canvas)).data.text.trim();
        canvas.width = 0;
        canvas.height = 0;
      }
      pages.push(text);
      page.cleanup();
    }
    return pages.filter(Boolean).join("\n\n");
  } finally {
    try {
      await ocr?.terminate();
    } finally {
      await doc.loadingTask.destroy();
    }
  }
}
