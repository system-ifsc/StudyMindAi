import { unzipSync, strFromU8 } from "fflate";
import { MAX_CHARS, validateContent } from "@/lib/core/files";

const MAX_XML_BYTES = 20_000_000;
const MAX_PARTS = 200;

/** Extrai somente texto OOXML. Não executa macros, scripts nem referências externas. */
export async function extractOfficeText(file: File, kind: "docx" | "pptx"): Promise<string> {
  let bytes = 0;
  let parts = 0;
  const parseXml = (xml: string) => {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new Error("Documento com declaração XML não suportada.");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length)
      throw new Error("Não foi possível ler o XML do documento.");
    return doc;
  };
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      const selected =
        kind === "docx"
          ? entry.name === "word/document.xml"
          : /^ppt\/slides\/slide\d+\.xml$/.test(entry.name) ||
            ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"].includes(entry.name);
      if (!selected) return false;
      bytes += entry.originalSize;
      if (/^ppt\/slides\/slide\d+\.xml$/.test(entry.name) || kind === "docx") parts++;
      if (bytes > MAX_XML_BYTES || parts > MAX_PARTS)
        throw new Error(
          "Documento excede o limite de extração (20 MB de texto interno ou 200 slides). Divida o arquivo.",
        );
      return true;
    },
  });
  let names = Object.keys(files)
    .filter((name) => kind === "docx" || /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  // O número no nome do arquivo não representa necessariamente a ordem dos slides.
  if (
    kind === "pptx" &&
    files["ppt/presentation.xml"] &&
    files["ppt/_rels/presentation.xml.rels"]
  ) {
    const presentation = parseXml(strFromU8(files["ppt/presentation.xml"]));
    const rels = parseXml(strFromU8(files["ppt/_rels/presentation.xml.rels"]));
    const targets = new Map(
      Array.from(rels.getElementsByTagNameNS("*", "Relationship"))
        .filter((rel) => rel.getAttribute("TargetMode") !== "External")
        .map((rel) => [rel.getAttribute("Id"), `ppt/${rel.getAttribute("Target")}`]),
    );
    names = Array.from(presentation.getElementsByTagNameNS("*", "sldId")).map((slide) => {
      const id = slide.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id",
      );
      const target = targets.get(id);
      if (!target || !/^ppt\/slides\/slide\d+\.xml$/.test(target) || !files[target])
        throw new Error("A ordem dos slides não pôde ser lida com segurança.");
      return target;
    });
  }
  if (!names.length) throw new Error("Documento sem texto compatível ou arquivo inválido.");
  const result: string[] = [];
  let chars = 0;
  for (const [index, name] of names.entries()) {
    const xml = strFromU8(files[name]!);
    const doc = parseXml(xml);
    const paragraphs = Array.from(doc.getElementsByTagNameNS("*", "p"));
    const text = paragraphs
      .map((p) =>
        Array.from(p.getElementsByTagNameNS("*", "t"))
          .map((t) => t.textContent ?? "")
          .join(""),
      )
      .filter((p) => p.trim())
      .join("\n\n");
    const section = kind === "pptx" ? `## Slide ${index + 1}\n\n${text}` : text;
    chars += section.length + 2;
    if (chars > MAX_CHARS)
      throw new Error("Texto extraído excede 200 mil caracteres. Divida o documento.");
    if (text.trim()) result.push(section);
  }
  const text = result.join("\n\n");
  const error = validateContent(text);
  if (error) throw new Error(error);
  return text;
}
