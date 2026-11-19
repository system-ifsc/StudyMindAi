import {
  randomBytes,
  randomUUID,
  scrypt,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { localDatabase, transaction } from "./database.server";

const derive = promisify(scrypt);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const COOKIE = "studymind_session";
const TTL = 7 * 86400000;
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});
const publicUser = (row: User) => ({
  id: row.id,
  email: row.email,
  user_metadata: { name: row.name },
});
type User = {
  id: string;
  email: string;
  name: string;
  password: string;
  recovery: string;
  profile: string;
};
export class LocalError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
async function matches(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const key = (await derive(password, salt, 64)) as Buffer;
  const stored = Buffer.from(expected, "hex");
  return stored.length === key.length && timingSafeEqual(stored, key);
}
function signingKey() {
  const db = localDatabase();
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('signing_key',?)").run(
    randomBytes(32).toString("hex"),
  );
  return (
    db.prepare("SELECT value FROM settings WHERE key='signing_key'").get() as { value: string }
  ).value;
}
function accessToken(sessionId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sessionId, expires: Date.now() + 15 * 60000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", signingKey()).update(payload).digest("base64url")}`;
}
export function verifyLocalBearer(token: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", signingKey()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sessionId: string;
      expires: number;
    };
    if (!Number.isFinite(body.expires) || body.expires < Date.now()) return null;
    return sessionById(body.sessionId);
  } catch {
    return null;
  }
}
function sessionById(id: string) {
  const db = localDatabase();
  const session = db
    .prepare("SELECT owner FROM sessions WHERE id=? AND expires>?")
    .get(id, Date.now()) as { owner: string } | undefined;
  if (!session) return null;
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(session.owner) as User | undefined;
  return user ? { user: publicUser(user), access_token: accessToken(id) } : null;
}
export function cookieSessionId(request: Request) {
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return raw ? hash(raw) : null;
}
export function localSession(request: Request) {
  const id = cookieSessionId(request);
  return id ? sessionById(id) : null;
}
function sessionCookie(raw: string, request: Request, maxAge = TTL / 1000) {
  return `${COOKIE}=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(process.env["APP_ORIGIN"] || request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function newSession(user: User, request: Request) {
  const db = localDatabase();
  const raw = randomBytes(32).toString("base64url");
  const id = hash(raw);
  db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
  db.prepare("INSERT INTO sessions(id,owner,expires) VALUES(?,?,?)").run(
    id,
    user.id,
    Date.now() + TTL,
  );
  return {
    data: {
      user: publicUser(user),
      session: { user: publicUser(user), access_token: accessToken(id) },
    },
    cookie: sessionCookie(raw, request),
  };
}
function limit(email: string) {
  const db = localDatabase();
  const now = Date.now();
  const key = hash(email);
  transaction(() => {
    db.prepare("DELETE FROM attempts WHERE at<?").run(now - 15 * 60000);
    const total = (db.prepare("SELECT count(*) AS n FROM attempts").get() as { n: number }).n;
    const own = (
      db.prepare("SELECT count(*) AS n FROM attempts WHERE key=?").get(key) as { n: number }
    ).n;
    if (total >= 200 || own >= 15)
      throw new LocalError("Muitas tentativas. Aguarde 15 minutos.", 429);
    db.prepare("INSERT INTO attempts(key,at) VALUES(?,?)").run(key, now);
  });
}
export async function handleLocalAuth(
  action: string,
  body: Record<string, unknown>,
  request: Request,
) {
  const db = localDatabase();
  if (action === "session") return { data: { session: localSession(request) } };
  if (action === "logout") {
    db.prepare("DELETE FROM sessions WHERE id=?").run(cookieSessionId(request) ?? "");
    return { data: {}, cookie: sessionCookie("", request, 0) };
  }
  if (action === "signup" || action === "login") {
    const parsed = credentials.parse(body);
    limit(parsed.email);
    let user = db.prepare("SELECT * FROM users WHERE email=?").get(parsed.email) as
      User | undefined;
    if (action === "signup") {
      if (user) throw new LocalError("Este e-mail já tem conta. Faça login.", 409);
      const name = z.string().trim().min(1).max(80).parse(body["name"]);
      const encoded = await passwordHash(parsed.password);
      const recovery = randomBytes(24).toString("hex");
      const id = randomUUID();
      const profile = {
        id,
        display_name: name,
        course: "",
        objective: "",
        weekly_hours: 8,
        availability: [60, 60, 60, 60, 60, 0, 0],
        onboarded: false,
      };
      try {
        // Keep account creation and session creation in one transaction. If the
        // database is briefly locked or the session write fails, we must not
        // leave an account behind while showing a failed signup to the user.
        return transaction(() => {
          db.prepare(
            "INSERT INTO users(id,email,name,password,recovery,profile) VALUES(?,?,?,?,?,?)",
          ).run(id, parsed.email, name, encoded, hash(recovery), JSON.stringify(profile));
          user = db.prepare("SELECT * FROM users WHERE id=?").get(id) as User;
          const result = newSession(user, request);
          return { ...result, data: { ...result.data, recovery_code: recovery } };
        });
      } catch (error) {
        if ((error as Error).message.includes("UNIQUE constraint"))
          throw new LocalError("Este e-mail já tem conta. Faça login.", 409);
        throw error;
      }
    }
    // Always derive a key, including unknown addresses, to reduce timing differences.
    const valid = await matches(
      parsed.password,
      user?.password ?? "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!user || !valid) throw new LocalError("E-mail ou senha incorretos.", 401);
    return newSession(user, request);
  }
  if (action === "recover") {
    const parsed = credentials.extend({ code: z.string().trim().min(1).max(128) }).parse(body);
    limit(parsed.email);
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(parsed.email) as
      User | undefined;
    const actual = Buffer.from(hash(parsed.code), "hex");
    const expected = Buffer.from(user?.recovery ?? "00".repeat(32), "hex");
    if (!user || !timingSafeEqual(actual, expected))
      throw new LocalError("E-mail ou código de recuperação inválido.", 401);
    const encoded = await passwordHash(parsed.password);
    const replacement = randomBytes(24).toString("hex");
    transaction(() => {
      // A concurrent recovery can use the code only once.
      const result = db
        .prepare("UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=?")
        .run(encoded, hash(replacement), user.id, user.recovery);
      if (!result.changes) throw new LocalError("Código já utilizado.", 409);
      db.prepare("DELETE FROM sessions WHERE owner=?").run(user.id);
    });
    return { data: { recovery_code: replacement }, cookie: sessionCookie("", request, 0) };
  }
  throw new LocalError("Operação de autenticação inválida.");
}
