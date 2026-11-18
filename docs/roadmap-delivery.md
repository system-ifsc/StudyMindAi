# Estado da arquitetura independente

A instalação atual usa SQLite local por padrão, Supabase opcional, Vite/TanStack/Nitro padrão e provedor de IA configurável no servidor. Consulte [o guia de instalação](../README.md).

## Entregue

- Cadastro/login por e-mail, retorno de confirmação, reenvio, recuperação de senha e Google opcional.
- Perfil criado automaticamente ao registrar um usuário; onboarding e dados por conta.
- Migrações de todas as tabelas usadas pela interface, referências por proprietário e RLS.
- Materiais no Storage privado, conversas, questionários, tentativas, feedback e cotas distribuídas.
- Importação V1 aditiva/transacional com IDs remapeados e perfil atualizado.
- Build Node e instalação repetível com checksums.

## Configuração externa necessária

O modo local cria o banco automaticamente, com recuperação por código. Supabase, SMTP e redirects só são necessários ao optar pelo backend Supabase. Google e IA exigem provedores próprios. A entrega do código não cria esses serviços nem transfere contas ou arquivos do backend anterior.

## Pendências de produto

Backup integral de conversas, simulados e binários; sincronização do timer entre dispositivos; operação offline completa; monitoramento e restauração de desastre. Nenhum desses recursos é simulado pela interface.
