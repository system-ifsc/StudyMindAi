import { Brain } from "lucide-react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

const StartupContext = createContext<(delta: number) => void>(() => {});

/** Keeps the opening screen visible while a lazy section is being downloaded. */
export function StartupPending({ children }: { children: ReactNode }) {
  const register = useContext(StartupContext);
  useEffect(() => {
    register(1);
    return () => register(-1);
  }, [register]);
  return children;
}

export function StartupScreen({ children }: { children: ReactNode }) {
  const router = useRouter();
  const cache = router.options.context.queryClient.getQueryCache();
  const routing = useRouterState({ select: (state) => state.isLoading });
  const pending = useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () =>
      cache
        .getAll()
        .some((query) => query.getObserversCount() > 0 && query.state.status === "pending"),
    () => true,
  );
  const [blockers, setBlockers] = useState(0);
  const [register] = useState(() => (delta: number) => setBlockers((count) => count + delta));
  const [documentReady, setDocumentReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const ready = () => setDocumentReady(true);
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => {
      window.removeEventListener("load", ready);
    };
  }, []);

  useEffect(() => {
    if (
      phase !== "loading" ||
      !minimumElapsed ||
      !documentReady ||
      routing ||
      pending ||
      blockers > 0
    )
      return;
    // A quiet interval allows newly mounted sections to register their queries.
    const timer = window.setTimeout(() => setPhase("leaving"), 450);
    return () => window.clearTimeout(timer);
  }, [minimumElapsed, documentReady, routing, pending, blockers, phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("done"), 850);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "done") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  return (
    <StartupContext.Provider value={register}>
      <div inert={phase !== "done"} aria-busy={phase !== "done"}>
        {children}
      </div>
      {phase !== "done" && (
        <div
          className="startup-screen"
          data-phase={phase}
          role="status"
          aria-live="polite"
          aria-label="Carregando StudyMind AI"
        >
          <div className="startup-universe" aria-hidden="true">
            <div className="startup-stars">
              {Array.from({ length: 18 }, (_, index) => (
                <i
                  key={index}
                  style={
                    {
                      "--star-x": `${(index * 37 + 11) % 100}%`,
                      "--star-y": `${(index * 53 + Math.floor(index / 7) * 19) % 100}%`,
                      "--star-size": `${index % 5 === 0 ? 2 : 1}px`,
                      "--star-delay": `${-(index % 11) * 0.7}s`,
                      "--star-duration": `${6 + (index % 5)}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
          <div className="startup-content">
            <div className="startup-emblem" aria-hidden="true">
              <span className="startup-core">
                <Brain size={44} strokeWidth={1.4} />
              </span>
            </div>
            <p className="startup-status">Preparando seu espaço de estudo…</p>
            <div className="startup-track" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      )}
    </StartupContext.Provider>
  );
}
