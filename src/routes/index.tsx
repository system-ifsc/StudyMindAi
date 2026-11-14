import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Layers,
  Timer,
  Target,
  Sparkles,
  ShieldCheck,
  Brain,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import hero from "@/assets/hero-study-ifsc.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyMind AI — Planeje, foque e revise com estratégia" },
      {
        name: "description",
        content:
          "Disciplinas, atividades, planejador por prazo, Pomodoro, flashcards com revisão espaçada e exercícios em um só lugar.",
      },
      { property: "og:title", content: "StudyMind AI — Estudo com estratégia" },
      {
        property: "og:description",
        content:
          "Planejador automático por prazo, foco cronometrado e revisão espaçada para estudantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarDays,
    title: "Planejador por prazo",
    text: "Um algoritmo transparente distribui suas atividades conforme sua disponibilidade e as datas de entrega.",
  },
  {
    icon: Timer,
    title: "Foco cronometrado",
    text: "Pomodoro com pausa que não perde tempo ao recarregar a página e registra cada sessão uma única vez.",
  },
  {
    icon: Layers,
    title: "Revisão espaçada",
    text: "Flashcards voltam no momento certo, com intervalos que crescem conforme você acerta.",
  },
  {
    icon: Brain,
    title: "Exercícios comentados",
    text: "Banco de questões com explicação e resultado por tema, calculado das suas respostas.",
  },
  {
    icon: BarChart3,
    title: "Painel honesto",
    text: "Métricas calculadas apenas dos seus registros. Nada inventado.",
  },
  {
    icon: Sparkles,
    title: "Assistente de estudos",
    text: "Tire dúvidas sobre seus materiais com IA real, processada no servidor.",
  },
];

function Landing() {
  return (
    <div className="plasma-page min-h-screen">
      <header className="glass-chrome mx-auto flex max-w-7xl gap-2 rounded-b-3xl border-x border-b items-center justify-between px-3 py-4 sm:px-5 lg:px-8">
        <Logo className="shrink-0 gap-1.5 [&>span:first-child]:size-8 [&>span:last-child]:text-sm sm:gap-2.5 sm:[&>span:first-child]:size-9 sm:[&>span:last-child]:text-lg" />
        <nav
          className="flex shrink-0 items-center justify-end gap-1 sm:gap-2"
          aria-label="Principal"
        >
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/demo/$section" params={{ section: "painel" }}>
              Ver demonstração
            </Link>
          </Button>
          <Button asChild variant="ghost" className="px-2 text-xs sm:px-4 sm:text-sm">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild className="rounded-full px-3 text-xs sm:px-4 sm:text-sm">
            <Link to="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="bg-glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-10 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-20">
            <div className="animate-rise">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-soft backdrop-blur">
                <ShieldCheck className="size-3.5 text-success" aria-hidden /> Seus dados ficam só
                com você
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] min-[400px]:text-5xl tracking-tight sm:text-6xl lg:text-7xl">
                Estude com <em className="text-brand not-italic">estratégia</em>, não com pressa.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                A StudyMind reúne disciplinas, prazos, foco e revisões. Você informa quanto tempo
                tem; o planejador mostra o que estudar em cada dia.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="hero" size="lg">
                  <Link to="/cadastro">
                    Começar grátis <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full">
                  <Link to="/demo/$section" params={{ section: "painel" }}>
                    Explorar a demonstração
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                A demonstração usa dados fictícios e não salva nada.
              </p>
            </div>
            <div className="relative animate-rise [animation-delay:120ms] lg:pl-4">
              <img
                src={hero}
                alt="Caderno aberto com anotações e reflexos de luz verde e vermelha"
                className="plasma-image aspect-[4/3] w-full rounded-[2rem] object-cover shadow-elevated ring-1 ring-black/5"
                width={1536}
                height={1024}
              />
              <div className="glass-panel surface-lift absolute -bottom-6 left-6 rounded-2xl border bg-card/95 p-4 shadow-card backdrop-blur sm:left-auto sm:right-6">
                <p className="text-xs text-muted-foreground">Hoje no plano</p>
                <p className="font-display text-xl font-semibold">2 blocos · 1h15</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8" aria-labelledby="recursos">
          <p className="text-eyebrow">Um sistema completo</p>
          <h2
            id="recursos"
            className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Tudo o que um bom método de estudo precisa.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="glass-panel surface-lift rounded-2xl border bg-card p-6 shadow-card"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground ring-1 ring-primary/10">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
          <div className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[2rem] bg-brand p-6 sm:p-10 text-primary-foreground shadow-elevated sm:flex-row sm:items-center">
            <div
              className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full border border-white/15"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-36 right-20 size-80 rounded-full border border-white/10"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-3xl font-semibold">Comece pela sua semana.</h2>
              <p className="mt-2 opacity-90">
                Defina objetivo, curso e horas disponíveis em menos de um minuto.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="relative w-full shrink-0 rounded-full sm:w-auto"
            >
              <Link to="/cadastro">
                <Target className="size-4" aria-hidden /> Criar minha conta
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} StudyMind AI</span>
          <Link to="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
