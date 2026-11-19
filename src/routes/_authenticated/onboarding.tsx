import { availabilityError } from "@/lib/core/profile";
import { BackLink } from "@/components/navigation/BackLink";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
    <main className="plasma-page min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <BackLink className="mt-4" />
        <h1 className="mt-10 text-4xl font-semibold">Vamos montar sua rotina</h1>
        <p className="mt-2 text-muted-foreground">
          Três informações e o planejador já consegue trabalhar.
        </p>
        <form
          onSubmit={submit}
          className="glass-panel mt-8 space-y-6 rounded-3xl border bg-card p-6 shadow-card sm:p-8"
        >
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
          <div className="space-y-1.5">
            <Label htmlFor="ob-obj">Objetivo principal</Label>
            <Textarea
              id="ob-obj"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              maxLength={300}
              placeholder="Ex.: Passar no vestibular de dezembro"
              required
            />
          </div>
          <AvailabilityEditor value={avail} onChange={setAvail} />
          <p className="text-sm text-muted-foreground">
            Total semanal: <strong className="text-foreground">{formatMinutes(total)}</strong>
          </p>
          <Button type="submit" variant="hero" size="lg" disabled={busy || loading}>
            {(busy || loading) && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {loading ? "Carregando perfil…" : "Ir para o painel"}
          </Button>
        </form>
      </div>
    </main>
  );
}
