import { useTable } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

export function SourcePreview({
  materialId,
  title,
  excerpt,
}: {
  materialId: string;
  title: string;
  excerpt?: string | undefined;
}) {
  const materials = useTable("materials");
  const material = materials.data?.find((m) => m.id === materialId);
  const index = excerpt && material ? material.content.indexOf(excerpt) : -1;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="link" className="h-auto max-w-full whitespace-normal text-left">
          Abrir fonte: {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{material?.name ?? title}</DialogTitle>
          <DialogDescription>
            {index >= 0
              ? "Citação literal localizada no material atual. Confira também o contexto; isso não certifica toda a resposta da IA."
              : "Material fornecido como contexto. Não foi localizada uma citação literal verificável nesta resposta."}
          </DialogDescription>
        </DialogHeader>
        {materials.isLoading ? (
          <p>Carregando material…</p>
        ) : !material ? (
          <p role="status">O material foi excluído ou não está disponível nesta conta.</p>
        ) : index >= 0 && excerpt ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {material.content.slice(Math.max(0, index - 500), index)}
            <mark className="rounded bg-primary/15 text-foreground">{excerpt}</mark>
            {material.content.slice(index + excerpt.length, index + excerpt.length + 500)}
          </div>
        ) : (
          <div className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
            {material.content}
          </div>
        )}
        {materials.error && (
          <p role="alert">
            Não foi possível carregar a fonte.{" "}
            <button onClick={() => void materials.refetch()} className="underline">
              Tentar novamente
            </button>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
