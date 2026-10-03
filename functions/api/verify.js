// POST /api/verify { token } — проверить ссылку из письма и открыть сессию на год.
import { json, readJson, sha256, createSession, sessionCookie, isTrusted } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const token = String(body?.token || "");
  if (!token) return json({ error: "expired" }, 400);
  const h = await sha256(token);
  const now = Date.now();
  // Ссылка срабатывает один раз: помечаем использованной атомарно.
  const res = await env.DB.prepare("UPDATE login_tokens SET used = 1 WHERE token_hash = ? AND used = 0 AND expires_at > ?")
    .bind(h, now).run();
  if (!res.meta.changes) return json({ error: "expired" }, 400);
  const { email } = await env.DB.prepare("SELECT email FROM login_tokens WHERE token_hash = ?").bind(h).first();
  // Приглашение выдали, а почту потом убрали из семьи — ссылка уже не действует.
  if (!(await isTrusted(env, email))) return json({ error: "expired" }, 400);
  await env.DB.prepare("INSERT INTO parents (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING").bind(email, now).run();
  const parent = await env.DB.prepare("SELECT id FROM parents WHERE email = ?").bind(email).first();
  const sid = await createSession(env, parent.id);
  return json({ ok: true, email }, 200, { "set-cookie": sessionCookie(sid) });
}
