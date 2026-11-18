import { BackLink } from "@/components/navigation/BackLink";
import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — StudyMind AI" },
      { name: "description", content: "Como a StudyMind trata seus dados de estudo." },
      { property: "og:title", content: "Privacidade — StudyMind AI" },
      { property: "og:description", content: "Como a StudyMind trata seus dados de estudo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Logo />
      <BackLink className="mt-4" />
      <h1 className="mt-10 text-4xl font-semibold">Privacidade</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          Seus registros (perfil, disciplinas, atividades, sessões, cartões, metas, materiais e
          respostas) ficam no banco da StudyMind e cada linha é protegida por regras de acesso: só a
          sua conta consegue ler, criar, alterar ou excluir.
        </p>
        <p>
          No modo local, contas e arquivos ficam no servidor que executa a aplicação. Ao executar no
          seu computador, os dados permanecem nele. A sessão usa um cookie privado; a senha é
          armazenada como hash. Guarde o código de recuperação entregue no cadastro.
        </p>
        <p>
          O modo demonstração usa apenas dados fictícios guardados na memória do navegador; nada é
          enviado ao servidor e tudo some ao recarregar.
        </p>
        <p>
          O assistente envia ao serviço de IA somente a pergunta e, se você escolher, o texto do
          material selecionado. As chaves ficam no servidor.
        </p>
        <p>
          Em Configurações, o backup JSON inclui os dados básicos de estudo. Contas, senhas,
          conversas, simulados completos e arquivos originais não fazem parte desse arquivo.
        </p>
      </div>
    </main>
  ),
});
