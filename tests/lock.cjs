// Блокеров нет: в проверке систем и в инструктаже можно нажимать, не дожидаясь голоса.
const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const p = await b.newPage({ locale: "ru-RU", viewport: { width: 1366, height: 820 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8765/");
  await p.evaluate(() => localStorage.clear()); await p.reload();
  // Голос «говорит» долго — всё нажимаем, пока он не договорил.
  await p.evaluate(() => { G.voice.say = () => new Promise((r) => setTimeout(r, 8000)); G.voice.stop = () => {}; });
  await p.click("#btn-start"); await p.fill("#inp-name", "Миша"); await p.click("#form-name button");
  await p.waitForSelector("#briefing:not([hidden])");
  let cards = 0;
  while (await p.isVisible("#briefing")) { cards++; await p.click("#bf-next"); }
  console.log("briefing cards:", cards);
  await p.waitForTimeout(200);
  const bubble = () => p.textContent("#spot-text");
  console.log("step 1:", (await bubble()).slice(0, 40));
  await p.click("#tiles .tile"); await p.waitForTimeout(300);
  console.log("tile right away → step 2:", (await bubble()).startsWith("Пункт 2"));
  const ro = await p.evaluate(() => G.debug.editor.cm.getOption("readOnly"));
  console.log("editor writable during speech:", !ro);
  await p.evaluate(() => { G.debug.editor.cm.focus(); G.debug.editor.cm.execCommand("goDocEnd"); });
  await p.keyboard.press("Enter"); await p.keyboard.type("left()"); await p.waitForTimeout(300);
  console.log("typed right away → step 3:", (await bubble()).startsWith("Пункт 3"));
  await p.click("#btn-run");
  await p.waitForSelector("#intro:not([hidden])", { timeout: 20000 });
  console.log("run right away → mission 1 intro:", true);
  await p.click("#in-next"); await p.waitForTimeout(200);
  console.log("intro page 2 «Мой ход» enabled at once:", !(await p.isDisabled("#in-next")), "|", (await p.textContent("#in-next")).trim());
  await p.click("#in-next"); await p.waitForTimeout(200);
  console.log("intro closed:", !(await p.isVisible("#intro")));
  console.log("errors:", errs);
  await b.close();
})();
