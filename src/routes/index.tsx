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
  return (
    <main className="welcome-screen">
      <div className="welcome-layout">
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
        </header>
        <div className="welcome-scene" aria-hidden="true">
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
        <section className="welcome-copy" aria-labelledby="welcome-title">
          <p className="welcome-eyebrow">APRENDA. PLANEJE. EVOLUA.</p>
          <h1 id="welcome-title">
            Cultive seu foco.
            <br />
            <span>Veja seu futuro crescer.</span>
          </h1>
          <p className="welcome-description">
            Seus estudos, seu ritmo. Um espaço para organizar sua rotina e transformar foco em
            conquistas.
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
          <p className="welcome-footnote">Um pouco mais perto do seu futuro.</p>
        </section>
        <section className="welcome-features" aria-label="Seu espaço de estudo">
          <article>
            <span className="feature-number">01</span>
            <BookOpen aria-hidden />
            <h2>Organize suas ideias</h2>
            <p>Disciplinas, materiais e atividades no mesmo lugar.</p>
          </article>
          <article>
            <span className="feature-number">02</span>
            <Timer aria-hidden />
            <h2>Encontre seu ritmo</h2>
            <p>Sessões de foco para dedicar atenção ao que importa.</p>
          </article>
          <article>
            <span className="feature-number">03</span>
            <Brain aria-hidden />
            <h2>Aprenda e relembre</h2>
            <p>Flashcards e revisões para continuar evoluindo.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
