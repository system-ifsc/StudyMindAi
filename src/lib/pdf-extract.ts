/** Extração real de texto de PDF no navegador (pdf.js). PDFs digitalizados (imagem) não têm texto extraível. */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    if (doc.numPages > 200)
      throw new Error(
        "Este PDF ultrapassa 200 páginas. Divida o arquivo para analisar todo o conteúdo.",
      );
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((it: object) => ("str" in it ? it.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    return pages.filter(Boolean).join("\n\n");
  } finally {
    await doc.loadingTask.destroy();
  }
}
