import { availabilityError } from "@/lib/core/profile";
import { BackLink } from "@/components/navigation/BackLink";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, BookOpen, Target, Clock3, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createRepo } from "@/lib/repo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/Logo";
import { AvailabilityEditor } from "@/components/app/AvailabilityEditor";
import { formatMinutes } from "@/lib/core/dates";
import { CourseSelect } from "@/components/app/CourseSelect";
import { requireCourse } from "@/lib/core/courses";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — StudyMind AI" },
      { name: "description", content: "Configure objetivo, curso e horas de estudo." },
      { property: "og:title", content: "Primeiros passos — StudyMind AI" },
      { property: "og:description", content: "Configure objetivo, curso e horas de estudo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const repo = useMemo(() => createRepo(user.id), [user.id]);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [objective, setObjective] = useState("");
  const [avail, setAvail] = useState([60, 60, 60, 60, 60, 0, 0]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    repo
      .getProfile()
      .then((p) => {
        if (!active) return;
        setName(p.display_name);
        setCourse(p.course);
        setObjective(p.objective);
        setAvail(p.availability);
      })
      .catch((err) => toast.error((err as Error).message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo]);
  const total = avail.reduce((a, b) => a + b, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const error = availabilityError(avail);
    if (error) toast.error(error);
    else await save();
  }
  async function save() {
    setBusy(true);
    try {
      // Garante que o perfil existe antes do UPDATE, inclusive se a leitura inicial falhou.
      await repo.getProfile();
      await repo.updateProfile({
        display_name: name.trim(),
        course: requireCourse(course),
        objective: objective.trim(),
        availability: avail,
        weekly_hours: Math.max(1, Math.round(total / 60)),
        onboarded: true,
      });
      toast.success("Perfil salvo");
      navigate({ to: "/app/$section", params: { section: "painel" } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="plasma-page onboarding-start min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <BackLink className="mt-4" />
        <p className="mt-10 text-xs font-semibold tracking-widest text-primary">
          SEU PRIMEIRO PASSO
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Vamos montar sua rotina</h1>
        <p className="mt-2 text-muted-foreground">
          Um plano que cabe na sua vida. Conte um pouco sobre você; depois, adicione sua primeira
          atividade.
        </p>
        <form
          onSubmit={submit}
          className="glass-panel mt-8 space-y-6 rounded-3xl border bg-card p-6 shadow-card sm:p-8"
        >
          <section className="space-y-4" aria-labelledby="onboarding-about">
            <h2 id="onboarding-about" className="onboarding-section-title">
              <span>
                <BookOpen aria-hidden className="size-4" />
              </span>{" "}
              01 · Seu ponto de partida
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ob-name">Como quer ser chamado?</Label>
                <Input
                  id="ob-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-course">Curso</Label>
                <CourseSelect id="ob-course" value={course} onChange={setCourse} />
              </div>
            </div>
          </section>
          <section className="space-y-4" aria-labelledby="onboarding-goal">
            <h2 id="onboarding-goal" className="onboarding-section-title">
              <span>
                <Target aria-hidden className="size-4" />
              </span>{" "}
              02 · Aonde você quer chegar?
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="ob-obj">Objetivo principal</Label>
              <Textarea
                id="ob-obj"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                maxLength={300}
                placeholder="Ex.: Entender programação e me preparar para a próxima prova"
                required
              />
            </div>
          </section>
          <section className="space-y-4" aria-labelledby="onboarding-time">
            <h2 id="onboarding-time" className="onboarding-section-title">
              <span>
                <Clock3 aria-hidden className="size-4" />
              </span>{" "}
              03 · Um tempo que funciona para você
            </h2>
            <p className="text-sm text-muted-foreground">
              Comece com uma rotina possível. Você pode ajustar esses horários depois.
            </p>
            <AvailabilityEditor value={avail} onChange={setAvail} />
            <p className="text-sm text-muted-foreground">
              Total semanal: <strong className="text-foreground">{formatMinutes(total)}</strong>
            </p>
          </section>
          <div className="border-t pt-6">
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={busy || loading}
            >
              {(busy || loading) && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {loading ? "Carregando perfil…" : "Ir para o painel"}
              {!busy && !loading && <ArrowRight className="size-4" aria-hidden />}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tudo pronto para começar. Suas preferências podem mudar com você.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
