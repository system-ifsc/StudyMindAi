import type React from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 text-eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-ifsc-red" aria-hidden />
          StudyMind
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "glass-panel surface-lift min-w-0 break-words rounded-2xl border bg-card p-5 shadow-card sm:p-6",
        className,
      )}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-surface/50 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
        <Inbox className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <AlertTriangle className="mt-0.5 size-4 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-destructive">Não foi possível carregar.</p>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function ConfirmDelete({
  what,
  onConfirm,
  label = "Excluir",
}: {
  what: string;
  onConfirm: () => void;
  label?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${label} ${what}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{what}”?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function Spin() {
  return <Loader2 className="size-4 animate-spin" aria-hidden />;
}
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="surface-lift relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-brand" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
export const SUBJECT_COLORS: Record<string, string> = {
  indigo: "bg-chart-1",
  violet: "bg-chart-2",
  teal: "bg-chart-3",
  amber: "bg-chart-4",
  rose: "bg-chart-5",
};
export function Dot({ color }: { color?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        SUBJECT_COLORS[color ?? ""] ?? "bg-muted-foreground",
      )}
      aria-hidden
    />
  );
}
export const PRIORITY_LABEL = { 1: "Baixa", 2: "Média", 3: "Alta" } as const;

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "glass-control h-11 min-w-0 w-full rounded-xl md:h-10 border border-input bg-background/60 px-3 text-sm shadow-sm transition-all focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
        props.className,
      )}
    />
  );
}
