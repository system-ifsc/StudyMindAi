/** Usa o diálogo nativo de impressão, incluindo a opção Salvar como PDF. */
export function printMaterial(name: string, content: string) {
  const preview = window.open("", "_blank");
  if (!preview) throw new Error("Permita abrir a prévia para salvar como PDF.");
  preview.opener = null;
  preview.document.title = name;
  preview.document.documentElement.lang = "pt-BR";
  const style = preview.document.createElement("style");
  style.textContent =
    "body{font:12pt/1.6 system-ui,sans-serif;color:#111;margin:24mm;overflow-wrap:anywhere}h1{font-size:22pt}pre{font:inherit;white-space:pre-wrap}@page{margin:18mm}@media print{body{margin:0}}";
  const heading = preview.document.createElement("h1");
  heading.textContent = name;
  const body = preview.document.createElement("pre");
  body.textContent = content;
  preview.document.head.append(style);
  preview.document.body.append(heading, body);
  preview.focus();
  preview.print();
}
