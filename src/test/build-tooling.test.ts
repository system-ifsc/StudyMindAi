// @vitest-environment node
import { expect, it } from "vitest";
import { transformSync } from "@esbuild-kit/core-utils";
it("mantém a transformação TypeScript usada pelas ferramentas após atualizar esbuild", () => {
  const result = transformSync("export const answer: number = 42;", "/tmp/studymind-tooling.ts");
  expect(result.code).toContain("42");
  expect(result.code).not.toContain(": number");
});
