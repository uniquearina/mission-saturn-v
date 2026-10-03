// Общие помощники для серверных функций: ответы, токены, сессии.

export const SESSION_COOKIE = "s5sid";
const YEAR = 365 * 24 * 3600 * 1000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const validEmail = (e) => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Тело запроса — только JSON: обычная HTML-форма с чужого сайта так не отправит.
export async function readJson(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return null;
  try { return await request.json(); } catch { return null; }
}

function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function sessionCookie(sid) {
  return `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${YEAR / 1000}`;
}
export const clearCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function createSession(env, parentId) {
  const sid = randomToken();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (id_hash, parent_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(sid), parentId, now, now + YEAR).run();
  return sid;
}

// Владелец игры (OWNER_EMAIL в wrangler.toml): входит по письму и ведёт список семьи.
export const ownerEmail = (env) => String(env.OWNER_EMAIL || "").trim().toLowerCase();

// Доверенная почта: владелец или есть в списке семьи. Остальным вход закрыт.
export async function isTrusted(env, email) {
  if (!email) return false;
  if (email === ownerEmail(env)) return true;
  return !!(await env.DB.prepare("SELECT 1 AS ok FROM family WHERE email = ?").bind(email).first());
}

// Кто вошёл: { id, email, owner } или null.
// Почту убрали из семьи — её сессии больше не действуют.
export async function currentParent(env, request) {
  const sid = getCookie(request, SESSION_COOKIE);
  if (!sid) return null;
  const row = await env.DB.prepare(
    "SELECT p.id, p.email, f.email AS fam FROM sessions s JOIN parents p ON p.id = s.parent_id LEFT JOIN family f ON f.email = p.email WHERE s.id_hash = ? AND s.expires_at > ?"
  ).bind(await sha256(sid), Date.now()).first();
  if (!row) return null;
  const owner = row.email === ownerEmail(env);
  if (!owner && !row.fam) return null;
  return { id: row.id, email: row.email, owner };
}

export async function sessionHash(request) {
  const sid = getCookie(request, SESSION_COOKIE);
  return sid ? sha256(sid) : null;
}

// Прогресс ребёнка: небольшой объект, не больше 10 КБ.
export function cleanProgress(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const s = JSON.stringify(p);
  return s.length <= 10000 ? s : null;
}

export const cleanCallsign = (c) => {
  const v = String(c || "").trim().slice(0, 16);   // подпись профиля — имя ребёнка (раньше позывной дрона)
  return v || null;
};
