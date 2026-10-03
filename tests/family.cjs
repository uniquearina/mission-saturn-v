// Семья по приглашению и «фото в шлеме» без сервера (localhost:8788, .dev.vars с DEV_ECHO=1).
// Владелец — OWNER_EMAIL из .dev.vars. Запуск: S=$(pwd) node family.cjs
const { chromium } = require("playwright-core");
const { execSync } = require("child_process");
const path = require("path");
const OUT = process.env.S || ".";
const URL = "http://localhost:8788/";
// Почта владельца — из OWNER_EMAIL или .dev.vars (в репозитории её нет).
const OWNER = process.env.OWNER_EMAIL || (require("fs").readFileSync(require("path").join(__dirname, "../.dev.vars"), "utf8").match(/^OWNER_EMAIL=(.+)$/m) || [])[1];
const RELATIVE = "babushka@example.com";
const STRANGER = "chuzhoy@example.com";
const ROOT = path.resolve(__dirname, "..");

let failed = 0;
const check = (name, ok, extra = "") => { console.log((ok ? "ok   " : "FAIL ") + name + (extra ? " — " + extra : "")); if (!ok) failed++; };
const sql = (q) => JSON.parse(execSync(`npx --yes wrangler@4 d1 execute saturn5 --local --json --command ${JSON.stringify(q)}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results;

async function fresh(b, progress) {
  const ctx = await b.newContext({ locale: "ru-RU", viewport: { width: 1366, height: 820 } });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(URL);
  await p.evaluate((pr) => { localStorage.clear(); if (pr) localStorage.setItem("saturn5.progress.v1", JSON.stringify(pr)); }, progress);
  await p.reload(); await p.waitForTimeout(800);
  await p.evaluate(() => G.voice.setMuted(true));
  return p;
}
const done = { v: 2, name: "Миша", done: [1, 2], current: 3, onboarded: true };

(async () => {
  sql(`DELETE FROM family; DELETE FROM login_tokens WHERE email IN ('${RELATIVE}', '${STRANGER}')`);
  const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

  // 1. Обычный игрок: почту не просим, сразу главная.
  const pub = await fresh(b, done);
  const apiCalls = [];
  pub.on("request", (r) => { if (r.url().includes("/api/portrait")) apiCalls.push(r.method() + " " + r.url()); });
  await pub.click("#btn-start"); await pub.waitForTimeout(600);
  check("старт без просьбы о почте", await pub.isVisible("#screen-home") && !(await pub.isVisible("#screen-save")));

  // 2. Фото в шлеме: выбрать → подогнать → готово. Ни одного запроса к /api/portrait.
  await pub.click("#btn-home-photo");
  await pub.setInputFiles("#photo-file", path.join(__dirname, "face-sample.jpg"));
  await pub.waitForSelector("#dlg-helmet:not([hidden])");
  const box = await pub.locator("#helmet-canvas").boundingBox();
  await pub.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pub.mouse.down(); await pub.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 20, { steps: 4 }); await pub.mouse.up();
  await pub.screenshot({ path: OUT + "/helmet-fit.png" });
  await pub.click("#helmet-ok");
  await pub.waitForSelector("#photo-send:not([hidden])");
  check("кнопка «Готово», текст про устройство", (await pub.textContent("#photo-send")).trim() === "Готово" && (await pub.textContent("#photo-consent")).includes("никуда не отправляется"));
  await pub.click("#photo-send");
  await pub.waitForFunction(() => G.portrait.get().avatar && G.portrait.get().avatar.startsWith("data:image/jpeg"), null, { timeout: 10000 });
  check("аватарка собрана на устройстве", await pub.isVisible("#home-ava-img"));
  const ch1 = await pub.evaluate(() => G.portrait.generate("ch1"));
  check("фото экспедиции собрано", !!ch1 && ch1.startsWith("data:image/jpeg"));
  await pub.screenshot({ path: OUT + "/helmet-home.png" });
  const imgs = await pub.evaluate(() => ({ avatar: G.portrait.get().avatar, ch1: G.portrait.get().ch1 }));
  require("fs").writeFileSync(OUT + "/helmet-avatar.jpg", Buffer.from(imgs.avatar.split(",")[1], "base64"));
  require("fs").writeFileSync(OUT + "/helmet-ch1.jpg", Buffer.from(imgs.ch1.split(",")[1], "base64"));
  check("ни одного запроса к /api/portrait", apiCalls.length === 0, apiCalls.join(", "));

  // 3. Чужая почта: отказ, в базе ничего.
  await pub.click("#btn-home-profile"); await pub.click("#btn-pf-login");
  await pub.waitForSelector("#screen-save:not([hidden])");
  await pub.fill("#inp-save-email", STRANGER); await pub.click("#btn-save-send");
  await pub.waitForSelector("#save-error:not([hidden])");
  check("чужой почте — «только по приглашению»", (await pub.textContent("#save-error")).includes("приглашению"));
  check("чужая почта не записана", sql(`SELECT COUNT(*) AS n FROM login_tokens WHERE email = '${STRANGER}'`)[0].n === 0);
  await pub.click("#btn-save-skip"); await pub.waitForTimeout(400);
  check("«Назад» возвращает в игру", await pub.isVisible("#screen-home"));

  // 4. Владелец входит по письму и приглашает родственника.
  const own = await fresh(b, done);
  await own.click("#btn-start"); await own.click("#btn-home-profile"); await own.click("#btn-pf-login");
  await own.fill("#inp-save-email", OWNER); await own.click("#btn-save-send");
  await own.waitForSelector("#save-step-sent:not([hidden])");
  await own.goto(await own.evaluate(() => G.devLink)); await own.waitForTimeout(1200);
  check("владелец вошёл", await own.evaluate(() => G.account.owner === true));
  await own.evaluate(() => G.voice.setMuted(true));
  await own.click("#btn-start"); await own.waitForTimeout(600);
  await own.click("#btn-home-profile"); await own.waitForTimeout(400);
  check("у владельца есть блок «Семья»", await own.isVisible("#pf-family"));
  await own.fill("#inp-family-email", "не почта"); await own.click("#btn-family-add");
  await own.waitForSelector("#family-error:not([hidden])");
  check("неверная почта — ошибка", (await own.textContent("#family-error")).includes("адрес"));
  await own.fill("#inp-family-email", RELATIVE); await own.press("#inp-family-email", "Enter");
  await own.waitForSelector("#pf-invite:not([hidden])");
  const invite = await own.inputValue("#pf-invite-link");
  check("ссылка-приглашение выдана", /#login=/.test(invite) && (await own.textContent("#pf-family-list")).includes(RELATIVE));
  check("профиль не закрылся от Enter", await own.isVisible("#dlg-profile"));
  await own.screenshot({ path: OUT + "/family-owner.png" });

  // 5. Родственник открывает приглашение.
  const rel = await fresh(b, null);
  await rel.goto(invite); await rel.waitForTimeout(1200);
  const st = await rel.evaluate(() => ({ email: G.account.email, owner: G.account.owner, mode: G.portrait.mode }));
  check("родственник вошёл по приглашению", st.email === RELATIVE && !st.owner && st.mode === "ai", JSON.stringify(st));
  await rel.goto(URL); await rel.goto(invite); await rel.waitForTimeout(1200);
  check("ссылка срабатывает один раз", (await rel.textContent("#boot-account")).includes("устарела") || (await rel.evaluate(() => G.account.email)) === RELATIVE);
  await rel.evaluate(() => G.voice.setMuted(true));
  await rel.click("#btn-start"); await rel.fill("#inp-name", "Даша"); await rel.click("#form-name button"); await rel.waitForTimeout(800);
  check("у родственника профиль ребёнка на сервере", sql(`SELECT COUNT(*) AS n FROM kids k JOIN parents p ON p.id = k.parent_id WHERE p.email = '${RELATIVE}'`)[0].n === 1);
  const relFamily = await rel.evaluate(async () => (await fetch("api/family")).status);
  check("родственнику список семьи недоступен", relFamily === 403);

  // 6. Владелец: новая ссылка и «Убрать».
  await own.click("#pf-family-list [data-act=link]");
  await own.waitForFunction((old) => document.getElementById("pf-invite-link").value !== old, invite);
  const invite2 = await own.inputValue("#pf-invite-link");
  check("«Новая ссылка» даёт другую ссылку", invite2 !== invite);
  await own.click("#pf-family-list [data-act=del]");
  await own.waitForSelector("#pf-confirm:not([hidden])");
  await own.click("#btn-pf-yes"); await own.waitForTimeout(800);
  check("почта убрана из списка", !(await own.textContent("#pf-family-list")).includes(RELATIVE));

  // 7. У родственника вход закрыт, данные удалены, старая ссылка не работает.
  await rel.reload(); await rel.waitForTimeout(1000);
  check("родственник больше не вошёл", await rel.evaluate(() => G.account.email === null));
  check("данные родственника удалены", sql(`SELECT COUNT(*) AS n FROM parents WHERE email = '${RELATIVE}'`)[0].n === 0 && sql(`SELECT COUNT(*) AS n FROM login_tokens WHERE email = '${RELATIVE}'`)[0].n === 0);
  const rel2 = await fresh(b, null);
  await rel2.goto(invite2); await rel2.waitForTimeout(1200);
  check("новая ссылка после удаления не работает", await rel2.evaluate(() => G.account.email === null));

  for (const [n, p] of [["pub", pub], ["own", own], ["rel", rel], ["rel2", rel2]]) check("нет ошибок JS: " + n, p.errs.length === 0, p.errs.join("; "));
  await b.close();
  console.log(failed ? `\n${failed} проверок не прошли` : "\nвсе проверки прошли");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
