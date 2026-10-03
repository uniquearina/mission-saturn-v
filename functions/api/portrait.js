// POST /api/portrait { photo, scene, kid? } — нарисовать ребёнка-космонавта (OpenAI). Только семье.
// GET  /api/portrait?kid=ID — картинки профиля (только для вошедшего взрослого).
// PUT  /api/portrait { kid, source, avatar?, ch1? } — перенести фото с устройства в профиль (после входа).
// DELETE /api/portrait?kid=ID — удалить фото и картинки профиля.
import { json, readJson, currentParent } from "../../lib/auth.js";

const PER_KEY_DAY = 6;      // картинок в сутки с одного устройства / аккаунта
const GLOBAL_DAY = 60;      // общий предел в сутки — бережём ключ
const DAY = 24 * 3600 * 1000;

const LIKENESS = "Keep the child's face, age and likeness exactly as in the photo. The spacesuit is sized for a child.";
const NO_TEXT = "No text, no name tags, no real logos, no flags.";
// ПИП — дрон-напарник из игры. Описание совпадает с тем, как он нарисован на поле.
const PIP = "Next to the child hovers PIP, the child's small robot drone and best friend: a compact light-grey boxy body with rounded corners, a dark visor window and a small glowing green light on the front, one horizontal arm on top with a spinning rotor at each end, and a two-finger gripper claw underneath. It is about the size of a football and looks like real 1960s NASA hardware, friendly but not cartoonish.";
const PROMPTS = {
  avatar: `Create a realistic 1969 NASA-style official astronaut portrait of the child in this photo. ${LIKENESS} White Apollo-era spacesuit, helmet held under one arm, plain blue studio backdrop, soft studio light, vintage Kodak film colors and grain, head and shoulders, square. ${PIP} PIP hovers just above the child's shoulder, fully in frame. ${NO_TEXT}`,
  ch1: `Create a realistic vintage 1969 photograph of the child in this photo as a young astronaut. ${LIKENESS} The child wears a white Apollo-era spacesuit and holds the helmet, standing on the launch pad at dawn, a huge white Saturn V rocket with black stripes and its red launch tower right behind. ${PIP} PIP hovers beside the child at head height, like a crew member posing for the photo. Florida morning sky, warm film colors and grain, full body. ${NO_TEXT}`,
};

async function kidOf(env, parent, kidId) {
  if (!parent || !kidId) return null;
  return env.DB.prepare("SELECT id FROM kids WHERE id = ? AND parent_id = ?").bind(Number(kidId), parent.id).first();
}

export async function onRequestPost({ request, env }) {
  if (!env.OPENAI_API_KEY) return json({ error: "not_configured" }, 503);
  const body = await readJson(request);
  const scene = String(body?.scene || "");
  const photo = String(body?.photo || "");
  if (!PROMPTS[scene] || !photo.startsWith("data:image/jpeg;base64,") || photo.length > 2_000_000) return json({ error: "bad_request" }, 400);

  const parent = await currentParent(env, request);
  // Только семье (вошедшим по списку доверенных почт): остальные делают «фото в шлеме» на своём устройстве.
  if (!parent) return json({ error: "unauthorized" }, 401);
  const key = `parent:${parent.id}`;
  const now = Date.now();
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM portrait_log WHERE key = ? AND created_at > ?").bind(key, now - DAY).first();
  const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM portrait_log WHERE created_at > ?").bind(now - DAY).first();
  if (mine.n >= PER_KEY_DAY || all.n >= GLOBAL_DAY) return json({ error: "too_many" }, 429);
  await env.DB.prepare("INSERT INTO portrait_log (key, created_at) VALUES (?, ?)").bind(key, now).run();

  const bytes = Uint8Array.from(atob(photo.split(",")[1]), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("model", env.IMAGE_MODEL || "gpt-image-2");
  form.append("image[]", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg");
  form.append("prompt", PROMPTS[scene]);
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("output_format", "jpeg");
  form.append("output_compression", "75");
  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.data || !d.data[0] || !d.data[0].b64_json) {
    console.log("openai error", r.status, JSON.stringify(d.error || d).slice(0, 300));
    return json({ error: d.error && d.error.code === "moderation_blocked" ? "blocked" : "failed" }, 502);
  }
  const image = "data:image/jpeg;base64," + d.data[0].b64_json;

  // Вошедшим — сохраняем в аккаунт, чтобы картинки были видны на других устройствах.
  const kid = await kidOf(env, parent, body?.kid);
  if (kid) {
    const save = env.DB.prepare("INSERT INTO portraits (kid_id, scene, data, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(kid_id, scene) DO UPDATE SET data = excluded.data, created_at = excluded.created_at");
    await env.DB.batch([save.bind(kid.id, scene, image, now), save.bind(kid.id, "source", photo, now)]);
  }
  return json({ image });
}

export async function onRequestGet({ request, env }) {
  const parent = await currentParent(env, request);
  const kid = await kidOf(env, parent, new URL(request.url).searchParams.get("kid"));
  if (!kid) return json({});
  const { results } = await env.DB.prepare("SELECT scene, data FROM portraits WHERE kid_id = ?").bind(kid.id).all();
  return json(Object.fromEntries(results.map((r) => [r.scene, r.data])));
}

export async function onRequestPut({ request, env }) {
  const parent = await currentParent(env, request);
  const body = await readJson(request);
  const kid = await kidOf(env, parent, body?.kid);
  if (!kid) return json({ error: "not_found" }, 404);
  const ok = (v) => typeof v === "string" && v.startsWith("data:image/jpeg;base64,") && v.length < 2_000_000;
  const save = env.DB.prepare("INSERT INTO portraits (kid_id, scene, data, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(kid_id, scene) DO UPDATE SET data = excluded.data, created_at = excluded.created_at");
  const now = Date.now();
  const rows = ["source", ...Object.keys(PROMPTS)].filter((s) => ok(body[s])).map((s) => save.bind(kid.id, s, body[s], now));
  if (rows.length) await env.DB.batch(rows);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const parent = await currentParent(env, request);
  const kid = await kidOf(env, parent, new URL(request.url).searchParams.get("kid"));
  if (kid) await env.DB.prepare("DELETE FROM portraits WHERE kid_id = ?").bind(kid.id).run();
  return json({ ok: true });
}
