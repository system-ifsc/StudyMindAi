import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Lock,
  Moon,
  Palette,
  Shield,
  Volume2,
  Languages,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { applyPreferences, readPreferences, savePreferences } from "@/hooks/use-preferences";
import {
  defaultPreferences,
  preferenceChanges,
  rebasePreferences,
  type Preferences,
} from "@/lib/core/preferences";

const colors = [
  ["violet", "Violeta", "oklch(0.56 0.24 293)"],
  ["rose", "Rosa", "oklch(0.57 0.23 355)"],
  ["blue", "Azul", "oklch(0.52 0.23 260)"],
  ["green", "Verde", "oklch(0.45 0.135 145)"],
  ["amber", "Âmbar", "oklch(0.53 0.14 65)"],
] as const;
const labels = {
  color: "Cor do tema",
  font: "Fonte do texto",
  shape: "Estilo",
  sound: "Som",
  vibration: "Vibração",
};
const values: Record<string, string> = {
  violet: "Violeta",
  rose: "Rosa",
  blue: "Azul",
  green: "Verde",
  amber: "Âmbar",
  manrope: "Manrope",
  arial: "Arial",
  georgia: "Georgia",
  mono: "Courier New",
  rounded: "Arredondado",
  soft: "Suave",
  crisp: "Nítido",
  true: "Ativado",
  false: "Desativado",
};
function Row({
  icon,
  title,
  detail,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  action?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="settings-icon">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
      {action ?? <ChevronRight className="size-4 text-muted-foreground" />}
    </>
  );
  return onClick ? (
    <button className="settings-row hover:bg-muted/40" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="settings-row">{content}</div>
  );
}
type SettingsSection = {
  key: string;
  title: string;
  detail: string;
  icon: ReactNode;
  content: ReactNode;
};

export function PreferencesSettings({ sections = [] }: { sections?: SettingsSection[] }) {
  const committed = useRef(defaultPreferences);
  const [saved, setSaved] = useState(defaultPreferences);
  const [draft, setDraft] = useState(defaultPreferences);
  const [savedDark, setSavedDark] = useState(false);
  const [draftDark, setDraftDark] = useState(false);
  const [page, setPage] = useState("home");
  const [review, setReview] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const prefs = readPreferences();
    committed.current = prefs;
    setSaved(prefs);
    setDraft(prefs);
    const current = document.documentElement.classList.contains("dark");
    setSavedDark(current);
    setDraftDark(current);
    setReady(true);
    const syncPreferences = () => {
      const next = readPreferences();
      const previous = committed.current;
      committed.current = next;
      setSaved(next);
      setDraft((current) => rebasePreferences(current, previous, next));
    };
    const syncTheme = () => {
      const next = document.documentElement.classList.contains("dark");
      setSavedDark(next);
      setDraftDark(next);
    };
    window.addEventListener("studymind-preferences", syncPreferences);
    window.addEventListener("studymind-theme", syncTheme);
    return () => {
      window.removeEventListener("studymind-preferences", syncPreferences);
      window.removeEventListener("studymind-theme", syncTheme);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    applyPreferences(draft);
    document.documentElement.classList.toggle("dark", draftDark);
    return () => {
      applyPreferences(readPreferences());
      try {
        const theme = localStorage.getItem("studymind-theme");
        document.documentElement.classList.toggle(
          "dark",
          theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches),
        );
      } catch {
        // Restricted browser storage must not interrupt navigation.
      }
    };
  }, [draft, draftDark, ready]);
  const changed = preferenceChanges(saved, draft);
  const count = changed.length + Number(savedDark !== draftDark);
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
  }
  function discard() {
    setDraft(saved);
    setDraftDark(savedDark);
    setReview(false);
  }
  function save() {
    try {
      savePreferences(draft, draftDark);
      setSaved(draft);
      setSavedDark(draftDark);
      setReview(false);
      toast.success("Configurações salvas");
    } catch {
      toast.error("Não foi possível salvar neste navegador.");
    }
  }
  const selectedSection = sections.find((section) => section.key === page);
  const title =
    selectedSection?.title ??
    (
      {
        home: "Do seu jeito",
        appearance: "Aparência",
        notifications: "Notificações",
        language: "Idioma",
        privacy: "Privacidade",
        security: "Segurança",
      } as Record<string, string>
    )[page];
  return (
    <section
      className="relative mx-auto max-w-2xl space-y-6 pb-4"
      aria-label="Preferências do aplicativo"
    >
      <div className="flex items-center gap-3">
        {page !== "home" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar às preferências"
            onClick={() => setPage("home")}
          >
            <ArrowLeft />
          </Button>
        )}
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {page === "home"
              ? "Ajuste a aparência e os controles do aplicativo."
              : (selectedSection?.detail ?? "Personalize sua experiência neste navegador.")}
          </p>
        </div>
      </div>
      {page === "home" && (
        <>
          <div className="settings-list">
            <Row
              icon={<Moon className="size-4" />}
              title="Modo escuro"
              detail="Um ambiente confortável para estudar"
              action={
                <Switch
                  aria-label="Modo escuro"
                  checked={draftDark}
                  onCheckedChange={setDraftDark}
                />
              }
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Personalização
            </p>
            <div className="settings-list">
              <Row
                icon={<Palette className="size-4" />}
                title="Aparência"
                detail={`${values[draft.color]} · ${values[draft.font]} · ${values[draft.shape]}`}
                onClick={() => setPage("appearance")}
              />
              <Row
                icon={<Languages className="size-4" />}
                title="Idioma"
                detail="Português do Brasil"
                onClick={() => setPage("language")}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Alertas
            </p>
            <div className="settings-list">
              <Row
                icon={<Bell className="size-4" />}
                title="Notificações"
                detail="Sons e vibração"
                onClick={() => setPage("notifications")}
              />
            </div>
          </div>
          {sections.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Conta e recursos
              </p>
              <div className="settings-list">
                {sections.map((section) => (
                  <Row
                    key={section.key}
                    icon={section.icon}
                    title={section.title}
                    detail={section.detail}
                    onClick={() => setPage(section.key)}
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Privacidade e segurança
            </p>
            <div className="settings-list">
              <Row
                icon={<Lock className="size-4" />}
                title="Privacidade"
                detail="Seus dados de estudo"
                onClick={() => setPage("privacy")}
              />
              <Row
                icon={<Shield className="size-4" />}
                title="Segurança"
                detail="Proteção da sua conta"
                onClick={() => setPage("security")}
              />
            </div>
          </div>
        </>
      )}
      {page === "appearance" && (
        <>
          <div className="rounded-xl border bg-card p-5">
            <span className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
              <Palette />
            </span>
            <h3 className="font-semibold">Seu espaço de estudo</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Veja suas preferências em tempo real.
            </p>
            <Button onClick={() => toast.info("Esta é uma prévia da aparência dos botões.")}>
              Continuar estudando
            </Button>
          </div>
          <fieldset className="min-w-0">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-widest">
              Cor do tema
            </legend>
            <div className="flex flex-wrap gap-3">
              {colors.map(([key, label, color]) => (
                <button
                  key={key}
                  aria-label={label}
                  aria-pressed={draft.color === key}
                  onClick={() => update("color", key)}
                  className="grid size-10 place-items-center rounded-full border-2 border-transparent text-white outline-offset-4 focus-visible:outline-2"
                  style={{
                    background: color,
                    outline: draft.color === key ? `2px solid ${color}` : undefined,
                  }}
                >
                  {draft.color === key && <Check className="size-5" />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-widest">
              Fonte do texto
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["manrope", '"Manrope", sans-serif'],
                  ["arial", "Arial, sans-serif"],
                  ["georgia", "Georgia, serif"],
                  ["mono", '"Courier New", monospace'],
                ] as const
              ).map(([key, family]) => (
                <Button
                  key={key}
                  variant={draft.font === key ? "default" : "outline"}
                  aria-label={values[key]}
                  aria-pressed={draft.font === key}
                  onClick={() => update("font", key)}
                  style={{ fontFamily: family }}
                >
                  {values[key]}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              O seu próximo aprendizado começa aqui.
            </p>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-widest">
              Estilo da interface
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(["rounded", "soft", "crisp"] as const).map((key, i) => (
                <button
                  key={key}
                  aria-pressed={draft.shape === key}
                  onClick={() => update("shape", key)}
                  className={`min-w-0 border px-1 py-3 ${draft.shape === key ? "border-primary bg-primary/10" : "border-border"}`}
                  style={{ borderRadius: 12 }}
                >
                  <span
                    className="mx-auto mb-2 block h-6 w-12 bg-primary"
                    style={{ borderRadius: [20, 8, 2][i] }}
                  />
                  <span className="text-xs [overflow-wrap:anywhere]">{values[key]}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {page === "notifications" && (
        <>
          <div className="settings-list">
            <Row
              icon={<Volume2 className="size-4" />}
              title="Som"
              detail="Um toque suave ao interagir"
              action={
                <Switch
                  aria-label="Som"
                  checked={draft.sound}
                  onCheckedChange={(v) => update("sound", v)}
                />
              }
            />
            <Row
              icon={<Bell className="size-4" />}
              title="Vibração"
              detail="Nos dispositivos com suporte"
              action={
                <Switch
                  aria-label="Vibração"
                  checked={draft.vibration}
                  onCheckedChange={(v) => update("vibration", v)}
                />
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Notificações push, mensagens e promoções ainda não estão disponíveis. A vibração depende
            do suporte e das permissões do dispositivo.
          </p>
        </>
      )}
      {page === "language" && (
        <div className="settings-list">
          <Row
            icon={<Languages className="size-4" />}
            title="Português"
            detail="Brasil"
            action={<Check className="size-4 text-primary" />}
          />
          <p className="p-4 text-sm text-muted-foreground">
            O aplicativo está disponível em português. Outros idiomas ainda não têm tradução
            completa.
          </p>
        </div>
      )}
      {page === "privacy" && (
        <div className="settings-list p-5 text-sm leading-relaxed">
          As preferências desta tela ficam neste navegador. Os dados de estudo são gerenciados pela
          sua conta; no modo demonstração, os dados são separados. Abra a opção Backup nas
          configurações para exportar seus registros.{" "}
          <a className="text-primary underline" href="/privacidade">
            Ler política de privacidade
          </a>
        </div>
      )}
      {page === "security" && (
        <div className="settings-list p-5 text-sm leading-relaxed">
          Não compartilhe sua senha ou seus arquivos de backup. Para trocar sua senha, use a opção
          de recuperação na tela de acesso. O backup não inclui senhas nem sessões de acesso.
        </div>
      )}
      {selectedSection?.content}
      {count > 0 && (
        <div className="sticky bottom-24 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-lg md:bottom-4">
          <span className="mr-auto text-sm font-medium">
            <span className="mr-2 text-primary">●</span>
            {count} {count === 1 ? "alteração" : "alterações"}
          </span>
          <Button variant="ghost" onClick={discard}>
            Descartar
          </Button>
          <Button onClick={() => setReview(true)}>Revisar</Button>
        </div>
      )}
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revisar alterações</DialogTitle>
            <DialogDescription>
              {count} {count === 1 ? "alteração para aplicar" : "alterações para aplicar"} neste
              navegador.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-4">
            {savedDark !== draftDark && (
              <div className="flex justify-between gap-4 text-sm">
                <dt>Modo escuro</dt>
                <dd>
                  {savedDark ? "Ativado" : "Desativado"} →{" "}
                  <span className="text-primary">{draftDark ? "Ativado" : "Desativado"}</span>
                </dd>
              </div>
            )}
            {changed.map((key) => (
              <div key={key} className="flex justify-between gap-4 text-sm">
                <dt>{labels[key]}</dt>
                <dd>
                  {values[String(saved[key])]} →{" "}
                  <span className="text-primary">{values[String(draft[key])]}</span>
                </dd>
              </div>
            ))}
          </dl>
          <Button onClick={save}>Salvar alterações</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
