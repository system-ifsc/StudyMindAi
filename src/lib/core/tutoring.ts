/** Apoio aritmético limitado a equações quadráticas com coeficientes inteiros. Não é um verificador geral de respostas da IA. */
export function quadraticFacts(text: string) {
  const normalized = text.replace(/−|–/g, "-");
  const pattern =
    /(?<![\w.,^+\-²³])([+-]?\s*\d*)\s*x\s*(?:²|\^\s*2)\s*([+-]\s*\d*\s*x)?\s*([+-]\s*\d+)?\s*=\s*0(?![\d.])/g;
  const facts: {
    equation: string;
    a: number;
    b: number;
    c: number;
    discriminant: number;
    roots: number[];
  }[] = [];
  for (const match of normalized.matchAll(pattern)) {
    const coefficient = (s: string) => (s === "" || s === "+" ? 1 : s === "-" ? -1 : Number(s));
    const a = coefficient((match[1] ?? "").replace(/\s/g, "")),
      b = match[2] ? coefficient(match[2].slice(0, -1).replace(/\s/g, "")) : 0,
      c = Number((match[3] ?? "0").replace(/\s/g, ""));
    if (!a || [a, b, c].some((n) => !Number.isSafeInteger(n) || Math.abs(n) > 1_000_000)) continue;
    const discriminant = b * b - 4 * a * c;
    const roots =
      discriminant < 0
        ? []
        : discriminant === 0
          ? [-b / (2 * a)]
          : [
              (-b - Math.sqrt(discriminant)) / (2 * a),
              (-b + Math.sqrt(discriminant)) / (2 * a),
            ].sort((l, r) => l - r);
    facts.push({ equation: match[0], a, b, c, discriminant, roots });
    if (facts.length === 3) break;
  }
  return facts;
}

/** Só considera verificável uma citação literal que realmente existe no documento. */
export function verifiedQuotes(response: string, documents: { content: string }[]) {
  return documents.map((document, index) => {
    for (const match of response.matchAll(/^\s*>\s*\[(\d+)\]\s+(.+)$/gm)) {
      const quote = match[2]?.trim().replace(/^["“]|["”]$/g, "") ?? "";
      if (
        Number(match[1]) === index + 1 &&
        quote.length >= 15 &&
        quote.length <= 2000 &&
        document.content.includes(quote)
      )
        return quote;
    }
    return "";
  });
}

/** Preserva delimitadores em código, onde LaTeX deve continuar literal. */
export function normalizeMathDelimiters(content: string) {
  return content
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `\n$$\n${math}\n$$\n`)
            .replace(/\\\((.*?)\\\)/g, (_, math: string) => `$${math}$`),
    )
    .join("");
}

export function estimatedReadingMinutes(text: string): number {
  return text.trim() ? Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 180)) : 0;
}
