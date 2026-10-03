// PUT /api/kids/:id { progress?, callsign? } — сохранить прогресс. DELETE — удалить профиль.
import { json, readJson, currentParent, cleanCallsign, cleanProgress } from "../../../lib/auth.js";

export async function onRequestPut({ request, env, params }) {
  const parent = await currentParent(env, request);
  if (!parent) return json({ error: "unauthorized" }, 401);
  const body = await readJson(request);
  const progress = body?.progress !== undefined ? cleanProgress(body.progress) : undefined;
  const callsign = body?.callsign !== undefined ? cleanCallsign(body.callsign) : undefined;
  if (progress === null || callsign === null) return json({ error: "bad_request" }, 400);
  const r = await env.DB.prepare(
    "UPDATE kids SET progress = COALESCE(?, progress), callsign = COALESCE(?, callsign), updated_at = ? WHERE id = ? AND parent_id = ?"
  ).bind(progress ?? null, callsign ?? null, Date.now(), Number(params.id), parent.id).run();
  if (!r.meta.changes) return json({ error: "not_found" }, 404);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const parent = await currentParent(env, request);
  if (!parent) return json({ error: "unauthorized" }, 401);
  const id = Number(params.id);
  const kid = await env.DB.prepare("SELECT id FROM kids WHERE id = ? AND parent_id = ?").bind(id, parent.id).first();
  if (!kid) return json({ ok: true });
  // Фото удаляем явно, не полагаясь на каскад: удалённый профиль не должен оставлять картинок.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM portraits WHERE kid_id = ?").bind(id),
    env.DB.prepare("DELETE FROM kids WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}
