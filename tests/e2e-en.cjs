const { chromium } = require("playwright-core");
const OUT = process.env.S;
const SOL = {
  2: "right()\ngrab()",
  3: "left()\nleft()\ndrop()",
  4: 'print("Ступень на месте")',
  5: "right(5)\ngrab()\nleft(5)\ndrop()",
  6: "right(3)\ngrab()\nleft(3)\ndrop()",
  7: "up(3)\ngrab()\nleft(4)\ndown(3)\ndrop()",
  8: "down(2)\ngrab()\ndown(1)\nleft(5)\ndrop()",
  9: 'print("Engines ready")\nprint("Radio OK")\nprint("Crew aboard")',
  10: "up(3)\nright(3)\ngrab()",
};
(async () => {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage({ locale: "en-US", viewport: { width: 1366, height: 820 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(r.status() + " " + r.url()); });
  await page.goto("http://localhost:8765/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: OUT + "/s0-boot.png" });
  await page.click("#btn-start"); await page.fill("#inp-name", "Миша"); await page.click("#form-name button");
  const t0 = Date.now();
  await page.waitForFunction(() => G.python.ready, null, { timeout: 60000 });
  console.log("pyodide ready in", Date.now() - t0, "ms");
  await page.evaluate(() => G.voice.setMuted(true));
  const radio = () => page.evaluate(() => [...document.querySelectorAll("#radio li")].map((l) => l.innerText.replace(/\s+/g, " ")).slice(-1)[0]);
  const passIntro = async (shot) => {
    await page.waitForSelector("#intro:not([hidden])", { timeout: 15000 });
    if (shot) await page.screenshot({ path: OUT + `/${shot}-1.png` });
    await page.click("#in-next");
    await page.waitForTimeout(shot ? 2500 : 200);
    if (await page.isVisible("#intro")) {   // у миссии без новой команды — один экран
      if (shot) await page.screenshot({ path: OUT + `/${shot}-2.png` });
      await page.waitForFunction(() => !document.getElementById("in-next").disabled, null, { timeout: 60000 });
      await page.click("#in-next");
    }
    await page.waitForTimeout(150);
  };
  const runAndWait = async () => {
    await page.click("#btn-run");
    await page.waitForFunction(() => !document.getElementById("btn-run").disabled, null, { timeout: 60000 });
    await page.waitForTimeout(150);
  };

  // Брифинг: 4 карточки.
  await page.waitForSelector("#briefing:not([hidden])");
  for (let i = 1; await page.isVisible("#briefing"); i++) { await page.waitForTimeout(300); await page.screenshot({ path: OUT + `/b${i}.png` }); await page.click("#bf-next"); }
  // М-00: проверка систем, как ребёнок.
  const brief = () => page.textContent("#brief-main");
  console.log("M0 step1:", await brief());
  await page.screenshot({ path: OUT + "/s00-check.png" });
  await page.screenshot({ path: OUT + "/s00-bay.png" });
  console.log("M0 step2:", await brief());
  await page.click("#scene .drone", { force: true }); await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + "/s00-tiles.png" });
  console.log("M0 step3:", await brief());
  await page.click(".tile"); await page.waitForTimeout(600);
  console.log("M0 step4:", await brief());
  await page.screenshot({ path: OUT + "/s00-keys.png" });
  await page.keyboard.press("Enter");
  await page.keyboard.type("left");
  await page.keyboard.press("Shift+Digit9");
  await page.waitForTimeout(200);
  console.log("M0 code:", JSON.stringify(await page.evaluate(() => G.debug.editor.value)), "| step5:", await brief());
  await runAndWait();
  await page.waitForFunction(() => document.getElementById("tb-num").textContent === "Mission 1 of 11", null, { timeout: 15000 });
  console.log("M0 done →", await page.textContent("#tb-num"), await brief());
  await passIntro("in1");

  // M1: печатаем по-настоящему (раскладка — системная).
  await page.click(".tile"); // вставляет print("")
  await page.keyboard.type("Houston, come in");
  await page.evaluate(() => G.debug.editor.set('print("Houston, come in")'));
  console.log("M1 code:", JSON.stringify(await page.evaluate(() => G.debug.editor.value)));
  await runAndWait();
  console.log("M1:", await page.isVisible("#dlg-success"), "|", await radio());
  await page.screenshot({ path: OUT + "/s1-success.png" });
  await page.click("#btn-next");
  await passIntro("in2");

  // M2: ошибка «две команды в одной строке».
  await page.evaluate(() => G.debug.editor.set("right()right()\ngrab()"));
  await runAndWait();
  console.log("M2 one line:", await radio());
  // M2: сначала с ошибкой, потом правильно.
  await page.evaluate(() => G.debug.editor.set("rigth()\nright()\ngrab()"));
  await runAndWait();
  console.log("M2 typo:", await radio());
  await page.evaluate(() => G.debug.editor.set("right(\ngrab()"));
  await runAndWait();
  console.log("M2 paren:", await radio());
  await page.evaluate(() => G.debug.editor.set("grab()"));
  await runAndWait();
  console.log("M2 grab empty:", await radio());
  await page.evaluate(() => G.debug.editor.set("right\nright()\ngrab()"));
  await runAndWait();
  console.log("M2 no parens:", await radio());
  await page.evaluate(() => G.debug.editor.set("while True:\n    pass"));
  await runAndWait();
  console.log("M2 loop:", await radio());

  for (const id of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    if (id !== 2) await page.click("#btn-next").catch(() => {});
    if (await page.isVisible("#dlg-shift")) { console.log("shift dialog after", id - 1); await page.screenshot({ path: OUT + "/s-shift.png" }); await page.click("#btn-shift-more"); }
    if (id !== 2) await passIntro(id === 10 ? "in10" : null);
    if (id === 6) { await runAndWait(); console.log("M6 broken:", await radio()); }
    if (id === 5) { await page.evaluate(() => G.debug.editor.set("right()\nright()\nright()\nright()\nright()\ngrab()")); await runAndWait(); console.log("M5 too long:", await radio(), "|", await page.textContent("#mem")); }
    if (id === 8) {
      await page.evaluate(() => G.debug.editor.set("down(2)\ngrab()\nleft(5)\ndrop()"));
      await runAndWait(); console.log("M8 girder:", await radio());
    }
    if (id === 4) {
      // Забыл кавычки — понятная подсказка.
      for (const c of ["print(Stage)", "print(Stage is in place)"]) { await page.evaluate((x) => G.debug.editor.set(x), c); await runAndWait(); console.log("M4 no quotes:", await radio()); }
      // По-настоящему: рамка между скобками → одна кавычка (вторую ставит игра) → текст.
      await page.evaluate(() => G.debug.editor.set("print()\n", { line: 0, ch: 6 }));
      await page.evaluate(() => G.debug.editor.focus());
      await page.keyboard.type('"');
      await page.keyboard.type("Stage is in place");
      console.log("M4 typed:", JSON.stringify(await page.evaluate(() => G.debug.editor.value)));
    } else if (id === 9) {
      // Первый доклад уже есть, два — плиткой.
      await page.evaluate(() => G.debug.editor.set('print("Engines ready")\n', { line: 1, ch: 0 }));
      await page.click(".tile"); await page.keyboard.type("Radio on");
      await page.click(".tile"); await page.keyboard.type("Crew ready");
      console.log("M9 typed:", JSON.stringify(await page.evaluate(() => G.debug.editor.value)));
    } else await page.evaluate((c) => G.debug.editor.set(c), SOL[id]);
    await runAndWait();
    console.log(`M${id}:`, await page.isVisible("#dlg-success"), "|", await radio());
    if (id === 10) await page.screenshot({ path: OUT + "/s10-success.png" });
    if (id === 9) { const t = await page.evaluate(() => [...document.querySelectorAll("#radio li")].map((l) => l.innerText).join(" | ")); console.log("M9 radio:", t.replace(/\s+/g, " ")); }
  }
  await page.click("#btn-next");
  if (await page.isVisible("#dlg-shift")) { console.log("shift dialog again"); await page.click("#btn-shift-more"); }
  // Перед финалом главы — «Фото экипажа» (фото в шлеме работает и без сервера).
  await page.waitForSelector("#dlg-crew:not([hidden])", { timeout: 5000 });
  await page.screenshot({ path: OUT + "/crew.png" });
  await page.click("#crew-skip");
  await passIntro("in8");
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/s8-start.png" });
  await page.evaluate(() => G.debug.editor.set('for i in range("10", 0, -1):\n    print(i)\nlaunch()\n'));
  await page.click("#btn-run"); await page.waitForTimeout(400);
  console.log("M11 quotes:", await page.evaluate(() => [...document.querySelectorAll("#radio li")].pop().innerText.replace(/\s+/g, " ")));
  await page.evaluate(() => { G.debug.editor.set("for i in range(, 0, -1):\n    print(i)\nlaunch()\n", { line: 0, ch: 15 }); G.debug.editor.focus(); });
  await page.keyboard.type("10");
  console.log("M8 code:", JSON.stringify(await page.evaluate(() => G.debug.editor.value)));
  await page.click("#btn-run");
  await page.waitForSelector("#launch:not([hidden])", { timeout: 60000 });
  await page.waitForTimeout(4000);
  console.log("launch video playing:", await page.evaluate(() => { const v = document.getElementById("launch-video"); return !v.hidden && !v.paused && v.currentTime > 0; }), "| music:", await page.evaluate(() => G.sound.playing));
  await page.screenshot({ path: OUT + "/s8-launch.png" });
  await page.waitForSelector("#dlg-patch:not([hidden])", { timeout: 60000 });
  await page.screenshot({ path: OUT + "/s8-patch.png" });
  await page.click("#btn-patch-ok");
  await page.waitForSelector("#screen-home:not([hidden])", { timeout: 5000 });
  const home = await page.evaluate(() => ({
    cont: document.getElementById("btn-continue").textContent,
    next: document.getElementById("home-next").textContent,
    chapters: document.querySelectorAll("#chapters li").length,
    locked: document.querySelectorAll("#chapters .is-locked").length,
    ch1done: !!document.querySelector("#chapters .chapter.is-done"),
    medals: document.querySelectorAll("#medals .medal.is-got").length,
    call: document.getElementById("home-call").textContent,
    music: G.sound.playing,
  }));
  console.log("home after patch:", JSON.stringify(home));
  await page.screenshot({ path: OUT + "/s9-home.png", fullPage: true });
  await page.click("#btn-home-journal");
  await page.waitForTimeout(300);
  console.log("journal status:", await page.textContent("#journal-status"));
  await page.screenshot({ path: OUT + "/s9-journal.png", fullPage: true });
  console.log("errors:", errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
