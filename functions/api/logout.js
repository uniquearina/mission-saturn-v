// POST /api/logout — закрыть сессию на этом компьютере.
import { json, sessionHash, clearCookie } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  const h = await sessionHash(request);
  if (h) await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(h).run();
  return json({ ok: true }, 200, { "set-cookie": clearCookie() });
}
