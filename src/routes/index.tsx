import { useSceneMotion } from "@/hooks/use-scene-motion";
import { useReveal } from "@/hooks/use-reveal";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Brain, BookOpen, Check, Timer, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth/client";
import { isAuthConfigured } from "@/lib/auth-config";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (!isAuthConfigured()) return;
    const { data } = await auth.getSession();
    if (data.session)
      throw redirect({ to: "/app/$section", params: { section: "painel" }, replace: true });
  },
  head: () => ({
    meta: [
      { title: "Bem-vindo — StudyMind AI" },
      { name: "description", content: "Seu espaço para aprender, planejar e evoluir." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const revealRef = useReveal();
  const sceneRef = useSceneMotion();
  return (
    <main className="welcome-screen welcome-start">
      <div className="welcome-layout" ref={revealRef}>
        <div className="welcome-bubbles" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <header className="welcome-brand">
          <span className="welcome-mark">
            <Brain aria-hidden />
          </span>
          <span>
            StudyMind<span className="welcome-ai">AI</span>
          </span>
          <Link to="/demo/$section" params={{ section: "painel" }} className="welcome-explore">
            Explorar plataforma <ArrowRight className="size-4" aria-hidden />
          </Link>
        </header>
        <div className="welcome-scene" ref={sceneRef} aria-hidden="true">
          <div className="welcome-scene-canvas">
            <div className="scene-particles">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="scene-orbit" />
            <div className="scene-insight">
              <span>SEU RITMO, SUA EVOLUÇÃO</span>
              <strong>Todo passo conta.</strong>
              <div className="scene-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <small>Ilustração de progresso</small>
            </div>
            <div className="scene-paper">
              <span className="scene-paper-icon">
                <BookOpen />
              </span>
              <span className="scene-kicker">UM DIA DE CADA VEZ</span>
              <strong>
                Espaço para
                <br />
                novas conquistas.
              </strong>
              <div className="scene-task">
                <span>
                  <Check />
                </span>{" "}
                Encontrar meu foco
              </div>
              <div className="scene-task">
                <span>
                  <Check />
                </span>{" "}
                Aprender algo novo
              </div>
              <div className="scene-task scene-pending">
                <span /> Dar o próximo passo
              </div>
              <div className="scene-progress">
                <span />
              </div>
            </div>
            <div className="scene-focus">
              <Timer />
              <span>
                Tempo para você<strong>25:00</strong>
              </span>
            </div>
            <span className="scene-spark">
              <Sparkles />
            </span>
          </div>
        </div>
        <section className="welcome-copy" aria-labelledby="welcome-title">
          <p className="welcome-eyebrow">UM BOM COMEÇO MUDA O SEU DIA</p>
          <h1 id="welcome-title">
            Menos distração.
            <br />
            <span>Mais espaço para aprender.</span>
          </h1>
          <p className="welcome-description">
            Organize o que precisa estudar, encontre seu ritmo e acompanhe cada conquista. Comece
            com um pequeno passo hoje.
          </p>
          <div className="entry-benefits">
            <span>
              <BookOpen aria-hidden /> Tudo organizado
            </span>
            <span>
              <Timer aria-hidden /> Mais foco
            </span>
            <span>
              <Sparkles aria-hidden /> Novas descobertas
            </span>
          </div>
          <div className="welcome-actions">
            <Button asChild className="welcome-primary">
              <Link to="/cadastro">
                Começar agora <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="welcome-secondary">
              <Link to="/login">Já tenho uma conta</Link>
            </Button>
          </div>
          <p className="welcome-footnote">
            <Link to="/demo/$section" params={{ section: "painel" }}>
              Experimentar sem cadastro <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <span>Demonstração com dados fictícios.</span>
          </p>
        </section>
        <section className="welcome-features" aria-label="Seu espaço de estudo">
          <article>
            <span className="feature-number">01</span>
            <BookOpen aria-hidden />
            <h2>Escolha o que estudar</h2>
            <p>Adicione suas disciplinas e a primeira atividade.</p>
          </article>
          <article>
            <span className="feature-number">02</span>
            <Timer aria-hidden />
            <h2>Reserve um tempo para você</h2>
            <p>Inicie uma sessão de foco, no seu ritmo.</p>
          </article>
          <article>
            <span className="feature-number">03</span>
            <Brain aria-hidden />
            <h2>Veja seu aprendizado crescer</h2>
            <p>Revise com cartões e acompanhe sua evolução.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
