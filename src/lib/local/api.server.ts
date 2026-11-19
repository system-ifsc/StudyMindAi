import { MAX_BACKUP_BYTES } from "@/lib/core/full-backup";
import { z } from "zod";
import { TABLES, type TableName } from "@/lib/core/types";
import { createLocalRepo } from "@/lib/repo/local.server";
import { handleLocalAuth, localSession, LocalError } from "./auth.server";
import { backendMode } from "@/lib/auth-config";
const headers = {
  "Cache-Control": "no-store",
  Vary: "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
};
async function limitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LocalError("Requisição vazia.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BACKUP_BYTES + 1000000) {
        await reader.cancel();
        throw new LocalError("Requisição grande demais.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
export async function handleLocalApi(request: Request) {
  if (backendMode() !== "local")
    return Response.json({ error: "Backend local desativado." }, { status: 404, headers });
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== (process.env["APP_ORIGIN"] || new URL(request.url).origin))
      throw new LocalError("Origem não permitida.", 403);
    const bytes = await limitedBody(request);
    const type = request.headers.get("content-type") || "";
    if (type.startsWith("multipart/form-data")) {
      const session = localSession(request);
      if (!session) throw new LocalError("Entre na sua conta.", 401);
      const parsed = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": type },
        body: bytes,
      }).formData();
      const file = parsed.get("file");
      const material = z.string().uuid().parse(parsed.get("materialId"));
      if (!(file instanceof File)) throw new LocalError("Selecione um arquivo.");
      await createLocalRepo(session.user.id).uploadMaterialFile(material, file);
      return Response.json({ data: null }, { headers });
    }
    if (!type.startsWith("application/json")) throw new LocalError("Use JSON nesta operação.");
    const body = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(new TextDecoder().decode(bytes)));
    const op = z.string().parse(body["op"]);
    if (op.startsWith("auth:")) {
      const result = await handleLocalAuth(op.slice(5), body, request);
      return Response.json(
        { data: result.data },
        {
          headers: {
            ...headers,
            ...("cookie" in result && result.cookie ? { "Set-Cookie": result.cookie } : {}),
          },
        },
      );
    }
    const session = localSession(request);
    if (!session) throw new LocalError("Entre na sua conta.", 401);
    const repo = createLocalRepo(session.user.id);
    if (op === "profile") return Response.json({ data: await repo.getProfile() }, { headers });
    if (op === "profile:update") {
      await repo.updateProfile(z.record(z.string(), z.unknown()).parse(body["patch"]));
      return Response.json({ data: null }, { headers });
    }
    if (op === "import") {
      await repo.importAll(body["backup"] as never);
      return Response.json({ data: null }, { headers });
    }
    if (op === "download")
      return new Response(await repo.downloadMaterialFile(z.string().uuid().parse(body["id"])), {
        headers,
      });
    const table = z.enum(TABLES as [TableName, ...TableName[]]).parse(body["table"]);
    const id = () => z.string().uuid().parse(body["id"]);
    let data: unknown = null;
    switch (op) {
      case "list":
        data = await repo.list(table);
        break;
      case "get":
        data = await repo.get(table, id());
        break;
      case "insert":
        await repo.insert(table, z.record(z.string(), z.unknown()).parse(body["row"]) as never);
        break;
      case "update":
        await repo.update(table, id(), z.record(z.string(), z.unknown()).parse(body["patch"]));
        break;
      case "remove":
        await repo.remove(table, id());
        break;
      case "session:record":
        await repo.recordSession(z.record(z.string(), z.unknown()).parse(body["row"]) as never);
        break;
      default:
        throw new LocalError("Operação inválida.");
    }
    return Response.json({ data }, { headers });
  } catch (error) {
    if (error instanceof LocalError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        { error: "Dados inválidos. Confira os campos e tente novamente." },
        { status: 400, headers },
      );
    if ((error as Error).message?.includes("UNIQUE constraint"))
      return Response.json({ error: "Este registro já existe." }, { status: 409, headers });
    console.error("local backend failure", (error as { code?: string }).code || "unknown");
    return Response.json(
      { error: "Não foi possível salvar os dados no servidor. Tente novamente." },
      { status: 500, headers },
    );
  }
}
