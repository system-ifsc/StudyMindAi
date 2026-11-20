import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { useProfile, useSave } from "@/hooks/use-data";
import { shouldShowTutorial, TUTORIAL_STEPS } from "@/lib/core/tutorial";
import { Button } from "@/components/ui/button";

const TutorialContext = createContext(() => {});
export const useTutorial = () => useContext(TutorialContext);

type Rect = { top: number; left: number; width: number; height: number };

export function TutorialProvider({
  children,
  mode,
  section,
  revealSection,
}: {
  children: ReactNode;
  mode: "real" | "demo";
  section?: string;
  revealSection?: (section: string) => void;
}) {
  const profile = useProfile();
  const [step, setStep] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const save = useSave<void>((repo) => repo.updateProfile({ tutorial_completed: true }), {
    invalidate: ["profile"],
  });
  const current = step === null ? null : TUTORIAL_STEPS[step];

  useEffect(() => {
    if (!dismissed && shouldShowTutorial(profile.data, mode)) setStep((value) => value ?? 0);
  }, [profile.data, mode, dismissed]);

  useEffect(() => {
    if (
      current &&
      (current.target === "atividades" || current.target === "calendario") &&
      !["planejador", "atividades", "calendario"].includes(section ?? "")
    ) {
      revealSection?.("planejador");
    }
  }, [current, section, revealSection]);

  useEffect(() => {
    if (!current?.target) return;
    const update = () => {
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`),
      ];
      const target =
        candidates.find((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.width > 0 && bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        }) ??
        candidates.find((node) => node.getBoundingClientRect().width > 0) ??
        document.querySelector<HTMLElement>('[data-tour="more"]');
      const bounds = target?.getBoundingClientRect();
      setRect(
        bounds && bounds.width > 0
          ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height }
          : null,
      );
    };
    const target = [
      ...document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`),
    ].find((node) => node.getBoundingClientRect().width > 0);
    target?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current, section]);

  async function finish() {
    try {
      await save.mutateAsync();
      setDismissed(true);
      setStep(null);
      setRect(null);
    } catch {
      // useSave exibe o erro. Mantém o passeio aberto para permitir tentar novamente.
    }
  }
  function move(next: number) {
    setRect(null);
    setStep(next);
  }
  const highlighted = current?.target ? rect : null;
  const below = highlighted && highlighted.top < window.innerHeight / 2;
  return (
    <TutorialContext.Provider
      value={() => {
        setDismissed(true);
        move(0);
      }}
    >
      {children}
      <Dialog.Root
        open={step !== null}
        onOpenChange={(open) => {
          if (!open && !save.isPending) void finish();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          {highlighted && (
            <div
              aria-hidden
              className="pointer-events-none fixed z-[81] rounded-xl border-2 border-primary bg-primary/10 ring-4 ring-background"
              style={{
                top: highlighted.top - 4,
                left: highlighted.left - 4,
                width: highlighted.width + 8,
                height: highlighted.height + 8,
              }}
            >
              {below ? (
                <ArrowUp className="absolute -bottom-9 left-1/2 size-7 -translate-x-1/2 text-primary" />
              ) : (
                <ArrowDown className="absolute -top-9 left-1/2 size-7 -translate-x-1/2 text-primary" />
              )}
            </div>
          )}
          <Dialog.Content
            onPointerDownOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              if (!save.isPending) void finish();
            }}
            className="fixed left-1/2 z-[82] grid max-h-[65dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 gap-4 overflow-y-auto rounded-3xl border bg-popover p-5 text-popover-foreground shadow-xl sm:p-6"
            style={
              highlighted
                ? below
                  ? {
                      top: Math.min(
                        highlighted.top + highlighted.height + 44,
                        window.innerHeight * 0.35,
                      ),
                    }
                  : { bottom: Math.max(24, window.innerHeight - highlighted.top + 44) }
                : { top: "50%", transform: "translate(-50%, -50%)" }
            }
          >
            <Sparkles className="size-6 text-primary" aria-hidden />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Passo {(step ?? 0) + 1} de {TUTORIAL_STEPS.length}
            </p>
            <Dialog.Title className="text-xl font-bold">{current?.title}</Dialog.Title>
            <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
              {current?.description}
            </Dialog.Description>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" disabled={save.isPending} onClick={() => void finish()}>
                Pular tutorial
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={step === 0 || save.isPending}
                  onClick={() => move((step ?? 1) - 1)}
                >
                  Voltar
                </Button>
                <Button
                  disabled={save.isPending}
                  onClick={() =>
                    step === TUTORIAL_STEPS.length - 1 ? void finish() : move((step ?? 0) + 1)
                  }
                >
                  {save.isPending
                    ? "Salvando…"
                    : step === TUTORIAL_STEPS.length - 1
                      ? "Concluir"
                      : step === 0
                        ? "Começar"
                        : "Avançar"}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </TutorialContext.Provider>
  );
}
