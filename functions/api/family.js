// Семья: список доверенных почт. Ведёт только владелец игры (OWNER_EMAIL).
// GET    /api/family — список: [{ email, joined }].
// POST   /api/family { email } — добавить почту (если её нет) и выдать ссылку-приглашение.
//        Ссылка работает 7 дней и один раз; для нового устройства — снова POST.
// DELETE /api/family?email= — убрать почту и удалить всё, что с ней связано: сессии, профили детей, фото.
import { json, readJson, validEmail, randomToken, sha256, currentParent, ownerEmail } from "../../lib/auth.js";

const INVITE_TTL = 7 * 24 * 3600 * 1000;
const MAX_FAMILY = 30;

async function owner(env, request) {
  const p = await currentParent(env, request);
  return p && p.owner ? p : null;
}

export async function onRequestGet({ request, env }) {
  if (!(await owner(env, request))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare(
    "SELECT f.email, p.id AS pid FROM family f LEFT JOIN parents p ON p.email = f.email ORDER BY f.added_at"
  ).all();
  return json(results.map((r) => ({ email: r.email, joined: !!r.pid })));
}

export async function onRequestPost({ request, env }) {
  if (!(await owner(env, request))) return json({ error: "forbidden" }, 403);
  const body = await readJson(request);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!validEmail(email) || email === ownerEmail(env)) return json({ error: "bad_email" }, 400);
  const now = Date.now();
  const known = await env.DB.prepare("SELECT 1 AS ok FROM family WHERE email = ?").bind(email).first();
  if (!known) {
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM family").first();
    if (n >= MAX_FAMILY) return json({ error: "too_many" }, 400);
    await env.DB.prepare("INSERT INTO family (email, added_at) VALUES (?, ?)").bind(email, now).run();
  }
  const token = randomToken();
  await env.DB.prepare("INSERT INTO login_tokens (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), email, now, now + INVITE_TTL).run();
  // Токен в #-части адреса: она не уходит на сервер и не попадает в логи.
  return json({ email, link: `${new URL(request.url).origin}/#login=${token}` });
}

export async function onRequestDelete({ request, env }) {
  if (!(await owner(env, request))) return json({ error: "forbidden" }, 403);
  const email = String(new URL(request.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!email || email === ownerEmail(env)) return json({ error: "bad_email" }, 400);
  const p = await env.DB.prepare("SELECT id FROM parents WHERE email = ?").bind(email).first();
  const rows = [
    env.DB.prepare("DELETE FROM login_tokens WHERE email = ?").bind(email),
    env.DB.prepare("DELETE FROM family WHERE email = ?").bind(email),
  ];
  // Фото и профили удаляем явно, не полагаясь на каскад.
  if (p) rows.unshift(
    env.DB.prepare("DELETE FROM portraits WHERE kid_id IN (SELECT id FROM kids WHERE parent_id = ?)").bind(p.id),
    env.DB.prepare("DELETE FROM kids WHERE parent_id = ?").bind(p.id),
    env.DB.prepare("DELETE FROM sessions WHERE parent_id = ?").bind(p.id),
    env.DB.prepare("DELETE FROM portrait_log WHERE key = ?").bind(`parent:${p.id}`),
    env.DB.prepare("DELETE FROM parents WHERE id = ?").bind(p.id),
  );
  await env.DB.batch(rows);
  return json({ ok: true });
}
