import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn("flex items-center gap-2.5 rounded-lg", className)}
      aria-label="StudyMind AI — início"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-primary-foreground shadow-card">
        <Brain className="size-5" aria-hidden />
      </span>
      <span className="font-display text-lg font-semibold leading-none">
        StudyMind <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}
