/** OCR no dispositivo. Extrai texto; não interpreta gráficos, diagramas ou conteúdo visual. */
export async function extractImageText(file: File, onProgress?: (text: string) => void) {
  const url = URL.createObjectURL(file);
  let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | undefined;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Imagem inválida.");
    const scale = Math.min(1, Math.sqrt(8_000_000 / (image.naturalWidth * image.naturalHeight)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Este dispositivo não suporta a leitura desta imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    onProgress?.("Reconhecendo texto da imagem… O primeiro uso baixa o mecanismo e os idiomas.");
    const { createWorker } = await import("tesseract.js");
    const workerUrl = await import("tesseract.js/dist/worker.min.js?url");
    worker = await createWorker("por+eng", 1, { workerPath: workerUrl.default });
    try {
      const text = (await worker.recognize(canvas)).data.text.trim();
      if (!text) throw new Error("Nenhum texto reconhecido. Tente uma imagem mais nítida.");
      return text;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
    await worker?.terminate();
  }
}
