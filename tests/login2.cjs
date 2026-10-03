const { chromium } = require("playwright-core");
// Почта владельца — из OWNER_EMAIL или .dev.vars (в репозитории её нет).
const OWNER = process.env.OWNER_EMAIL || (require("fs").readFileSync(require("path").join(__dirname, "../.dev.vars"), "utf8").match(/^OWNER_EMAIL=(.+)$/m) || [])[1];
(async () => {
  const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const p = await b.newPage({ locale: "ru-RU", viewport: { width: 1366, height: 820 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8788/");
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("saturn5.progress.v1", JSON.stringify({ v: 2, name: "Миша", done: [1, 2], current: 3, onboarded: true }));
    // Фото, поставленное до входа: после входа должно перейти в профиль.
    localStorage.setItem("saturn5.portrait.local", JSON.stringify({ source: "data:image/jpeg;base64,c3Jj", avatar: "data:image/jpeg;base64,YXZh" }));
  });
  await p.reload(); await p.waitForTimeout(800);
  await p.evaluate(() => G.voice.setMuted(true));
  // Вход владельца (OWNER_EMAIL из wrangler.toml): главная → профиль → «Вход для семьи».
  await p.click("#btn-start"); await p.click("#btn-home-profile"); await p.click("#btn-pf-login");
  await p.waitForSelector("#screen-save:not([hidden])");
  await p.fill("#inp-save-email", OWNER); await p.click("#btn-save-send");
  await p.waitForSelector("#save-step-sent:not([hidden])");
  const link = await p.evaluate(() => G.devLink);
  await p.goto(link); await p.waitForTimeout(1200);
  console.log("1 after link:", await p.textContent("#boot-account"));
  console.log("1b photo moved to account:", JSON.stringify(await p.evaluate(async () => {
    const kid = G.account.kids.find((k) => k.progress.name === "Миша");
    const server = await (await fetch("api/portrait?kid=" + kid.id)).json();
    return { local: localStorage.getItem("saturn5.portrait.local"), kidLocal: !!G.portrait.get(kid.id).avatar, server: Object.keys(server) };
  })));
  await p.evaluate(() => G.voice.setMuted(true));
  await p.click("#btn-start"); await p.waitForTimeout(800);
  console.log("2 start → home directly:", await p.isVisible("#screen-home"), "| profiles screen:", await p.isVisible("#screen-profiles"), "| mission:", await p.textContent("#tb-num"));
  await p.click("#btn-continue"); await p.waitForTimeout(300);
  for (let k = 0; k < 3 && await p.isVisible("#intro"); k++) { await p.waitForFunction(() => !document.getElementById("in-next").disabled, null, { timeout: 60000 }); await p.click("#in-next"); await p.waitForTimeout(300); }
  await p.click("#btn-profile"); await p.click("#btn-pf-switch"); await p.waitForTimeout(300);
  console.log("3 switch player → list:", await p.isVisible("#screen-profiles"));
  await p.click("#btn-new-kid"); await p.fill("#inp-name", "Даша"); await p.click("#form-name button");
  await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(800); await p.evaluate(() => G.voice.setMuted(true));
  await p.click("#btn-start"); await p.waitForTimeout(800);
  console.log("4 after reload opens last kid:", (await p.textContent("#tb-kid")).trim(), "| briefing:", await p.isVisible("#briefing"));
  console.log("errors:", errs);
  await b.close();
})();
