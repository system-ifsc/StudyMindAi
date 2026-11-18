import { backendMode } from "@/lib/auth-config";
import { createCloudRepo } from "./cloud";
import { createLocalHttpRepo } from "./local";
export const createRepo = (userId: string) =>
  backendMode() === "local" ? createLocalHttpRepo() : createCloudRepo(userId);
