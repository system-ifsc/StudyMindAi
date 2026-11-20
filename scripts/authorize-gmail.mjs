import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

// Run locally; secrets are written directly to the Git-ignored .env, never stdout.
const file = process.argv[2];
if (!file) throw new Error("Informe o caminho do JSON OAuth de aplicativo para computador.");
const { installed: client } = JSON.parse(await readFile(file, "utf8"));
if (!client?.client_id || !client?.client_secret)
  throw new Error("Use credenciais OAuth do tipo Aplicativo para computador.");
const prompt = createInterface({ input: process.stdin, output: process.stdout });
const sender =
  (
    await prompt.question("Conta Gmail que enviará os feedbacks [system.ifsc@gmail.com]: ")
  ).trim() || "system.ifsc@gmail.com";
prompt.close();
if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender))
  throw new Error("Endereço de e-mail inválido.");
const state = randomBytes(32).toString("hex");
const verifier = randomBytes(48).toString("base64url");
const server = createServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const redirect = `http://127.0.0.1:${server.address().port}/oauth/callback`;
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: redirect,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/gmail.send",
  access_type: "offline",
  prompt: "consent",
  state,
  login_hint: sender,
  code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  code_challenge_method: "S256",
}).toString();
console.log(
  `Abra esta URL no navegador e autorize a conta ${sender}:\n${url}\nAguardando autorização por até 10 minutos. Nenhum e-mail será enviado.`,
);
try {
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Autorização expirou. Execute novamente.")),
      600000,
    );
    server.on("request", (req, res) => {
      const callback = new URL(req.url, redirect);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (callback.pathname !== "/oauth/callback") {
        res.writeHead(404).end();
        return;
      }
      const received = Buffer.from(callback.searchParams.get("state") ?? "");
      if (received.length !== state.length || !timingSafeEqual(received, Buffer.from(state))) {
        res.writeHead(400).end("Autorização inválida.");
        return;
      }
      clearTimeout(timer);
      if (callback.searchParams.has("error") || !callback.searchParams.get("code")) {
        res.writeHead(400).end("Autorização não concluída. Execute novamente.");
        reject(new Error("A conta não autorizou o envio."));
        return;
      }
      res.end("Autorização recebida. Volte ao terminal para conferir a configuração.");
      resolve(callback.searchParams.get("code"));
    });
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      code,
      code_verifier: verifier,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok)
    throw new Error("Google recusou a autorização. Confira as credenciais e tente novamente.");
  const token = await response.json();
  if (!token.refresh_token)
    throw new Error(
      "Google não retornou autorização permanente. Revogue o acesso e autorize novamente.",
    );
  if (!token.scope?.split(" ").includes("https://www.googleapis.com/auth/gmail.send"))
    throw new Error("Permissão gmail.send não concedida.");
  let env = "";
  try {
    env = await readFile(".env", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const values = {
    GMAIL_CLIENT_ID: client.client_id,
    GMAIL_CLIENT_SECRET: client.client_secret,
    GMAIL_REFRESH_TOKEN: token.refresh_token,
    GMAIL_SENDER: sender,
  };
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Za-z0-9@._/+\-=]+$/.test(value)) throw new Error("Formato de credencial inesperado.");
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "gm");
    env = pattern.test(env) ? env.replace(pattern, () => line) : `${env.trimEnd()}\n${line}\n`;
  }
  await writeFile(".env", env, { mode: 0o600 });
  await chmod(".env", 0o600);
  console.log("Gmail configurado no .env privado. Reinicie o servidor. Nenhum e-mail foi enviado.");
} finally {
  server.close();
}
