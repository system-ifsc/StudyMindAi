import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normalizeMathDelimiters } from "@/lib/core/tutoring";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyText({ text }: { text: string }) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copiedText === text;
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={copied ? "Texto copiado" : "Copiar resposta"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiedText(text);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto para copiá-lo.");
        }
      }}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

/** HTML do modelo é descartado; URLs seguem a validação segura do react-markdown. */
export function MarkdownContent({
  content,
  inline = false,
}: {
  content: string;
  inline?: boolean;
}) {
  const Container = inline ? "span" : "div";
  return (
    <Container className="[&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto min-w-0 space-y-3 whitespace-normal break-words text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:bg-muted/60 [&_pre]:p-4 [&_pre]:text-xs [&_code]:font-mono [&_a]:text-primary [&_a]:underline [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_hr]:my-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              output: "htmlAndMathml",
              trust: false,
              strict: "ignore",
              maxExpand: 100,
              maxSize: 10,
            },
          ],
        ]}
        skipHtml
        components={{
          ...(inline
            ? { p: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> }
            : {}),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => null,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </Container>
  );
}
