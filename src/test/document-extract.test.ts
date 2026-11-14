import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractOfficeText } from "@/lib/document-extract";

const fakeFile = (entries: Record<string, string>): File => {
  const bytes = zipSync(
    Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, strToU8(value)])),
  );
  return { arrayBuffer: async () => bytes.buffer } as File;
};
describe("extração real de DOCX e PPTX", () => {
  it("lê parágrafos DOCX preservando texto e entidades", async () => {
    const file = fakeFile({
      "word/document.xml":
        '<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Ciência &amp; </w:t></w:r><w:r><w:t>estudo</w:t></w:r></w:p><w:p><w:r><w:t>Outro parágrafo</w:t></w:r></w:p></w:body></w:document>',
    });
    expect(await extractOfficeText(file, "docx")).toBe("Ciência & estudo\n\nOutro parágrafo");
  });
  it("extrai slides na ordem numérica e ignora partes não textuais", async () => {
    const slide = (text: string) =>
      `<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
    const file = fakeFile({
      "ppt/slides/slide10.xml": slide("Dez"),
      "ppt/slides/slide2.xml": slide("Dois"),
      "ppt/slides/slide1.xml": slide("Um"),
      "ppt/media/image.png": "não extrair",
    });
    const text = await extractOfficeText(file, "pptx");
    expect(text.indexOf("Um")).toBeLessThan(text.indexOf("Dois"));
    expect(text.indexOf("Dois")).toBeLessThan(text.indexOf("Dez"));
    expect(text).not.toContain("não extrair");
  });
  it("respeita a ordem do manifesto mesmo quando os nomes dos slides diferem", async () => {
    const slide = (text: string) =>
      `<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
    const file = fakeFile({
      "ppt/slides/slide1.xml": slide("Último"),
      "ppt/slides/slide2.xml": slide("Primeiro"),
      "ppt/presentation.xml":
        '<p:presentation xmlns:p="urn:p" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="r2"/><p:sldId r:id="r1"/></p:sldIdLst></p:presentation>',
      "ppt/_rels/presentation.xml.rels":
        '<Relationships xmlns="urn:rels"><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
    });
    const text = await extractOfficeText(file, "pptx");
    expect(text.indexOf("Primeiro")).toBeLessThan(text.indexOf("Último"));
  });
  it("rejeita arquivo vazio, sem partes compatíveis e XML quebrado", async () => {
    await expect(extractOfficeText(fakeFile({ "other.xml": "texto" }), "docx")).rejects.toThrow();
    await expect(
      extractOfficeText(fakeFile({ "word/document.xml": "<quebrado>" }), "docx"),
    ).rejects.toThrow();
    await expect(
      extractOfficeText(fakeFile({ "word/document.xml": "<document />" }), "docx"),
    ).rejects.toThrow();
  });
  it("rejeita entidades externas e extração acima do limite", async () => {
    await expect(
      extractOfficeText(
        fakeFile({ "word/document.xml": '<!DOCTYPE x SYSTEM "https://example.test"><x />' }),
        "docx",
      ),
    ).rejects.toThrow();
    await expect(
      extractOfficeText(
        fakeFile({
          "word/document.xml": '<p xmlns="urn:test"><t>' + "a".repeat(200001) + "</t></p>",
        }),
        "docx",
      ),
    ).rejects.toThrow();
  });
});
