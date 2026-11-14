import { BackLink } from "@/components/navigation/BackLink";
import { Suspense } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loading } from "./ui";
import { LogOut, Moon, Sun, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <SidebarMenuItem key={s.key}>
                  <SidebarMenuButton asChild isActive={current === s.key} tooltip={s.label}>
                    <Link
                      to={mode === "demo" ? "/demo/$section" : "/app/$section"}
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

export function AppShell({ mode, section }: { mode: Mode; section: string }) {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const profile = useProfile();
  const sec = findSection(section) ?? SECTIONS[0]!;
  const go = (key: string) =>
    navigate({
      to: mode === "demo" ? "/demo/$section" : "/app/$section",
      params: { section: key },
    });
  const name = profile.data?.display_name || "Estudante";

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full min-w-0">
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="p-4 pb-3">
            <Logo to={mode === "demo" ? "/" : "/app/painel"} />
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
                    await supabase.auth.signOut();
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
          <header className="glass-chrome sticky top-0 z-10 flex h-16 items-center gap-2 border-b px-4 shadow-soft backdrop-blur-xl sm:px-6">
            <SidebarTrigger aria-label="Abrir ou recolher menu" />
            <nav
              aria-label="Trilha"
              className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
            >
              {mode === "demo" ? "Demonstração" : "Meu espaço"} /{" "}
              <span className="text-foreground">{sec.label}</span>
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
            </div>
          </header>
          <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 sm:p-6 lg:p-10" id="conteudo">
            <div className="mb-4">
              <BackLink
                to={
                  sec.key === "painel" ? "/" : mode === "demo" ? "/demo/$section" : "/app/$section"
                }
                section={sec.key === "painel" ? undefined : "painel"}
                label={sec.key === "painel" ? "Voltar ao início" : "Voltar ao painel"}
              />
            </div>
            <Suspense key={sec.key} fallback={<Loading />}>
              <sec.Component go={go} />
            </Suspense>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
