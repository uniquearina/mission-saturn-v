// POST /api/kids { callsign, progress } — новый профиль ребёнка (новый дрон).
import { json, readJson, currentParent, cleanCallsign, cleanProgress } from "../../../lib/auth.js";

const MAX_KIDS = 10;

export async function onRequestPost({ request, env }) {
  const parent = await currentParent(env, request);
  if (!parent) return json({ error: "unauthorized" }, 401);
  const body = await readJson(request);
  const callsign = cleanCallsign(body?.callsign);
  const progress = cleanProgress(body?.progress || {});
  if (!callsign || progress === null) return json({ error: "bad_request" }, 400);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM kids WHERE parent_id = ?").bind(parent.id).first();
  if (n >= MAX_KIDS) return json({ error: "too_many" }, 400);
  const now = Date.now();
  const r = await env.DB.prepare("INSERT INTO kids (parent_id, callsign, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(parent.id, callsign, progress, now, now).run();
  return json({ id: r.meta.last_row_id, callsign, progress: JSON.parse(progress) });
}
