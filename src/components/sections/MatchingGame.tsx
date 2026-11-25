import { useState } from "react";
import { matchingPairs } from "@/lib/core/engagement";
import type { Flashcard } from "@/lib/core/types";
import { Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export function MatchingGame({ cards }: { cards: Flashcard[] }) {
  const [round, setRound] = useState<Flashcard[]>([]);
  const [selected, setSelected] = useState("");
  const [matched, setMatched] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const pairs = matchingPairs(cards);
  return (
    <Panel title="Jogo de associação">
      <p className="mb-3 text-sm text-muted-foreground">
        Associe perguntas e respostas dos seus cartões. Treino livre, sem alterar as datas da
        revisão espaçada.
      </p>
      <Button
        variant="outline"
        disabled={pairs.length < 2}
        onClick={() => {
          setRound(pairs);
          setMatched([]);
          setSelected("");
          setFeedback("");
        }}
      >
        {round.length ? "Recomeçar jogo" : "Começar associação"}
      </Button>
      {pairs.length < 2 && (
        <p className="mt-2 text-sm">
          Crie pelo menos dois cartões com perguntas e respostas distintas.
        </p>
      )}
      {round.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-2" role="group" aria-label="Perguntas para associar">
              {round.map((c) => (
                <Button
                  key={c.id}
                  variant={selected === c.id ? "secondary" : "outline"}
                  className="h-auto min-h-16 w-full whitespace-normal"
                  disabled={matched.includes(c.id)}
                  aria-pressed={selected === c.id}
                  onClick={() => {
                    setSelected(c.id);
                    setFeedback("");
                  }}
                >
                  {c.front}
                </Button>
              ))}
            </div>
            <div className="space-y-2" role="group" aria-label="Respostas para associar">
              {round
                .map((_, i) => round[(i + 1) % round.length]!)
                .map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    className="h-auto min-h-16 w-full whitespace-normal"
                    disabled={!selected || matched.includes(c.id)}
                    onClick={() => {
                      if (selected === c.id) {
                        setMatched((ids) => [...ids, c.id]);
                        setSelected("");
                        setFeedback("Associação correta!");
                      } else setFeedback("Tente outra resposta. Releia a pergunta com calma.");
                    }}
                  >
                    {c.back}
                  </Button>
                ))}
            </div>
          </div>
          <p role="status" className="mt-3 text-sm">
            {matched.length === round.length ? "Rodada concluída!" : feedback} {matched.length}/
            {round.length} pares.
          </p>
        </>
      )}
    </Panel>
  );
}
