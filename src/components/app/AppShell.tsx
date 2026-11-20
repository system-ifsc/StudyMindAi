import { useReveal } from "@/hooks/use-reveal";
import { BackLink } from "@/components/navigation/BackLink";
import { TutorialProvider } from "./WelcomeTutorial";
import { Suspense, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loading } from "./ui";
import {
  LogOut,
  Moon,
  Sun,
  FlaskConical,
  Home,
  CalendarDays,
  Timer,
  Layers,
  Grid2X2,
} from "lucide-react";
import { auth } from "@/lib/auth/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { useTheme } from "@/hooks/use-theme";
import { useProfile } from "@/hooks/use-data";
import { SECTIONS, findSection } from "@/components/sections/registry";

type Mode = "real" | "demo";

function MobileNavigation({ mode, current }: { mode: Mode; current: string }) {
  const { setOpenMobile, openMobile } = useSidebar();
  const tabs = [
    { key: "painel", label: "Início", icon: Home },
    { key: "planejador", label: "Meu plano", icon: CalendarDays },
    { key: "foco", label: "Foco", icon: Timer },
    { key: "flashcards", label: "Revisar", icon: Layers },
  ];
  const selected = ["atividades", "calendario"].includes(current) ? "planejador" : current;
  return (
    <nav aria-label="Navegação principal" className="mobile-dock md:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={mode === "demo" ? "/demo/$section" : "/app/$section"}
          params={{ section: tab.key }}
          aria-current={selected === tab.key ? "page" : undefined}
          className="dock-item"
          data-tour={tab.key}
        >
          <span className="dock-icon">
            <tab.icon className="size-5" aria-hidden />
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
      <button
        type="button"
        className="dock-item"
        onClick={() => setOpenMobile(true)}
        data-tour="more"
        aria-label="Mais opções"
        aria-expanded={openMobile}
        data-active={!tabs.some((tab) => tab.key === selected) || undefined}
      >
        <span className="dock-icon">
          <Grid2X2 className="size-5" aria-hidden />
        </span>
        <span>Mais</span>
      </button>
    </nav>
  );
}

function Nav({ mode, current }: { mode: Mode; current: string }) {
  const { setOpenMobile } = useSidebar();
  const groups = ["Estudo", "Prática", "Conta"] as const;
  return (
    <>
      {groups.map((g) => (
        <SidebarGroup key={g}>
          <SidebarGroupLabel>{g}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS.filter(
                (s) => s.group === g && !["atividades", "calendario"].includes(s.key),
              ).map((s) => (
                <SidebarMenuItem key={s.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      current === s.key ||
                      (s.key === "planejador" && ["atividades", "calendario"].includes(current))
                    }
                    tooltip={s.label}
                  >
                    <Link
                      to={mode === "demo" ? "/demo/$section" : "/app/$section"}
                      data-tour={s.key}
                      params={{ section: s.key }}
                      onClick={() => setOpenMobile(false)}
                      aria-current={current === s.key ? "page" : undefined}
                    >
                      <s.icon className="size-4" />
                      <span>{s.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function AppShellContent({ mode, section }: { mode: Mode; section: string }) {
  const [tutorialActive, setTutorialActive] = useState(false);
  const revealRef = useReveal(section);
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const { setOpenMobile } = useSidebar();
  const profile = useProfile();
  const sec = findSection(section) ?? SECTIONS[0]!;
  const go = (key: string) =>
    navigate({
      to: mode === "demo" ? "/demo/$section" : "/app/$section",
      params: { section: key },
    });
  const name = profile.data?.display_name || "Estudante";

  return (
    <TutorialProvider
      mode={mode}
      section={section}
      revealSection={go}
      setMobileMenu={setOpenMobile}
      onActiveChange={setTutorialActive}
    >
      <div className="study-app flex min-h-svh w-full min-w-0">
        <Sidebar collapsible="icon" className="border-r-0" modal={!tutorialActive}>
          <SidebarHeader className="p-4 pb-3">
            <Logo to={mode === "demo" ? "/" : "/app/painel"} />
            <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60 md:hidden">
              Mais recursos
            </p>
          </SidebarHeader>
          <SidebarContent>
            <Nav mode={mode} current={sec.key} />
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent p-2 group-data-[collapsible=icon]:hidden">
              <span
                className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-primary-foreground"
                aria-hidden
              >
                {name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {mode === "demo" ? "Demonstração" : profile.data?.course || "Espaço pessoal"}
                </p>
              </div>
              {mode === "real" && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Sair"
                  onClick={async () => {
                    await auth.signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="size-4" />
                </Button>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0 bg-transparent">
          {mode === "demo" && (
            <div
              role="note"
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand px-4 py-2 text-center text-sm text-primary-foreground"
            >
              <FlaskConical className="size-4" aria-hidden /> <strong>Modo demonstração</strong> —
              dados fictícios, nada é salvo e tudo some ao recarregar.
              <Link to="/cadastro" className="underline underline-offset-2">
                Criar conta real
              </Link>
            </div>
          )}
          <header className="app-topbar sticky top-0 z-10 flex h-20 items-center gap-3 px-5 sm:px-6">
            <SidebarTrigger aria-label="Abrir ou recolher menu" />
            <nav aria-label="Trilha" className="min-w-0 flex-1 truncate text-sm">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Seu espaço de estudo
              </span>
              <span className="mt-0.5 block text-base font-bold text-foreground">
                {sec.key === "painel" ? "StudyMind" : sec.label}
              </span>
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggle}
                aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              <Link
                to={mode === "demo" ? "/demo/$section" : "/app/$section"}
                params={{ section: "configuracoes" }}
                data-tour="configuracoes"
                aria-label="Meu perfil"
                className="profile-avatar"
              >
                {name.slice(0, 1).toUpperCase()}
              </Link>
            </div>
          </header>
          <div
            className="app-content mx-auto w-full min-w-0 max-w-7xl flex-1 p-5 sm:p-6 lg:p-10"
            id="conteudo"
            ref={revealRef}
          >
            {sec.key !== "painel" && (
              <div className="mb-4">
                <BackLink
                  to={mode === "demo" ? "/demo/$section" : "/app/$section"}
                  section="painel"
                  label="Voltar ao painel"
                />
              </div>
            )}
            {["planejador", "atividades", "calendario"].includes(sec.key) && (
              <nav aria-label="Planejamento integrado" className="mb-6 flex flex-wrap gap-2">
                {[
                  ["planejador", "Plano de estudos"],
                  ["atividades", "Atividades"],
                  ["calendario", "Calendário"],
                ].map(([key, label]) => (
                  <Link
                    key={key}
                    to={mode === "demo" ? "/demo/$section" : "/app/$section"}
                    data-tour={key}
                    params={{ section: key! }}
                    aria-current={sec.key === key ? "page" : undefined}
                    className={`rounded-xl border px-4 py-2 text-sm ${sec.key === key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            <div key={sec.key} className="section-transition">
              <Suspense fallback={<Loading />}>
                <sec.Component go={go} />
              </Suspense>
            </div>
          </div>
        </SidebarInset>
        <MobileNavigation mode={mode} current={sec.key} />
      </div>
    </TutorialProvider>
  );
}

export function AppShell({ mode, section }: { mode: Mode; section: string }) {
  return (
    <SidebarProvider>
      <AppShellContent mode={mode} section={section} />
    </SidebarProvider>
  );
}
