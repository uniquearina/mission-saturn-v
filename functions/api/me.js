// GET /api/me — кто вошёл и профили детей.
import { json, currentParent } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const parent = await currentParent(env, request);
  // Не вошёл — это обычное состояние, а не ошибка: отвечаем 200, чтобы браузер не ругался в консоли.
  if (!parent) return json({ email: null, kids: [] });
  const { results } = await env.DB.prepare("SELECT id, callsign, progress FROM kids WHERE parent_id = ? ORDER BY id")
    .bind(parent.id).all();
  return json({
    email: parent.email,
    owner: parent.owner,
    kids: results.map((k) => ({ id: k.id, callsign: k.callsign, progress: JSON.parse(k.progress || "{}") })),
  });
}
