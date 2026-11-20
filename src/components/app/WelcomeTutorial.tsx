import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles } from "lucide-react";
import { useProfile, useSave } from "@/hooks/use-data";
import { TutorialContext } from "@/hooks/use-tutorial";
import {
  shouldShowTutorial,
  TUTORIAL_STEPS,
  tutorialLayout,
  type TutorialRect,
} from "@/lib/core/tutorial";
import { Button } from "@/components/ui/button";

export function TutorialProvider({
  children,
  mode,
  section,
  revealSection,
  setMobileMenu,
}: {
  children: ReactNode;
  mode: "real" | "demo";
  section?: string;
  revealSection?: (section: string) => void;
  setMobileMenu?: (open: boolean) => void;
}) {
  const profile = useProfile();
  const [step, setStep] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<TutorialRect | null>(null);
  const [viewport, setViewport] = useState({ width: 480, height: 800 });
  const [contentHeight, setContentHeight] = useState(320);
  const content = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const arrowId = useId();
  const save = useSave<void>((repo) => repo.updateProfile({ tutorial_completed: true }), {
    invalidate: ["profile"],
  });
  const current = step === null ? null : TUTORIAL_STEPS[step];

  useEffect(() => {
    if (!current?.target || !setMobileMenu || typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    const dockTargets = ["painel", "planejador", "foco", "flashcards"];
    const contentTargets = ["atividades", "calendario"];
    const shouldOpenMenu =
      isMobile && !dockTargets.includes(current.target) && !contentTargets.includes(current.target);
    setMobileMenu(shouldOpenMenu);
  }, [current, setMobileMenu]);

  useEffect(() => {
    if (!dismissed && shouldShowTutorial(profile.data, mode)) setStep((value) => value ?? 0);
  }, [profile.data, mode, dismissed]);

  useEffect(() => {
    if (
      current &&
      (current.target === "atividades" || current.target === "calendario") &&
      !["planejador", "atividades", "calendario"].includes(section ?? "")
    )
      revealSection?.("planejador");
  }, [current, section, revealSection]);

  useEffect(() => {
    if (!current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastTarget: HTMLElement | null = null;
    const update = () => {
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      setViewport((old) =>
        old.width === width && old.height === height ? old : { width, height },
      );
      if (content.current) {
        const measured = content.current.getBoundingClientRect().height + 2;
        if (measured > 2) setContentHeight((old) => (old === measured ? old : measured));
      }
      const candidates = current.target
        ? [...document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`)]
        : [];
      const visible = (node: HTMLElement) => {
        const bounds = node.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.left < width;
      };
      const target =
        candidates.find(
          (node) =>
            visible(node) &&
            node.getBoundingClientRect().top >= 0 &&
            node.getBoundingClientRect().bottom <= height,
        ) ??
        candidates.find(visible) ??
        (current.target ? document.querySelector<HTMLElement>('[data-tour="more"]') : null);
      if (target && target !== lastTarget) {
        lastTarget = target;
        target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
      }
      const bounds = target?.getBoundingClientRect();
      const next =
        bounds &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.top >= 0 &&
        bounds.bottom <= height &&
        bounds.left >= 0 &&
        bounds.right <= width
          ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height }
          : null;
      setRect((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 0);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    if (content.current) observer?.observe(content.current);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    document.addEventListener("transitionend", schedule, true);
    document.addEventListener("animationend", schedule, true);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.removeEventListener("transitionend", schedule, true);
      document.removeEventListener("animationend", schedule, true);
    };
  }, [current, section]);

  async function finish() {
    try {
      await save.mutateAsync();
      setDismissed(true);
      setStep(null);
      setRect(null);
    } catch {
      // useSave exibe o erro e mantém o passeio aberto para uma nova tentativa.
    }
  }
  function move(next: number) {
    setRect(null);
    setStep(Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, next)));
  }
  const highlighted = current?.target ? rect : null;
  const layout = tutorialLayout(viewport, contentHeight, highlighted);
  const cardHeight = Math.min(contentHeight, layout.maxHeight);
  const arrow =
    highlighted && layout.side !== "center"
      ? {
          x1:
            layout.side === "right"
              ? layout.left
              : layout.side === "left"
                ? layout.left + layout.width
                : Math.max(
                    layout.left + 16,
                    Math.min(
                      highlighted.left + highlighted.width / 2,
                      layout.left + layout.width - 16,
                    ),
                  ),
          y1:
            layout.side === "below"
              ? layout.top
              : layout.side === "above"
                ? layout.top + cardHeight
                : Math.max(
                    layout.top + 16,
                    Math.min(
                      highlighted.top + highlighted.height / 2,
                      layout.top + cardHeight - 16,
                    ),
                  ),
          x2:
            layout.side === "right"
              ? highlighted.left + highlighted.width + 6
              : layout.side === "left"
                ? highlighted.left - 6
                : highlighted.left + highlighted.width / 2,
          y2:
            layout.side === "below"
              ? highlighted.top + highlighted.height + 6
              : layout.side === "above"
                ? highlighted.top - 6
                : highlighted.top + highlighted.height / 2,
        }
      : null;
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
          <Dialog.Overlay
            className={`fixed inset-0 z-[80] ${highlighted ? "bg-transparent" : "bg-black/50"}`}
          />
          {highlighted && (
            <div
              data-tour-highlight
              aria-hidden
              className="pointer-events-none fixed z-[81] rounded-xl border-2 border-primary ring-2 ring-background"
              style={{
                top: highlighted.top - 4,
                left: highlighted.left - 4,
                width: highlighted.width + 8,
                height: highlighted.height + 8,
                boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.5)",
              }}
            />
          )}
          {arrow && (
            <svg
              aria-hidden
              className="pointer-events-none fixed inset-0 z-[81] size-full text-primary"
              width={viewport.width}
              height={viewport.height}
            >
              <defs>
                <marker
                  id={arrowId}
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6" fill="currentColor" />
                </marker>
              </defs>
              <line
                {...arrow}
                stroke="currentColor"
                strokeWidth="2"
                markerEnd={`url(#${arrowId})`}
              />
            </svg>
          )}
          <Dialog.Content
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              nextButton.current?.focus({ preventScroll: true });
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              if (!save.isPending) void finish();
            }}
            className="fixed z-[82] overflow-y-auto overscroll-contain rounded-3xl border bg-popover text-popover-foreground shadow-xl"
            style={{
              left: layout.left,
              top: layout.top,
              width: layout.width,
              maxHeight: layout.maxHeight,
            }}
          >
            <div ref={content} className="grid gap-4 p-5 sm:p-6">
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
                    ref={nextButton}
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
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </TutorialContext.Provider>
  );
}
