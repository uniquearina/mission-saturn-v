// POST /api/login { email } — прислать на почту ссылку для входа.
// Письмо — только владельцу игры. Семья входит по ссылке-приглашению (functions/api/family.js),
// а чужие почты не записываем никуда.
import { json, readJson, validEmail, randomToken, sha256, ownerEmail } from "../../lib/auth.js";

const TOKEN_TTL = 20 * 60 * 1000;   // ссылка живёт 20 минут
const PER_HOUR = 5;                 // не больше 5 писем в час на одну почту

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!validEmail(email)) return json({ error: "bad_email" }, 400);
  if (email !== ownerEmail(env)) return json({ error: "family_only" }, 403);

  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at > ?")
    .bind(email, now - 3600 * 1000).first();
  if (recent.n >= PER_HOUR) return json({ error: "too_many" }, 429);

  const token = randomToken();
  await env.DB.prepare("INSERT INTO login_tokens (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), email, now, now + TOKEN_TTL).run();

  // Токен в #-части адреса: она не уходит на сервер и не попадает в логи.
  const link = `${new URL(request.url).origin}/#login=${token}`;

  // Только для локальной разработки (.dev.vars): ссылка возвращается в ответе вместо письма.
  if (env.DEV_ECHO === "1") return json({ ok: true, devLink: link });
  if (!env.RESEND_API_KEY) return json({ error: "mail_not_configured" }, 503);

  const ru = body?.lang !== "en";
  const T = ru ? {
    subject: "Вход в «Миссию Сатурн-5»",
    intro: "Чтобы войти в «Миссию Сатурн-5», открой письмо <b>на устройстве, где играет ребёнок</b>, и нажми кнопку:",
    introText: "Чтобы войти в «Миссию Сатурн-5», открой ссылку на устройстве, где играет ребёнок:",
    button: "Войти в игру",
    note: "Ссылка работает 20 минут и один раз. Если ты не просил вход, просто удали это письмо.",
    from: "Миссия Сатурн-5",
  } : {
    subject: "Sign in to Mission Saturn V",
    intro: "To sign in to Mission Saturn V, open this email <b>on the device your child plays on</b> and tap the button:",
    introText: "To sign in to Mission Saturn V, open this link on the device your child plays on:",
    button: "Enter the game",
    note: "The link works for 20 minutes, once. If you didn't ask to sign in, just delete this email.",
    from: "Mission Saturn V",
  };
  const text = `${T.introText}\n\n${link}\n\n${T.note}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1b1206">
<p>${T.intro}</p>
<p><a href="${link}" style="display:inline-block;background:#f2a541;color:#1b1206;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${T.button}</a></p>
<p style="color:#666;font-size:14px">${T.note}</p></div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || `${T.from} <onboarding@resend.dev>`,
      to: [email],
      subject: T.subject,
      text, html,
    }),
  });
  if (!r.ok) {
    console.log("resend error", r.status, await r.text());
    return json({ error: "mail_failed" }, 502);
  }
  return json({ ok: true });
}
