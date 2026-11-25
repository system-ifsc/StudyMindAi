import { useEffect, useState } from "react";
import { MarkdownContent } from "@/components/app/MarkdownContent";
import { Button } from "@/components/ui/button";

/** Markdown continua sendo o formato persistido; ramos também funcionam sem JavaScript. */
export function StudyText({ content }: { content: string }) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    setCanSpeak("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setReading(false);
  }, [content]);
  const sections = content.split(/^##\s+(.+)$/m);
  return (
    <div className="space-y-3 whitespace-normal">
      {sections.length > 1 ? (
        <>
          <MarkdownContent content={sections[0] ?? ""} />
          {Array.from({ length: (sections.length - 1) / 2 }, (_, i) => (
            <details key={`${content.slice(0, 40)}-${i}`} open className="rounded-xl border p-3">
              <summary className="cursor-pointer font-medium">{sections[i * 2 + 1]}</summary>
              <MarkdownContent content={sections[i * 2 + 2] ?? ""} />
            </details>
          ))}
        </>
      ) : (
        <MarkdownContent content={content} />
      )}
      {canSpeak ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.speechSynthesis.cancel();
            if (reading) {
              setReading(false);
              return;
            }
            setError("");
            const speech = new SpeechSynthesisUtterance(content);
            speech.lang = "pt-BR";
            speech.onend = () => setReading(false);
            speech.onerror = () => {
              setReading(false);
              setError(
                "Não foi possível reproduzir. Verifique as vozes instaladas no dispositivo.",
              );
            };
            setReading(true);
            window.speechSynthesis.speak(speech);
          }}
        >
          {reading ? "Parar leitura" : "Ouvir texto"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Leitura em voz alta indisponível neste navegador.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
