import { createMiddleware } from "@tanstack/react-start";
import { auth } from "./client";
export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await auth.getSession();
  return next({
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
  });
});
