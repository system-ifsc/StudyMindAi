export const MAX_TEXT_BYTES = 1_000_000; // 1 MB
export const MAX_PDF_BYTES = 10_000_000; // 10 MB
export const MAX_DOCUMENT_BYTES = 10_000_000;
export const MAX_CHARS = 200_000;

export type FileKind = "txt" | "md" | "pdf" | "docx" | "pptx";
export function detectKind(name: string): FileKind | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "txt"
    ? "txt"
    : ext === "md" || ext === "markdown"
      ? "md"
      : ext === "pdf"
        ? "pdf"
        : ext === "docx" || ext === "pptx"
          ? ext
          : null;
}
export function validateFile(
  name: string,
  size: number,
): { ok: true; kind: FileKind } | { ok: false; error: string } {
  const kind = detectKind(name);
  if (!kind)
    return { ok: false, error: "Formato não suportado. Envie .txt, .md, .pdf, .docx ou .pptx." };
  if (size === 0) return { ok: false, error: "O arquivo está vazio." };
  const max = kind === "txt" || kind === "md" ? MAX_TEXT_BYTES : MAX_DOCUMENT_BYTES;
  if (size > max)
    return { ok: false, error: `Arquivo grande demais (máximo ${max / 1_000_000} MB).` };
  return { ok: true, kind };
}
export function validateContent(text: string): string | null {
  if (!text.trim()) return "Nenhum texto encontrado no arquivo.";
  if (text.length > MAX_CHARS)
    return `O texto tem ${text.length.toLocaleString("pt-BR")} caracteres; o limite é ${MAX_CHARS.toLocaleString("pt-BR")}.`;
  return null;
}
