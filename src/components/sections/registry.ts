import { lazy, type ComponentType } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ListChecks,
  CalendarDays,
  Cpu,
  Timer,
  Layers,
  Target,
  BarChart3,
  Brain,
  FolderOpen,
  Sparkles,
  Settings as SettingsIcon,
} from "lucide-react";
const Overview = lazy(() => import("./Overview").then((m) => ({ default: m.Overview })));
const Subjects = lazy(() => import("./Subjects").then((m) => ({ default: m.Subjects })));
const Tasks = lazy(() => import("./Tasks").then((m) => ({ default: m.Tasks })));
const Calendar = lazy(() => import("./Calendar").then((m) => ({ default: m.Calendar })));
const Planner = lazy(() => import("./Planner").then((m) => ({ default: m.Planner })));
const Focus = lazy(() => import("./Focus").then((m) => ({ default: m.Focus })));
const Flashcards = lazy(() => import("./Flashcards").then((m) => ({ default: m.Flashcards })));
const Goals = lazy(() => import("./Goals").then((m) => ({ default: m.Goals })));
const Performance = lazy(() => import("./Performance").then((m) => ({ default: m.Performance })));
const Exercises = lazy(() => import("./Exercises").then((m) => ({ default: m.Exercises })));
const Materials = lazy(() => import("./Materials").then((m) => ({ default: m.Materials })));
const Assistant = lazy(() => import("./Assistant").then((m) => ({ default: m.Assistant })));
const Settings = lazy(() => import("./Settings").then((m) => ({ default: m.Settings })));

export interface SectionProps {
  go: (section: string) => void;
}
export interface Section {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: "Estudo" | "Prática" | "Conta";
  Component: ComponentType<SectionProps>;
}

export const SECTIONS: Section[] = [
  { key: "painel", label: "Painel", icon: LayoutDashboard, group: "Estudo", Component: Overview },
  {
    key: "disciplinas",
    label: "Disciplinas",
    icon: BookOpen,
    group: "Estudo",
    Component: Subjects,
  },
  { key: "atividades", label: "Atividades", icon: ListChecks, group: "Estudo", Component: Tasks },
  {
    key: "calendario",
    label: "Calendário",
    icon: CalendarDays,
    group: "Estudo",
    Component: Calendar,
  },
  { key: "planejador", label: "Planejamento", icon: Cpu, group: "Estudo", Component: Planner },
  { key: "foco", label: "Foco", icon: Timer, group: "Estudo", Component: Focus },
  { key: "flashcards", label: "Flashcards", icon: Layers, group: "Prática", Component: Flashcards },
  { key: "exercicios", label: "Exercícios", icon: Brain, group: "Prática", Component: Exercises },
  {
    key: "materiais",
    label: "Materiais",
    icon: FolderOpen,
    group: "Prática",
    Component: Materials,
  },
  {
    key: "assistente",
    label: "Assistente IA",
    icon: Sparkles,
    group: "Prática",
    Component: Assistant,
  },
  { key: "metas", label: "Metas", icon: Target, group: "Conta", Component: Goals },
  {
    key: "desempenho",
    label: "Desempenho",
    icon: BarChart3,
    group: "Conta",
    Component: Performance,
  },
  {
    key: "configuracoes",
    label: "Configurações",
    icon: SettingsIcon,
    group: "Conta",
    Component: Settings,
  },
];
export const findSection = (k: string) => SECTIONS.find((s) => s.key === k);
