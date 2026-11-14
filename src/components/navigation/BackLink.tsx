import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Explicit destinations also work when a page was opened directly. */
export function BackLink({
  to = "/",
  section,
  label = "Voltar ao início",
  className,
}: {
  to?: string;
  section?: string | undefined;
  label?: string;
  className?: string;
}) {
  return (
    <Button asChild variant="ghost" className={className}>
      <Link to={to} params={section ? { section } : {}}>
        <ArrowLeft aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
