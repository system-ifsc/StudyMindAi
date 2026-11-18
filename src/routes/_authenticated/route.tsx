import { isAuthConfigured } from "@/lib/auth-config";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/auth/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!isAuthConfigured()) throw redirect({ to: "/login" });
    const { data, error } = await auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
