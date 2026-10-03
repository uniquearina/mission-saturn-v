// Главный сценарий: экраны, запуск программы, подсказки, прогресс, смена.
(function () {
  const G = window.G;
  const { MISSIONS, TILES, CHAPTERS, MEDALS } = G.levels;
  const L = G.L;
  const $ = (id) => document.getElementById(id);
  const STORE = "saturn5.progress.v1";

  // ───────── Прогресс: в браузере, а после входа по почте — ещё и в профиле ребёнка ─────────
  const FRESH = () => ({ v: 2, name: "", done: [], current: 1, patch: false, onboarded: false });
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  }
  // С миссии «Вторая ступень» появляются числа в скобках и счётчик памяти.
  const NUM_FROM = MISSIONS.find((m) => m.places === "S-II").id;
  // Прогресс из версии с 8 миссиями переводим на новую нумерацию.
  function migrate(p) {
    if (p.v === 2) return p;
    const map = G.levels.OLD_TO_NEW;
    p.done = (p.done || []).map((id) => map[id] || id);
    if (p.current) p.current = map[p.current] || p.current;
    p.v = 2;
    return p;
  }
  const progress = migrate(Object.assign(FRESH(), loadProgress()));
  if (progress.done.length) progress.onboarded = true;
  const CHECK = G.levels.SYSTEMS_CHECK;
  // Дрона у всех зовут ПИП: на корпусе — заглавными, во фразах — «Пип» (так голос не читает по буквам).
  G.callsign = L("ПИП", "PIP");
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* без сохранения */ }
    G.account.save(progress);
  }
  // Переключиться на профиль ребёнка из аккаунта.
  function useKid(kid) {
    for (const k of Object.keys(progress)) delete progress[k];
    Object.assign(progress, FRESH(), kid.progress || {});
    if (!progress.name) progress.name = kid.callsign;   // в аккаунте профиль подписан именем ребёнка
    migrate(progress);
    if (progress.done.length) progress.onboarded = true;
    G.account.activeKid = kid.id;
    try { localStorage.setItem(LAST_KID, String(kid.id)); } catch { /* без сохранения */ }
    // С сервера — картинки с других устройств. Фото с этого устройства переносим только по кнопке «Перенести».
    G.portrait.sync().then(renderAvatar);
    session.completed = 0; session.nextBreak = 5;
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* без сохранения */ }
  }

  const session = { completed: 0, nextBreak: 5, startedAt: 0, tilesHeard: new Set() };
  let mission = null, editor = null, scene = null, hintLevel = 0, running = false;

  const name = () => L("Пип", "Pip");
  const kidName = () => progress.name || L("оператор", "operator");
  // {name} — имя дрона, {kid} — имя ребёнка.
  const fill = (s) => String(s).replace(/\{name\}/g, name()).replace(/\{kid\}/g, kidName());
  const isDone = (id) => progress.done.includes(id);
  const isOpen = (id) => id === 1 || isDone(id - 1) || isDone(id);

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
  }

  // ───────── Радиообмен ─────────
  const ROLE_TAG = L({ cup: "ЦУП", bort: "БОРТ", err: "БОРТ", you: "ТЫ" }, { cup: "HOUSTON", bort: "ONBOARD", err: "ONBOARD", you: "YOU" });
  function radio(role, text) {
    const li = document.createElement("li");
    li.className = "radio-" + role;
    li.innerHTML = `<span class="r-tag">${ROLE_TAG[role]}</span><span class="r-text"></span>`;
    li.querySelector(".r-text").textContent = text;
    const list = $("radio");
    list.appendChild(li);
    while (list.children.length > 3) list.firstElementChild.remove();
  }
  // Только голос: для того, что уже написано на экране крупно.
  // Голос всегда читает ровно то, что написано на экране (английские слова — по-русски).
  const sayText = (text) => G.errors.sayable(fill(text));
  function speak(text) { return G.voice.say(sayText(text), "cup"); }
  function cup(text) { radio("cup", fill(text)); return speak(text); }
  function bortError(m) { G.sound.fx("error"); radio("err", m.text); return G.voice.say(G.errors.sayable(m.text), "bort"); }
  // Что озвучивать для задания и для образца — то, что видно на экране.
  const briefText = (m) => [m.brief.text, m.brief.code, m.brief.note].filter(Boolean).join(" ");
  const exampleText = (ex) => ex.steps
    ? [ex.title + ".", ...ex.steps.map((st) => st.text)].join(" ")
    : [ex.title + ".", (G.touch && ex.captionTouch) || ex.caption].join(" ");

  // ───────── Загрузка ─────────
  const FUEL = L(["ЗАПРАВКА · ГОРЮЧЕЕ RP-1", "ЗАПРАВКА · ЖИДКИЙ КИСЛОРОД", "ЗАПРАВКА · ЖИДКИЙ ВОДОРОД", "ПРОВЕРКА СИСТЕМ"],
    ["FUELING · RP-1 KEROSENE", "FUELING · LIQUID OXYGEN", "FUELING · LIQUID HYDROGEN", "SYSTEMS CHECK"]);
  let fuel = 0, pyFailed = false;
  const fuelTimer = setInterval(() => {
    if (G.python.ready) fuel = 100; else fuel = Math.min(92, fuel + (92 - fuel) * 0.06 + 0.3);
    $("fuel-fill").style.width = fuel + "%";
    $("fuel-pct").textContent = Math.round(fuel) + "%";
    $("fuel-stage").textContent = pyFailed ? (location.protocol === "file:" ? L("ЗАПУСТИ ФАЙЛ «ЗАПУСТИТЬ ИГРУ»", "OPEN THE GAME WITH ITS LAUNCHER FILE") : L("СБОЙ ЗАГРУЗКИ PYTHON · ОБНОВИ СТРАНИЦУ", "PYTHON FAILED TO LOAD · RELOAD THE PAGE")) : FUEL[Math.min(3, Math.floor(fuel / 25))];
    if (fuel >= 100) clearInterval(fuelTimer);
  }, 120);

  // На стартовом экране — чертёж ракеты: все детали ещё пунктиром.
  G.world.renderRocketPanel($("boot-rocket"), [], null, { ref: false });

  const pyReady = G.python.load(new URL("vendor/pyodide/", location.href).href)
    .catch((e) => { pyFailed = true; console.error(e); throw e; });

  // ───────── Вход для семьи: по ссылке-приглашению, владелец — по письму ─────────
  let loginNotice = "", deviceProgress = null;
  async function handleLoginLink() {
    const m = location.hash.match(/^#login=([\w-]+)/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    const r = await G.account.verify(m[1]);
    if (!r.ok) { loginNotice = L("Ссылка устарела или уже использована. Попросите новую ссылку-приглашение.", "The link has expired or was already used. Ask for a new invitation link."); return; }
    loginNotice = L("Вход выполнен.", "Signed in.");
  }
  // Прогресс с этого устройства сам в аккаунт не переносим (так однажды чужой профиль попал к родственнику):
  // на экране «Кто играет?» для него есть отдельная кнопка «Перенести». Прогресс с устройства — это то,
  // что сохранено в браузере, если здесь ещё не играл никто из этого аккаунта.
  function findDeviceProgress() {
    let last = null;
    try { last = Number(localStorage.getItem(LAST_KID)); } catch { /* без сохранения */ }
    deviceProgress = G.account.email && progress.name && !G.account.kids.some((k) => k.id === last) ? { ...progress } : null;
  }
  function renderAccount() {
    for (const id of ["boot-account", "profiles-account"]) {
      const el = $(id);
      el.hidden = !G.account.available;
      if (!G.account.available) continue;
      el.innerHTML = "";
      if (loginNotice) {
        const n = document.createElement("span");
        n.className = "acc-notice";
        n.textContent = loginNotice + " ";
        el.appendChild(n);
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "link-btn";
      if (G.account.email) {
        el.append(L(`Вход: ${G.account.email} · `, `Signed in: ${G.account.email} · `));
        b.textContent = L("Выйти", "Sign out");
        b.addEventListener("click", async () => {
          await G.account.logout();
          loginNotice = "";
          renderAccount();
          show("screen-boot");
        });
      } else {
        // Без входа: предложение сохранить прогресс показывается отдельным экраном после «Начать смену».
        el.hidden = !loginNotice;
        continue;
      }
      el.appendChild(b);
    }
  }
  const accountReady = G.account.init().then(handleLoginLink).then(findDeviceProgress).then(() => {
    if (G.account.email) G.portrait.prune(G.account.kids.map((k) => k.id));
  }).then(renderAccount);
  // Ссылка из письма открыта в этой же вкладке: страница не перезагружается, ловим смену адреса.
  addEventListener("hashchange", async () => {
    if (!/^#login=/.test(location.hash)) return;
    await handleLoginLink();
    findDeviceProgress();
    renderAccount();
    ["dlg-photo", "dlg-profile"].forEach(close);   // окно «Письмо отправлено» больше не нужно
    show("screen-boot");
  });

  const LOGIN_ERRORS = {
    bad_email: L("Проверь адрес почты.", "Check the email address."),
    too_many: L("Слишком много писем за час. Попробуй позже.", "Too many emails this hour. Try again later."),
    family_only: L("Вход только по приглашению. Попросите ссылку-приглашение у того, кто вас пригласил.", "Sign-in is by invitation only. Ask the person who invited you for an invitation link."),
    mail_failed: L("Письмо не отправилось. Попробуйте позже.", "The email wasn't sent. Try again later."),
    mail_not_configured: L("Отправка писем ещё не настроена.", "Email sending isn't set up yet."),
  };



  // ───────── Фото космонавта: в шлеме на устройстве; для семьи — портрет от OpenAI ─────────
  const isLocal = () => G.portrait.mode === "local";
  const pendingText = () => isLocal()
    ? L("Собираем фото…", "Making the photo…")
    : L("Рисуем портрет в скафандре — около минуты…", "Drawing the spacesuit portrait — about a minute…");
  const consentText = () => isLocal()
    ? L("Для взрослых: фото остаётся на этом устройстве и никуда не отправляется.", "For grown-ups: the photo stays on this device and isn't sent anywhere.")
    : L("Для взрослых: фото отправится в OpenAI, чтобы нарисовать картинку. Картинки хранятся только на этом устройстве или в вашем аккаунте.", "For grown-ups: the photo goes to OpenAI to draw the picture. The pictures are kept only on this device or in your account.");
  // Что показать после выбора фото: для шлема — готовую аватарку, для OpenAI — само фото.
  const previewOf = (src) => (isLocal() ? G.helmet.avatar(src) : Promise.resolve(src));
  const crewCaption = () => L(`Экспедиция 1 · ${kidName()} и Пип у Сатурна-5`, `Expedition 1 · ${kidName()} and Pip by Saturn V`);

  const avatarCaption = () => L(`${kidName()} и Пип`, `${kidName()} and Pip`);

  // Нажал на портрет или фото экспедиции — открыть во весь экран.
  function openViewer(img) {
    $("viewer-img").src = img.src;
    $("viewer-img").alt = img.alt;
    $("viewer-cap").textContent = img.alt;
    open("dlg-viewer");
    $("dlg-viewer").querySelector(".viewer-close").focus();
  }
  document.addEventListener("click", (e) => {
    const img = e.target.closest && e.target.closest("img.zoomable");
    if (img && img.src) { e.preventDefault(); openViewer(img); return; }
    if (e.target.id === "dlg-viewer" || e.target.id === "viewer-img") close("dlg-viewer");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches && e.target.matches("img.zoomable")) openViewer(e.target);
    if (e.key === "Escape") close("dlg-viewer");
  });

  function renderAvatar() {
    const av = G.portrait.available && G.portrait.get().avatar;
    $("tb-avatar").hidden = !av;
    if (av) $("tb-avatar").src = av;
    $("btn-profile").querySelector("svg").style.display = av ? "none" : "";
  }

  function renderPatchPhoto() {
    const fig = $("patch-photo");
    const ph = G.portrait.available ? G.portrait.get() : {};
    if (ph.ch1) {
      fig.hidden = false;
      fig.classList.remove("is-pending");
      $("patch-photo-img").hidden = false;
      $("patch-photo-img").src = ph.ch1;
      $("patch-photo-img").alt = crewCaption();
      $("patch-photo-cap").textContent = crewCaption();
    } else if (G.portrait.isPending("ch1")) {
      fig.hidden = false;
      fig.classList.add("is-pending");
      $("patch-photo-img").hidden = true;
      $("patch-photo-cap").textContent = L("Фото экспедиции печатается…", "The expedition photo is printing…");
    } else fig.hidden = true;
  }

  // Портрет не нарисовался: объяснить почему и дать попробовать снова.
  const PORTRAIT_ERRORS = {
    too_many: L("Сегодня портретов уже много. Попробуйте завтра.", "Too many portraits today. Try again tomorrow."),
    blocked: L("OpenAI не стал рисовать по этому фото. Попробуйте другое фото.", "OpenAI wouldn't draw from this photo. Try another photo."),
    failed: L("Портрет не получился. Попробуйте ещё раз.", "The portrait didn't work out. Try again."),
  };
  // Фото есть, портрета нет и он не рисуется — нужна кнопка «Нарисовать портрет».
  function needRedraw() {
    if (!G.portrait.available) return false;
    const ph = G.portrait.get();
    return !!ph.source && !ph.avatar && !G.portrait.isPending("avatar");
  }
  function redraw() {
    G.portrait.generate("avatar");
    if (progress.patch && !G.portrait.get().ch1) G.portrait.generate("ch1");
  }
  $("pf-photo-redraw").addEventListener("click", redraw);
  $("btn-home-redraw").addEventListener("click", redraw);

  function renderProfilePhoto() {
    const box = $("pf-photo");
    box.hidden = !G.portrait.available;
    if (!G.portrait.available) return;
    const ph = G.portrait.get();
    const pend = G.portrait.isPending("avatar");
    $("pf-avatar").hidden = !ph.avatar;
    if (ph.avatar) { $("pf-avatar").src = ph.avatar; $("pf-avatar").alt = avatarCaption(); }
    $("pf-photo-del").hidden = !ph.source;
    $("pf-photo-redraw").hidden = !needRedraw();
    $("pf-photo-pick-text").textContent = ph.source ? L("Заменить фото", "Replace photo") : L("Добавить фото", "Add photo");
    const err = G.portrait.errorOf("avatar");
    $("pf-photo-note").textContent = pend
      ? pendingText()
      : needRedraw()
        ? (err ? PORTRAIT_ERRORS[err] || PORTRAIT_ERRORS.failed : L("Фото есть, а портрета пока нет.", "There's a photo, but no portrait yet."))
      : ph.source
        ? L("После каждой главы — новое фото в журнале.", "After every chapter — a new photo in the log.")
        : isLocal()
          ? L("По желанию. С фото будет аватарка: ты в шлеме, а рядом Пип. Фото остаётся на этом устройстве.",
            "Optional. With a photo you get an avatar: you in a helmet with Pip. The photo stays on this device.")
          : L("По желанию. С фото после каждой главы в журнале будет картинка, где ты космонавт, а рядом Пип. Фото отправится в OpenAI, чтобы её нарисовать.",
            "Optional. With a photo, after every chapter the log gets a picture of you as an astronaut with Pip. The photo goes to OpenAI to draw it.");
  }

  G.portrait.onUpdate = () => {
    renderAvatar();
    if (!$("dlg-profile").hidden) renderProfilePhoto();
    if (!$("dlg-patch").hidden) renderPatchPhoto();
    if (!$("screen-home").hidden) renderHome();
  };

  // Новое фото → портрет для аватарки и, если глава уже пройдена или идёт её финал, — фото экспедиции.
  function startPortraits() {
    G.portrait.generate("avatar");
    if (progress.patch || (mission && mission.allowLaunch)) G.portrait.generate("ch1");
  }

  let crewPhoto = null;
  function openCrew() {
    crewPhoto = null;
    $("crew-preview").hidden = $("crew-consent").hidden = $("crew-send").hidden = true;
    $("crew-consent").textContent = consentText();
    $("crew-send").textContent = isLocal() ? L("Готово", "Done") : L("Отправить", "Send");
    $("crew-pick-text").textContent = L("Сделать фото", "Take a photo");
    $("crew-pick").classList.replace("btn-ghost", "btn-go");
    open("dlg-crew");
    speak(L("Перед стартом экипаж фотографируется у ракеты. Хочешь, в журнале будет твоё фото с Пипом — в скафандре у Сатурна-5? Попроси взрослого помочь.",
      "Before launch, the crew takes a photo by the rocket. Want a photo of you and Pip in the log — in a spacesuit by Saturn V? Ask a grown-up to help."));
  }
  function closeCrew() {
    progress.portraitAsked = true;
    save();
    close("dlg-crew");
    G.voice.stop();
    openIntro(0);
  }
  $("crew-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    crewPhoto = await G.portrait.choose(f);
    if (!crewPhoto) return;
    $("crew-img").src = await previewOf(crewPhoto);
    $("crew-preview").hidden = $("crew-consent").hidden = $("crew-send").hidden = false;
    $("crew-pick-text").textContent = L("Другое фото", "Another photo");
    $("crew-pick").classList.replace("btn-go", "btn-ghost");
  });
  $("crew-send").addEventListener("click", () => {
    if (!crewPhoto) return;
    G.portrait.setSource(crewPhoto);
    startPortraits();
    closeCrew();
  });
  $("crew-skip").addEventListener("click", closeCrew);

  $("pf-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const src = await G.portrait.choose(f);
    if (!src) return;
    G.portrait.setSource(src);
    startPortraits();
  });
  $("pf-photo-del").addEventListener("click", () => G.portrait.remove());

  // ───────── Профиль ребёнка ─────────
  let pfAction = null;
  function openProfile() {
    $("inp-pf-name").value = progress.name || "";
    $("pf-progress").textContent = L(`Пройдено миссий: ${progress.done.length} из ${MISSIONS.length}`, `Missions done: ${progress.done.length} of ${MISSIONS.length}`);
    $("btn-pf-switch").hidden = !G.account.email;
    // Почта взрослого: кто вошёл, и кнопка «Выйти»; без входа — предложение сохранить прогресс.
    $("pf-account").hidden = !G.account.available;
    $("pf-email").parentElement.hidden = !G.account.email;
    $("pf-email").textContent = G.account.email || "";
    $("pf-noemail").hidden = !!G.account.email;
    $("pf-family").hidden = !G.account.owner;
    $("pf-invite").hidden = $("family-error").hidden = true;
    if (G.account.owner) renderFamily();
    renderProfilePhoto();
    $("pf-main").hidden = false;
    $("pf-confirm").hidden = true;
    open("dlg-profile");
  }
  $("btn-profile").addEventListener("click", () => { if (!running) openProfile(); });

  $("form-profile").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = $("inp-pf-name").value.trim().slice(0, 16);
    if (!n) return;
    progress.name = n;
    save();
    $("tb-kid").textContent = n;
    close("dlg-profile");
    if (mission) { scene.load(mission); updateRocket(); }
    if (!$("screen-home").hidden) renderHome();
    G.voice.stop();
  });

  function askConfirm(action, text, yes) {
    pfAction = action;
    $("pf-confirm-text").textContent = text;
    $("btn-pf-yes").textContent = yes;
    $("pf-main").hidden = true;
    $("pf-confirm").hidden = false;
  }
  $("btn-pf-restart").addEventListener("click", () =>
    askConfirm("restart", L("Точно начать заново? Все пройденные миссии сбросятся. Это нельзя отменить.", "Start over? All completed missions will be reset. This can't be undone."), L("Да, начать заново", "Yes, start over")));
  $("btn-pf-delete").addEventListener("click", () =>
    askConfirm("delete", L(`Точно удалить профиль ${kidName()}? Это нельзя отменить.`, `Delete the profile of ${kidName()}? This can't be undone.`), L("Да, удалить", "Yes, delete")));
  $("btn-pf-no").addEventListener("click", () => { $("pf-confirm").hidden = true; $("pf-main").hidden = false; });
  $("btn-pf-yes").addEventListener("click", async () => {
    G.voice.stop();
    if (pfAction === "restart") {
      const keep = { name: progress.name };
      for (const k of Object.keys(progress)) delete progress[k];
      Object.assign(progress, FRESH(), keep);
      save();
      close("dlg-profile");
      enterGame();
    } else if (pfAction === "family-remove") {
      await G.account.familyRemove(familyTarget).catch(() => {});
      $("pf-confirm").hidden = true;
      $("pf-main").hidden = false;
      $("pf-invite").hidden = true;
      renderFamily();
    } else if (pfAction === "delete") {
      close("dlg-profile");
      if (G.account.email && G.account.activeKid) {
        await G.account.deleteKid(G.account.activeKid);
        openLastKid();
      } else {
        for (const k of Object.keys(progress)) delete progress[k];
        Object.assign(progress, FRESH());
        try { localStorage.removeItem(STORE); } catch { /* без сохранения */ }
        show("screen-boot");
      }
    }
  });
  $("btn-pf-logout").addEventListener("click", async () => {
    close("dlg-profile");
    G.voice.stop();
    G.sound.stopMusic();
    await G.account.logout();
    loginNotice = "";
    renderAccount();
    show("screen-boot");
  });
  $("btn-pf-login").addEventListener("click", () => {
    close("dlg-profile");
    G.voice.stop();
    G.sound.stopMusic();
    $("save-step-email").hidden = false;
    $("save-step-sent").hidden = true;
    $("save-error").hidden = true;
    show("screen-save");
    $("inp-save-email").focus();
  });
  // ───────── Семья: список доверенных почт (только владелец игры) ─────────
  // Добавить почту → ссылка-приглашение (7 дней, один раз) → владелец пересылает её сам, например в Telegram.
  let familyTarget = null;
  const FAMILY_ERRORS = {
    bad_email: L("Проверьте адрес почты.", "Check the email address."),
    too_many: L("В списке уже 30 почт.", "The list already has 30 emails."),
  };
  function familyError(code) {
    $("family-error").textContent = code ? FAMILY_ERRORS[code] || L("Не получилось. Попробуйте ещё раз.", "Something went wrong. Please try again.") : "";
    $("family-error").hidden = !code;
  }
  async function renderFamily() {
    const r = await G.account.familyList().catch(() => ({ ok: false, data: null }));
    const list = $("pf-family-list");
    list.innerHTML = "";
    if (!r.ok) { familyError("failed"); return; }
    for (const m of r.data) {
      const li = document.createElement("li");
      li.innerHTML = '<span class="fam-email"></span><span class="fam-state"></span><button class="link-btn" type="button" data-act="link"></button><button class="link-btn" type="button" data-act="del"></button>';
      li.querySelector(".fam-email").textContent = m.email;
      const st = li.querySelector(".fam-state");
      st.textContent = m.joined ? L("входили", "signed in") : L("ещё не входили", "not yet");
      st.classList.toggle("is-joined", m.joined);
      const link = li.querySelector('[data-act="link"]'), del = li.querySelector('[data-act="del"]');
      link.textContent = L("Новая ссылка", "New link");
      del.textContent = L("Убрать", "Remove");
      link.addEventListener("click", () => invite(m.email));
      del.addEventListener("click", () => {
        familyTarget = m.email;
        askConfirm("family-remove",
          L(`Убрать ${m.email} из семьи? Вход по этой почте закроется, а профили детей и фото этой почты удалятся. Это нельзя отменить.`,
            `Remove ${m.email} from the family? Sign-in with this email will close, and its child profiles and photos will be deleted. This can't be undone.`),
          L("Да, убрать", "Yes, remove"));
      });
      list.appendChild(li);
    }
  }
  async function invite(email) {
    familyError(null);
    const r = await G.account.familyInvite(email).catch(() => ({ ok: false, data: null }));
    if (!r.ok) { familyError(r.data && r.data.error); return; }
    $("pf-invite-to").textContent = r.data.email;
    $("pf-invite-link").value = r.data.link;
    $("btn-invite-copy").textContent = L("Скопировать", "Copy");
    $("btn-invite-share").hidden = !navigator.share;
    $("pf-invite").hidden = false;
    $("inp-family-email").value = "";
    renderFamily();
  }
  $("btn-family-add").addEventListener("click", () => {
    const v = $("inp-family-email").value.trim();
    if (v) invite(v); else $("inp-family-email").focus();
  });
  // Enter в поле почты — добавить, а не сохранить профиль.
  $("inp-family-email").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $("btn-family-add").click(); }
  });
  $("btn-invite-copy").addEventListener("click", async () => {
    const inp = $("pf-invite-link");
    try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand("copy"); }
    $("btn-invite-copy").textContent = L("Скопировано", "Copied");
  });
  $("btn-invite-share").addEventListener("click", () => {
    navigator.share({
      title: L("Миссия Сатурн-5", "Mission Saturn V"),
      text: L("Приглашение в «Миссию Сатурн-5». Откройте ссылку на устройстве, где играет ребёнок:", "An invitation to Mission Saturn V. Open the link on the device your child plays on:"),
      url: $("pf-invite-link").value,
    }).catch(() => {});
  });

  $("btn-pf-switch").addEventListener("click", async () => {
    close("dlg-profile");
    G.voice.stop();
    await G.account.flush();
    showProfiles();
  });

  // После входа — сразу тот, кто играл последним; детей нет — регистрация нового.
  // Выбор другого ребёнка — в профиле («Сменить игрока»).
  const LAST_KID = "saturn5.lastKid";
  // Новое устройство (здесь ещё никто из аккаунта не играл) — спрашиваем «Кто играет?», а не берём первого.
  function openLastKid() {
    let last = null;
    try { last = Number(localStorage.getItem(LAST_KID)); } catch { /* без сохранения */ }
    const kid = G.account.kids.find((k) => k.id === last);
    if (kid) { useKid(kid); enterGame(); return; }
    if (!G.account.kids.length && !movable()) { startRegistration("newKid"); return; }
    showProfiles();
  }
  // Прогресс с этого устройства, которого ещё нет в аккаунте, — его можно перенести.
  const profileName = (k) => (k.progress && k.progress.name) || k.callsign;
  const movable = () => deviceProgress && !G.account.kids.some((k) => profileName(k) === deviceProgress.name) ? deviceProgress : null;

  // ───────── Кто играет ─────────
  function showProfiles() {
    const box = $("profiles");
    box.innerHTML = "";
    for (const kid of G.account.kids) {
      const done = (kid.progress && kid.progress.done || []).length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "profile";
      b.innerHTML = `<span class="pf-name"></span><span class="pf-meta">${L("Миссий", "Missions")}: ${done} ${L("из", "of")} ${MISSIONS.length}</span><span class="pf-bar"><i style="width:${(done / MISSIONS.length) * 100}%"></i></span>`;
      b.querySelector(".pf-name").textContent = profileName(kid);
      const av = G.portrait.get(kid.id).avatar;
      if (av) { const img = document.createElement("img"); img.className = "avatar-md"; img.alt = ""; img.src = av; b.prepend(img); }
      b.addEventListener("click", () => { useKid(kid); enterGame(); });
      box.appendChild(b);
    }
    const dev = movable();
    if (dev) {
      const done = dev.done.length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "profile is-device";
      b.innerHTML = `<span class="pf-name"></span><span class="pf-meta">${L("С этого устройства — перенести в аккаунт", "From this device — move to the account")} · ${L("миссий", "missions")}: ${done}</span>`;
      b.querySelector(".pf-name").textContent = dev.name;
      b.addEventListener("click", async () => {
        const kid = await G.account.createKid(dev.name, { ...dev });
        if (!kid) return;
        deviceProgress = null;
        await G.portrait.adopt(kid.id);   // фото с этого устройства — вместе с прогрессом
        useKid(kid);
        enterGame();
      });
      box.appendChild(b);
    }
    renderAccount();
    show("screen-profiles");
    speak(L("Кто играет?", "Who's playing?"));
  }
  // Регистрация: один вопрос — имя. Дрон у всех один — ПИП.
  // mode: "local" — без входа, "newKid" — новый профиль в аккаунте, "fixName" — имя для старого игрока.
  let reg = null;
  function startRegistration(mode) {
    reg = { mode, name: "" };
    $("inp-name").value = "";
    show("screen-name");
    $("inp-name").focus();
    G.voice.stop();
    speak(L("Как тебя зовут? Напечатай своё имя.", "What's your name? Type your name."));
  }
  $("btn-new-kid").addEventListener("click", () => startRegistration("newKid"));

  $("form-name").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("inp-name").value.trim().slice(0, 16);
    if (!v) return;
    if (reg && reg.mode === "newKid" && G.account.email) {
      const kid = await G.account.createKid(v, { ...FRESH(), name: v });
      if (!kid) return;
      useKid(kid);
    } else {
      progress.name = v;
      save();
    }
    reg = null;
    G.voice.stop();
    enterGame();
  });

  function startLocal() {
    if (!progress.name && !progress.callsign) startRegistration("local");
    else enterGame();
  }

  // Звук в браузере разрешён только после первого нажатия.
  addEventListener("pointerdown", () => G.sound.unlock(), { once: true });
  $("btn-start").addEventListener("click", async () => {
    G.sound.unlock();
    session.startedAt = Date.now();
    G.voice.say("", "cup"); // разблокировать звук по нажатию
    await accountReady;
    if (G.account.email) { openLastKid(); return; }
    startLocal();
  });
  $("btn-save-skip").addEventListener("click", startLocal);
  $("form-save").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("inp-save-email").value.trim();
    $("btn-save-send").disabled = true;
    const r = await G.account.requestLink(email).catch(() => ({ ok: false, data: null }));
    $("btn-save-send").disabled = false;
    if (!r.ok) {
      $("save-error").textContent = LOGIN_ERRORS[r.data && r.data.error] || L("Не получилось. Попробуйте ещё раз.", "Something went wrong. Please try again.");
      $("save-error").hidden = false;
      return;
    }
    $("save-sent-to").textContent = email;
    $("save-step-email").hidden = true;
    $("save-step-sent").hidden = false;
    if (r.data.devLink) { G.devLink = r.data.devLink; console.log("DEV login link:", r.data.devLink); }
  });

  // ───────── Игровой экран ─────────
  // Вход в игру: новичок — брифинг и проверка систем, остальные — главный экран.
  function enterGame() {
    // Кто уже играл без имени — спрашиваем один раз.
    if (!progress.name) { startRegistration("fixName"); return; }
    if (!progress.onboarded) { showGame(); showBriefing(() => startMission(0)); return; }
    showHome();
  }

  function showGame() {
    G.sound.stopMusic();
    G.sound.ambience(true);   // в миссиях — не музыка, а тихий шум пультовой
    show("screen-game");
    if (!editor) {
      editor = G.editor.create($("editor"), { onRun: run, onChange: updateMeta });
      scene = G.world.createScene($("scene"));
    } else editor.cm.refresh();   // редактор был скрыт вместе с экраном
    $("tb-kid").textContent = progress.name || L("Профиль", "Profile");
    renderAvatar();
  }

  function goMission(id) {
    homeNote = "";
    showGame();
    startMission(id);
  }

  const nextMission = () => MISSIONS.find((m) => !isDone(m.id));
  const chapterDone = () => progress.patch || MISSIONS.every((m) => isDone(m.id));

  function partsBefore(id) {
    return MISSIONS.filter((m) => m.id < id && m.places).map((m) => m.places);
  }

  function startMission(id) {
    G.voice.stop();
    mission = id === 0 ? CHECK : MISSIONS.find((m) => m.id === id);
    if (id) { progress.current = id; save(); }
    ob = null;
    clearTarget();
    $("checklist").hidden = true;
    $("brief-keys").hidden = true;
    hintLevel = 0;
    $("hint").hidden = true;
    $("btn-hint").textContent = L("Подсказка", "Hint");
    $("tb-num").textContent = id ? L(`Миссия ${id} из ${MISSIONS.length}`, `Mission ${id} of ${MISSIONS.length}`) : L("Перед сменой", "Before the shift");
    $("tb-title").textContent = mission.title;
    $("btn-hint").hidden = id === 0;
    $("btn-intro").hidden = id === 0;
    $("btn-home").hidden = id === 0;
    // Видео старта подгружаем заранее, пока идёт последняя миссия.
    if (mission.allowLaunch) { const v = $("launch-video"); if (v.preload !== "auto") { v.preload = "auto"; v.load(); } }
    $("mem").hidden = id < NUM_FROM;
    $("brief-code").hidden = true;
    $("brief-note").hidden = true;
    $("radio").innerHTML = "";
    scene.load(mission);
    updateRocket();
    renderTiles();
    editor.set(mission.starter, mission.cursor);
    editor.setGhost(mission.ghost && mission.ghost.line, mission.ghost && mission.ghost.text);
    editor.setSlot(mission.slot && mission.slot.line, mission.slot && mission.slot.ch);
    editor.clearMarks();
    updateMeta();
    if (id === 0) { startCheck(); return; }
    let askCrew = false;
    if (mission.allowLaunch && G.portrait.available) {
      const ph = G.portrait.get();
      if (ph.source) { if (!ph.ch1) G.portrait.generate("ch1"); }
      else if (!progress.portraitAsked) askCrew = true;
    }
    $("brief-main").textContent = fill(mission.brief.text);
    $("brief-code").hidden = !mission.brief.code;
    $("brief-code").textContent = mission.brief.code || "";
    $("brief-note").hidden = !mission.brief.note;
    $("brief-note").textContent = mission.brief.note || "";
    if (askCrew) openCrew(); else openIntro(0);
  }

  // ───────── Главный экран ─────────
  let homeNote = "";   // строка сверху: например, «Смена завершена»

  function showHome() {
    G.voice.stop();
    clearTarget();
    ["intro", "dlg-success", "dlg-shift", "dlg-patch", "dlg-crew"].forEach(close);
    mission = null;
    renderHome();
    show("screen-home");
    G.sound.music("home");
    const next = nextMission();
    speak(next ? `${$("btn-continue").textContent}. ${next.title}.` : $("home-next").textContent);
    $("btn-continue").focus();
  }

  function renderHome() {
    $("home-name").textContent = kidName();
    $("home-call").textContent = L(`Оператор дрона ${G.callsign}`, `${G.callsign}'s operator`);
    renderHomePhoto();

    $("home-note").hidden = !homeNote;
    $("home-note").textContent = homeNote;

    const next = nextMission();
    $("btn-continue").textContent = next
      ? L(`Продолжить: миссия ${next.id}`, `Continue: mission ${next.id}`)
      : L("Миссии главы 1", "Chapter 1 missions");
    $("home-next").textContent = next ? next.title : L(`Глава 1 пройдена. Глава 2 «${CHAPTERS[1].title}» — скоро.`, `Chapter 1 complete. Chapter 2 “${CHAPTERS[1].title}” — coming soon.`);

    // Главы: первая открыта, остальные — только названия.
    const box = $("chapters");
    box.innerHTML = "";
    const doneN = MISSIONS.filter((m) => isDone(m.id)).length;
    for (const ch of CHAPTERS) {
      const li = document.createElement("li");
      if (ch.n === 1) {
        const fin = chapterDone();
        li.className = "chapter is-open" + (fin ? " is-done" : "");
        li.innerHTML = `<button type="button" class="ch-card"><span class="ch-patch"></span><span class="ch-body"><span class="ch-num num">${L("ГЛАВА", "CHAPTER")} 1</span><span class="ch-title"></span><span class="ch-meta num"></span><span class="pf-bar"><i style="width:${(doneN / MISSIONS.length) * 100}%"></i></span></span>${fin ? `<span class="pill pill-done">${L("Пройдена", "Complete")}</span>` : ""}</button>`;
        li.querySelector(".ch-title").textContent = ch.title;
        li.querySelector(".ch-meta").textContent = L(`Миссий: ${doneN} из ${MISSIONS.length}`, `Missions: ${doneN} of ${MISSIONS.length}`);
        if (fin) drawPatch(li.querySelector(".ch-patch"), 64);
        else li.querySelector(".ch-patch").remove();
        li.querySelector("button").addEventListener("click", openPlan);
      } else {
        li.className = "chapter is-locked";
        li.innerHTML = `<span class="ch-num num">${L("ГЛАВА", "CHAPTER")} ${ch.n}</span><span class="ch-title"></span><svg class="ch-lock" viewBox="0 0 24 24" aria-label="${L("Закрыта", "Locked")}"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/></svg>`;
        li.querySelector(".ch-title").textContent = ch.title;
      }
      box.appendChild(li);
    }

    // Медали: полученные — яркие, остальные — тусклые, с подписью «за что».
    const mb = $("medals");
    mb.innerHTML = "";
    for (const md of MEDALS) {
      const got = md.patch ? chapterDone() : isDone(md.mission);
      const li = document.createElement("li");
      li.className = "medal" + (got ? " is-got" : "");
      li.innerHTML = `<span class="md-art"></span><span class="md-title"></span><span class="md-for num"></span>`;
      li.querySelector(".md-title").textContent = md.title;
      li.querySelector(".md-for").textContent = md.patch ? L("Нашивка", "Patch") : L(`Миссия ${md.mission}`, `Mission ${md.mission}`);
      drawMedal(li.querySelector(".md-art"), md);
      mb.appendChild(li);
    }

    // Фото экспедиций: по одному на пройденную главу.
    const ph = G.portrait.available ? G.portrait.get() : {};
    const pending = G.portrait.available && G.portrait.isPending("ch1");
    $("home-photos-block").hidden = !(ph.ch1 || pending);
    const pb = $("home-photos");
    pb.innerHTML = "";
    if (ph.ch1 || pending) {
      const fig = document.createElement("figure");
      fig.className = "crew-photo" + (ph.ch1 ? "" : " is-pending");
      fig.innerHTML = `${ph.ch1 ? '<img class="zoomable" alt="" tabindex="0">' : ""}<figcaption></figcaption>`;
      if (ph.ch1) { const img = fig.querySelector("img"); img.src = ph.ch1; img.alt = crewCaption(); }
      fig.querySelector("figcaption").textContent = ph.ch1 ? crewCaption() : L("Фото экспедиции печатается…", "The expedition photo is printing…");
      pb.appendChild(fig);
    }
  }

  // Аватарка: фото в скафандре; без фото — дрон.
  function renderHomePhoto() {
    const ph = G.portrait.available ? G.portrait.get() : {};
    $("home-ava-img").hidden = !ph.avatar;
    if (ph.avatar) { $("home-ava-img").src = ph.avatar; $("home-ava-img").alt = avatarCaption(); }
    const drone = $("home-ava-drone");
    drone.hidden = !!ph.avatar;
    if (!ph.avatar && !drone.firstChild) {
      const keep = G.callsign; G.callsign = "";   // без подписи над дроном
      G.world.drawDrone(drone).g.setAttribute("transform", "translate(0 4) scale(0.85)");
      G.callsign = keep;
    }
    const pend = G.portrait.available && G.portrait.isPending("avatar");
    $("btn-home-photo").hidden = !G.portrait.available || !!ph.source;
    const err = G.portrait.available && G.portrait.errorOf("avatar");
    const redrawNow = needRedraw();
    $("home-photo-note").hidden = !pend && !(redrawNow && err);
    $("home-photo-note").classList.toggle("is-error", !pend);
    $("home-photo-note").textContent = pend
      ? pendingText()
      : PORTRAIT_ERRORS[err] || PORTRAIT_ERRORS.failed;
    $("btn-home-redraw").hidden = !redrawNow;
  }

  // Значки медалей: простая геометрия в стиле нашивки.
  function drawMedal(host, md) {
    if (md.patch) { drawPatch(host, 64); return; }
    const { el } = G.world;
    const svg = el("svg", { viewBox: "-32 -32 64 64", width: 64, height: 64, "aria-hidden": "true" }, host);
    el("circle", { r: 30, class: "md-rim" }, svg);
    el("circle", { r: 24, class: "md-face" }, svg);
    const g = el("g", { class: "md-icon" }, svg);
    if (md.id === "radio") {          // антенна и радиоволны
      el("path", { d: "M-4 14 L0 -2 L4 14 M-2.5 8 H2.5" }, g);
      el("circle", { cy: -4, r: 2.2 }, g);
      for (const r of [7, 12]) el("path", { d: `M${-r * 0.7} ${-4 - r * 0.7} A${r} ${r} 0 0 1 ${r * 0.7} ${-4 - r * 0.7}` }, g);
    } else if (md.id === "stack") {   // ступени одна на другой
      el("rect", { x: -7, y: 3, width: 14, height: 11 }, g);
      el("rect", { x: -7, y: -6, width: 14, height: 7 }, g);
      el("rect", { x: -4.5, y: -12, width: 9, height: 4 }, g);
      el("path", { d: "M0 -12 L0 -17" }, g);
    } else if (md.id === "debug") {   // гаечный ключ
      el("path", { d: "M-10 10 L3 -3" }, g).setAttribute("stroke-width", "4.5");
      el("path", { d: "M1.5 -9.5 A6.5 6.5 0 1 0 9.5 -1.5 L5 -2 L2 -5 Z" }, g);
    } else if (md.id === "pilot") {   // траектория в обход фермы
      el("path", { d: "M-13 10 V-8 H11 V8" }, g).setAttribute("stroke-dasharray", "3 2.5");
      el("path", { d: "M7 4 L11 10 L15 4" }, g);
      el("rect", { x: -6, y: -2, width: 10, height: 12, class: "md-girder" }, g);
    }
  }

  // Музыка: включена по умолчанию, выключается одной кнопкой (запоминается).
  // В игре та же кнопка — значком в верхней панели (музыка на главной и шум пультовой в миссиях).
  function renderMusicBtn() {
    const on = G.sound.musicOn;
    for (const id of ["btn-music", "btn-sound"]) $(id).setAttribute("aria-pressed", String(on));
    $("btn-music").querySelector("span").textContent = on ? L("Музыка: вкл", "Music: on") : L("Музыка: выкл", "Music: off");
    $("btn-sound").title = on ? L("Музыка и шум пультовой: вкл", "Music and control-room sound: on") : L("Музыка и шум пультовой: выкл", "Music and control-room sound: off");
  }
  renderMusicBtn();
  for (const id of ["btn-music", "btn-sound"]) $(id).addEventListener("click", () => {
    G.sound.setMusic(!G.sound.musicOn);
    renderMusicBtn();
  });

  $("btn-continue").addEventListener("click", () => {
    const next = nextMission();
    if (next) goMission(next.id); else openPlan();
  });
  $("btn-home-journal").addEventListener("click", openJournal);
  $("btn-home-profile").addEventListener("click", openProfile);
  $("btn-home").addEventListener("click", () => {
    if (running || ob) return;
    homeNote = "";
    showHome();
  });

  // ───────── Фото космонавта с главного экрана ─────────
  // Выбрать → (шлем: подогнать лицо) → «Готово» или «Отправить» (семья, OpenAI).
  let homePhoto = null;
  function openPhoto() {
    homePhoto = null;
    $("photo-preview").hidden = $("photo-send").hidden = true;
    $("photo-consent").textContent = consentText();
    $("photo-send").textContent = isLocal() ? L("Готово", "Done") : L("Отправить", "Send");
    $("photo-pick-text").textContent = L("Выбрать фото", "Choose a photo");
    $("photo-pick").classList.replace("btn-ghost", "btn-go");
    open("dlg-photo");
    G.voice.stop();
    speak(L("Фото космонавта. Попроси взрослого помочь.", "Astronaut photo. Ask a grown-up to help."));
  }
  $("btn-home-photo").addEventListener("click", openPhoto);
  $("photo-cancel").addEventListener("click", () => { close("dlg-photo"); G.voice.stop(); });
  $("photo-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    homePhoto = await G.portrait.choose(f);
    if (!homePhoto) return;
    $("photo-img").src = await previewOf(homePhoto);
    $("photo-preview").hidden = $("photo-send").hidden = false;
    $("photo-pick-text").textContent = L("Другое фото", "Another photo");
    $("photo-pick").classList.replace("btn-go", "btn-ghost");
  });
  $("photo-send").addEventListener("click", () => {
    if (!homePhoto) return;
    G.portrait.setSource(homePhoto);
    startPortraits();
    close("dlg-photo");
  });

  // ───────── Брифинг: 3 карточки перед первой сменой ─────────
  const BRIEF = [
    { text: L("Это Сатурн-5: 110 метров, на нём люди полетели на Луну. Его собирают из пяти частей.", "This is Saturn V: 110 meters tall, the rocket that flew people to the Moon. It's built from five parts."), art: "rocket" },
    { text: L("{kid}, это Пип — твой дрон. Он переносит части на площадку, а кран ставит их на ракету.", "{kid}, this is Pip — your drone. It carries the parts to the pad, and the crane puts them on the rocket."), art: "carry" },
    { text: L("Пип слушается программы на Python. Пишешь команду, жмёшь ПУСК — Пип выполняет.", "Pip follows a program in Python. You type a command, press RUN — Pip does it."), art: "code" },
  ];
  let bfIndex = 0, bfDone = null, bfToken = 0;

  // Кнопка сразу готова: ребёнок может нажать, не дожидаясь голоса.
  function readyButton(btn, label) {
    btn.disabled = false;
    btn.textContent = label;
  }

  function bfArt(kind) {
    const { el, drawRocket, drawDrone, drawPart } = G.world;
    const box = $("bf-art");
    box.innerHTML = "";
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    box.appendChild(svg);
    if (kind === "rocket") {
      svg.setAttribute("viewBox", "-40 -116 80 124");
      drawRocket(svg, G.levels.ROCKET.map((p) => p.id));
      el("text", { x: 12, y: -108, class: "bf-label" }, svg).textContent = L("110 м", "110 m");
    } else if (kind === "carry") {
      // Дрон несёт ступень к площадке.
      svg.setAttribute("viewBox", "-70 -70 340 150");
      el("rect", { x: 175, y: 52, width: 90, height: 12, class: "platform-base" }, svg);
      el("text", { x: 220, y: 44, class: "platform-label", "text-anchor": "middle" }, svg).textContent = L("ПОСТАВИТЬ", "PUT HERE");
      el("line", { x1: -60, x2: 270, y1: 66, y2: 66, class: "floor-line" }, svg);
      const d = drawDrone(svg);
      drawPart("S-IC", d.hold).setAttribute("transform", "scale(0.8)");
      d.g.classList.add("bf-carry");
    } else if (kind === "code") {
      box.innerHTML = `<span class="bf-cmd"><code class="bf-code">right()</code>${G.lang === "ru" ? '<span class="bf-ru">вправо</span>' : ""}</span><span class="bf-arrow" aria-hidden="true">→</span>`;
      const s2 = document.createElementNS(NS, "svg");
      s2.setAttribute("viewBox", "-60 -60 260 100");
      box.appendChild(s2);
      const d = drawDrone(s2);
      d.g.classList.add("bf-move");
    }
  }

  function showBriefing(onDone) {
    bfIndex = 0; bfDone = onDone;
    open("briefing");
    bfShow();
  }
  function bfShow() {
    const c = BRIEF[bfIndex];
    $("bf-step").textContent = `${L("БРИФИНГ", "BRIEFING")} · ${bfIndex + 1} / ${BRIEF.length}`;
    $("bf-text").textContent = fill(c.text);
    bfArt(c.art);
    bfSpeak();
  }
  // Брифинг не ждёт голос: ребёнок читает быстрее, чем говорит ЦУП.
  function bfSpeak() {
    G.voice.stop();
    $("bf-next").textContent = bfIndex < BRIEF.length - 1 ? L("Дальше", "Next") : L("К проверке систем", "To the systems check");
    speak(BRIEF[bfIndex].text);
    $("bf-next").focus();
  }
  $("bf-next").addEventListener("click", () => {
    if (bfIndex < BRIEF.length - 1) { bfIndex++; bfShow(); return; }
    close("briefing");
    G.voice.stop();
    bfDone && bfDone();
  });
  $("bf-say").addEventListener("click", bfSpeak);

  // ───────── Инструктаж: 1) задание, 2) новое на образце, 3) «Мой ход» ─────────
  let introScene = null, inPage = 0, inToken = 0, inPlaying = false;

  function openIntro(page = 0) {
    if (!introScene) introScene = G.world.createScene($("intro-scene"));
    open("intro");
    showIntroPage(page);
  }

  function showIntroPage(page) {
    inPage = page;
    const my = ++inToken;
    const ex = mission.example;
    G.voice.stop();
    introScene.load(mission);
    const pages = ex ? 2 : 1;   // без новой команды — только экран задания
    $("in-step").textContent = L(`МИССИЯ ${mission.id} · ИНСТРУКТАЖ ${page + 1} / ${pages}`, `MISSION ${mission.id} · BRIEFING ${page + 1} / ${pages}`);
    if (page === 0) {
      $("in-title").textContent = fill(mission.brief.text);
      $("in-task-code").hidden = true;   // экран 1 — только цель; как писать — на экране 2
      $("in-task-code-text").textContent = mission.brief.code || "";
      $("in-task-note").textContent = mission.brief.note || "";
      $("in-example").hidden = true;
      $("in-replay").hidden = true;
      // Задание — просто текст, его можно прочитать быстрее голоса.
      readyButton($("in-next"), ex ? L("Дальше", "Next") : L("Мой ход", "My turn"));
      speak(mission.brief.text);
      $("in-next").focus();
    } else {
      $("in-title").textContent = ex.title;
      $("in-task-code").hidden = true;
      const list = $("in-code");
      list.innerHTML = "";
      list.classList.toggle("is-steps", !!ex.steps);
      if (ex.steps) {
        ex.steps.forEach((st, i) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="st-n">${i + 1}</span><span class="st-body"><span class="st-text"></span>${st.add !== undefined ? `<code><span class="st-dim"></span><b></b><span class="st-dim"></span></code>` : ""}${st.keys && !G.touch ? `<span class="st-keys"><span class="kgrp">${st.keys.map((k) => `<kbd>${k}</kbd>`).join("+")}</span> ${st.keysNote || ""}</span>` : ""}</span>`;
          li.querySelector(".st-text").textContent = st.text;
          if (st.add !== undefined) {
            const [d1, d2] = li.querySelectorAll(".st-dim");
            d1.textContent = st.before; d2.textContent = st.after;
            li.querySelector("b").textContent = st.add;
          }
          list.appendChild(li);
        });
      } else ex.code.split("\n").forEach((line, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<code></code><span class="in-note"></span>`;
        if (ex.mine === i) li.classList.add("is-mine");
        li.querySelector("code").textContent = line;
        li.querySelector(".in-note").textContent = ex.notes[i] ? "← " + ex.notes[i] : "";
        list.appendChild(li);
      });
      const caption = (G.touch && ex.captionTouch) || ex.caption;
      $("in-caption").textContent = caption;
      $("in-caption").hidden = !caption;
      const words = [...new Set(ex.code.match(/[a-z]+/g) || [])].filter((w) => G.levels.WORDS[w]);
      $("in-words").innerHTML = words.map((w) => `<span class="word"><code>${w}</code> — ${G.levels.WORDS[w]}</span>`).join("");
      $("in-words").hidden = !words.length || !!ex.steps;
      $("in-example").hidden = false;
      $("in-replay").hidden = ex.demo === false;
      speak(exampleText(ex)).then(() => (my === inToken && !$("intro").hidden ? runDemo() : null));
      readyButton($("in-next"), L("Мой ход", "My turn"));
    }
  }

  // Дрон-инструктор выполняет образец на поле, строки подсвечиваются.
  async function runDemo() {
    const ex = mission.example;
    if (inPlaying || !ex || ex.demo === false) return;
    if (!G.python.ready) { try { await pyReady; } catch { return; } }
    inPlaying = true;
    $("in-replay").disabled = true;
    const lines = [...$("in-code").children];
    // Для пошагового образца при запуске подсвечивается готовая команда (последний шаг с кодом).
    const target = (n) => (ex.steps ? (n > 0 ? ex.demoStep ?? ex.steps.length - 2 : -1) : n - 1);
    const mark = (n) => lines.forEach((l, i) => l.classList.toggle("is-run", i === target(n)));
    try {
      introScene.load(mission);
      introScene.ghost(true);
      const res = G.python.run(ex.code);
      await introScene.play(res.actions, { onLine: mark, onPrint: (t) => G.voice.say(t, "bort") }, 560);
      await G.world.sleep(700);
    } finally {
      mark(0);
      inPlaying = false;
      $("in-replay").disabled = false;
      introScene.load(mission);
    }
  }

  $("in-next").addEventListener("click", () => {
    if (inPage === 0 && mission.example) { showIntroPage(1); return; }
    inToken++;
    close("intro");
    G.voice.stop();
    if (!G.touch) editor.focus();
    radio("cup", L("Твой ход. Напечатай программу и нажми ПУСК.", "Your turn. Type the program and press RUN."));
  });
  $("in-replay").addEventListener("click", () => { G.voice.stop(); runDemo(); });
  $("in-say").addEventListener("click", () => {
    ++inToken;   // показ образца, который ждал конца фразы, отменяется
    G.voice.stop();
    speak(inPage === 0 ? mission.brief.text : exampleText(mission.example));
  });
  $("btn-intro").addEventListener("click", () => openIntro(mission.example ? 1 : 0));

  // ───────── Миссия 0 · Проверка систем (онбординг) ─────────
  let ob = null; // { i: номер пункта, busy }

  let spotTarget = null;

  // Затемнение из четырёх панелей вокруг светлого окна: панели ловят клики,
  // поэтому нажать можно только то, что в окне. Нажимать можно сразу, не дожидаясь голоса.
  function clearTarget() {
    spotTarget = null;
    $("ob-shade").hidden = $("spot-bubble").hidden = true;
  }
  function placeSpot() {
    if (!spotTarget) return;
    const r = spotTarget.getBoundingClientRect(), pad = 10;
    const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
    const px = (v) => Math.round(v) + "px";
    const box = { left: px(x), top: px(y), width: px(w), height: px(h) };
    for (const p of document.querySelectorAll("#ob-shade .sh")) {
      const side = p.dataset.side;
      Object.assign(p.style, side === "t" ? { left: "0", top: "0", width: "100%", height: px(Math.max(0, y)) }
        : side === "b" ? { left: "0", top: px(y + h), width: "100%", height: px(Math.max(0, innerHeight - y - h)) }
        : side === "l" ? { left: "0", top: px(y), width: px(Math.max(0, x)), height: px(h) }
        : { left: px(x + w), top: px(y), width: px(Math.max(0, innerWidth - x - w)), height: px(h) });
    }
    Object.assign($("spot-ring").style, box);
    const bub = $("spot-bubble");
    const bw = Math.min(380, innerWidth - 32), bh = bub.offsetHeight || 120, gap = pad + 14;
    let top, left;
    if (r.bottom + gap + bh < innerHeight) {            // под элементом
      top = r.bottom + gap; left = r.left + r.width / 2 - bw / 2;
    } else if (r.top - gap - bh > 0) {                  // над элементом
      top = r.top - gap - bh; left = r.left + r.width / 2 - bw / 2;
    } else if (r.left - gap - bw > 0) {                 // слева (высокий элемент)
      top = r.top + 20; left = r.left - gap - bw;
    } else {                                            // справа
      top = r.top + 20; left = r.right + gap;
    }
    left = Math.min(Math.max(16, left), innerWidth - bw - 16);
    top = Math.min(Math.max(16, top), innerHeight - bh - 16);
    Object.assign(bub.style, { left: left + "px", top: top + "px", width: bw + "px" });
  }
  setInterval(placeSpot, 250);
  addEventListener("resize", placeSpot);
  const stepText = (s) => (G.touch && s.textTouch) || s.text;
  function setSpot(el, s) {
    spotTarget = el;
    $("spot-text").textContent = fill(stepText(s));
    $("spot-keys").innerHTML = (s.keys || []).map((k) => `<span class="kgrp">${k.map((c) => `<kbd>${c}</kbd>`).join("+")}</span>`).join(" ");
    $("spot-keys").hidden = !s.keys || G.touch;
    $("ob-shade").hidden = $("spot-bubble").hidden = false;
    placeSpot();
  }

  function checkTarget(key) {
    return {
      radio: () => $("btn-brief-say"),
      tiles: () => document.querySelector("#tiles .tile"),
      keys: () => document.querySelector(".editor-wrap"),
      run: () => $("btn-run"),
    }[key]();
  }

  function renderChecklist() {
    const box = $("checklist");
    box.hidden = false;
    box.innerHTML = "";
    CHECK.steps.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = i < ob.i ? "is-done" : i === ob.i ? "is-now" : "";
      li.innerHTML = `<span class="lamp" aria-hidden="true"></span>${s.label}`;
      box.appendChild(li);
    });
  }

  function startCheck() {
    ob = { i: 0, busy: false };
    $("brief-main").textContent = L("Проверка систем перед сменой", "Systems check before the shift");
    $("brief-keys").hidden = true;
    showStep();
  }

  // Пункт: подсветить цель и рассказать голосом. Нажать можно сразу.
  function showStep() {
    const s = CHECK.steps[ob.i];
    renderChecklist();
    const t = checkTarget(s.key);
    if (t) setSpot(t, s);
    if (s.key === "keys" && !G.touch) editor.focus();
    G.voice.stop();   // ребёнок нажал раньше, чем ЦУП договорил, — прошлая фраза обрывается
    speak(stepText(s));
  }

  // Пункт выполнен: зелёная лампа, короткий ответ ЦУП, следующий пункт.
  async function checkDone(key) {
    if (!ob || ob.busy || CHECK.steps[ob.i].key !== key) return;
    ob.busy = true;
    const s = CHECK.steps[ob.i];
    ob.i++;
    renderChecklist();
    if (s.done) radio("cup", s.done);
    if (!ob) return;
    ob.busy = false;
    if (ob.i < CHECK.steps.length) showStep();
  }

  async function finishCheck() {
    ob.i = CHECK.steps.length;
    renderChecklist();
    progress.onboarded = true; save();
    $("brief-main").textContent = L("Все системы: ГОТОВ", "All systems: GO");
    radio("cup", fill(CHECK.final));
    await speak(CHECK.final);
    await G.world.sleep(500);
    clearTarget();
    startMission(1);
  }

  function updateRocket(justPlaced) {
    const placed = partsBefore(mission.id).concat(scene.state ? scene.state.stack : []);
    const h = G.world.renderRocketPanel($("rocket"), placed, justPlaced);
    $("rp-h").textContent = G.lang === "ru" ? String(h).replace(".", ",") : String(h);
  }

  function renderTiles() {
    const box = $("tiles");
    box.innerHTML = "";
    for (const c of mission.commands) {
      const t = TILES[c];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.innerHTML = `<span class="tile-glyph" aria-hidden="true">${t.glyph}</span><span class="tile-words"><code></code><span class="tile-ru"></span></span>`;
      b.querySelector("code").textContent = t.label;
      b.querySelector(".tile-ru").textContent = t.ru;
      b.title = L("Вписать в программу", "Add to the program");
      b.addEventListener("click", () => {
        if (!ob) G.voice.stop();
        if (!session.tilesHeard.has(c)) { session.tilesHeard.add(c); speak(t.ru ? `${t.label} — ${t.ru}` : t.label); }
        // Плитка всегда вписывает команду. С миссии 4 курсор встаёт в скобки — число печатает сам.
        const move = ["right", "left", "up", "down"].includes(c);
        const own = mission.tileInsert && mission.tileInsert[c];   // миссия может вписывать по-своему
        if (!running) {
          if (own) editor.insert(own[0], own[1]);
          else editor.insert(t.insert, mission.id >= NUM_FROM && move ? -1 : t.caret || 0);
        }
        else if (!G.touch) editor.focus();
        checkDone("tiles");
      });
      box.appendChild(b);
    }
  }

  function updateMeta() {
    if (!editor || !mission) return;
    const used = editor.usedLines();
    const mem = $("mem");
    mem.textContent = L(`СТРОК ${used} из ${mission.maxLines}`, `LINES ${used} of ${mission.maxLines}`);
    mem.classList.toggle("is-over", used > mission.maxLines);
    // Раскладка — системная: подсказываем, если буквы не те.
    const hint = editor.layoutHint();
    $("kbd").hidden = !hint;
    $("kbd").classList.toggle("is-warn", !!hint && hint !== "ru");
    if (hint) $("kbd").innerHTML = {
      ru: L("Внутри кавычек — <b>русские буквы</b>", ""),
      "ru-warn": L("Внутри кавычек — <b>русские буквы</b>. Переключи раскладку.", ""),
      "en-warn": L("Команды — <b>английскими буквами</b>. Переключи раскладку.", "Commands use <b>English letters</b>. Switch the keyboard layout."),
    }[hint];
    $("editor-ph").hidden = editor.value.trim() !== "";
    if (ob && /^\s*left\(\)\s*$/m.test(editor.value)) checkDone("keys");
  }

  // ───────── Пуск ─────────
  async function run() {
    if (running || !mission) return;
    if (ob && CHECK.steps[ob.i].key !== "run") return;
    G.voice.stop();
    editor.clearMarks();
    scene.load(mission);
    updateRocket();

    // Проверка кода самой миссии до запуска (например, «числа без кавычек»).
    const pre = mission.codeCheck && mission.codeCheck(editor.value);
    if (pre) { bortError(pre); return; }
    const used = editor.usedLines();
    if (used === 0) { bortError(G.errors.msg(L("Программа пустая. Напиши команды.", "The program is empty. Type some commands."))); return; }
    if (used > mission.maxLines) { bortError(G.errors.FLIGHT.memory(used, mission.maxLines)); return; }

    if (!G.python.ready) {
      radio("bort", L("Python ещё загружается…", "Python is still loading…"));
      try { await pyReady; } catch {
        bortError(location.protocol === "file:"
          ? G.errors.msg(L("Python не может загрузиться из файла. Попроси взрослого запустить игру файлом «Запустить игру» в папке.", "Python can't load from a file. Ask a grown-up to open the game with the launcher file in the folder."))
          : G.errors.msg(L("Python не загрузился. Обнови страницу.", "Python didn't load. Reload the page.")));
        return;
      }
    }

    // Проверка систем: пока дрон летит, смотрим на поле; при ошибке — снова к кнопке ПУСК.
    if (ob) setSpot($("scene"), { text: L("Смотри: дрон выполняет твою программу.", "Watch: the drone runs your program.") });
    running = true;
    editor.setReadOnly(true);
    $("btn-run").disabled = true;
    try {
      const res = G.python.run(editor.value);
      if (!res.ok && res.error.kind === "syntax" || !res.ok && res.error.kind === "no_parens") {
        fail(G.errors.fromPython(res.error));
        return;
      }
      const out = await scene.play(res.actions, {
        onLine(n) { editor.clearMarks(); editor.markLine(n, "line-run"); },
        onPrint(text) {
          radio("bort", "› " + text);
          return G.voice.say(text, "bort");
        },
        onPlaced(id) { updateRocket(id); },
      });
      editor.clearMarks();
      if (out.error) { fail(out.error, out.line); return; }
      if (!res.ok) { fail(G.errors.fromPython(res.error)); return; }
      if (mission.id === 0) {
        if (ob && CHECK.steps[ob.i].key === "run") await finishCheck();
        else radio("cup", L("Пробный полёт выполнен.", "Test flight complete."));
        return;
      }
      const why = mission.goal(out.ctx);
      if (why) { fail(why); return; }
      await succeed();
    } finally {
      running = false;
      editor.setReadOnly(false);
      $("btn-run").disabled = false;
      if (ob && CHECK.steps[ob.i] && CHECK.steps[ob.i].key === "run") {
        setSpot($("btn-run"), CHECK.steps[ob.i]);
      }
    }
  }

  function fail(m, line) {
    const extra = m.kind && mission.flightHints && mission.flightHints[m.kind];
    if (extra) m = { ...m, text: m.text + " " + extra };
    const n = line || m.line;
    if (n) editor.markLine(n, "line-error");
    bortError(m);
  }

  async function succeed() {
    const first = !isDone(mission.id);
    if (first) progress.done.push(mission.id);
    save();
    session.completed++;
    if (!mission.allowLaunch) G.sound.fx("success");
    if (mission.allowLaunch) {
      await playLaunch();
      progress.patch = true; save();
      showPatch();
      return;
    }
    cup(mission.success.text);
    openSuccess();
  }

  function openSuccess() {
    $("succ-num").textContent = L(`МИССИЯ ${mission.id} ВЫПОЛНЕНА`, `MISSION ${mission.id} COMPLETE`);
    $("succ-title").textContent = mission.title;
    $("succ-text").textContent = fill(mission.success.text);
    $("succ-fact-title").textContent = mission.fact.title;
    $("succ-fact-text").textContent = mission.fact.text;
    const ph = mission.fact.photo;
    $("succ-photo").hidden = !ph;
    if (ph) { $("succ-photo-img").src = ph.src; $("succ-photo-img").alt = ph.caption; $("succ-photo-cap").textContent = ph.caption; }
    const last = mission.id === MISSIONS.length;
    $("btn-next").textContent = last ? L("Открыть журнал", "Open the log") : L("Следующая миссия", "Next mission");
    open("dlg-success");
    $("btn-next").focus();
  }

  $("btn-fact-say").addEventListener("click", () => {
    G.voice.stop();
    speak(mission.fact.title + ". " + mission.fact.text);
  });

  $("btn-next").addEventListener("click", () => {
    close("dlg-success");
    if (mission.id === MISSIONS.length) { openJournal(); return; }
    if (session.completed >= session.nextBreak) { openShift(); return; }
    startMission(mission.id + 1);
  });

  // ───────── Подсказки ─────────
  $("btn-hint").addEventListener("click", () => {
    hintLevel = Math.min(3, hintLevel + 1);
    const h = mission.hints[hintLevel - 1];
    $("hint").hidden = false;
    $("hint-step").textContent = `${L("ПОДСКАЗКА", "HINT")} ${hintLevel}/3`;
    $("hint-text").textContent = h.text;
    $("hint-code").hidden = !h.code;
    $("hint-code").textContent = h.code || "";
    $("btn-hint").textContent = hintLevel < 3 ? `${L("Подсказка", "Hint")} · ${hintLevel + 1}/3` : L("Подсказки исчерпаны", "No more hints");
    G.voice.stop();
    cup([h.text, h.code].filter(Boolean).join(" "));
  });

  $("btn-reset").addEventListener("click", () => {
    if (running) return;
    G.voice.stop();
    editor.clearMarks();
    scene.load(mission);
    updateRocket();
    editor.focus();
  });
  $("btn-run").addEventListener("click", run);
  $("btn-brief-say").addEventListener("click", () => {
    G.voice.stop();
    if (ob) {
      if (CHECK.steps[ob.i].key === "radio") checkDone("radio");
      else speak(stepText(CHECK.steps[ob.i]));
      return;
    }
    speak(briefText(mission));
  });

  // ───────── Окна ─────────
  function open(id) { $(id).hidden = false; }
  function close(id) { $(id).hidden = true; }
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => close(b.closest(".overlay").id)));
  // Журнал и план полёта закрываются нажатием мимо окна (нажали и отпустили именно на затемнении).
  for (const id of ["dlg-journal", "dlg-plan"]) {
    let downOnShade = false;
    $(id).addEventListener("pointerdown", (e) => { downOnShade = e.target.id === id; });
    $(id).addEventListener("click", (e) => { if (downOnShade && e.target.id === id) close(id); });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") ["dlg-plan", "dlg-journal"].forEach(close);
  });

  function openPlan() {
    const list = $("plan-list");
    list.innerHTML = "";
    for (const m of [CHECK, ...MISSIONS]) {
      const li = document.createElement("li");
      const st = (m.id === 0 ? progress.onboarded : isDone(m.id)) ? "done" : isOpen(m.id) ? "open" : "locked";
      const label = L({ done: "Выполнено", open: "Доступна", locked: "Закрыто" }, { done: "Done", open: "Open", locked: "Locked" })[st];
      li.innerHTML = `<button type="button" class="plan-item is-${st}" ${st === "locked" ? "disabled" : ""}>
        <span class="plan-num num">${L("М", "M")}-${String(m.id).padStart(2, "0")}</span>
        <span class="plan-name"></span>
        <span class="plan-concept"></span>
        <span class="pill pill-${st}">${m.id === (mission ? mission.id : progress.current) && st !== "done" ? L("Сейчас", "Now") : label}</span></button>`;
      li.querySelector(".plan-name").textContent = m.title;
      li.querySelector(".plan-concept").textContent = m.concept;
      li.querySelector("button").addEventListener("click", () => { close("dlg-plan"); goMission(m.id); });
      list.appendChild(li);
    }
    open("dlg-plan");
  }
  $("btn-plan").addEventListener("click", openPlan);

  function openJournal() {
    const list = $("journal-list");
    list.innerHTML = "";
    const done = MISSIONS.filter((m) => isDone(m.id));
    $("journal-empty").hidden = done.length > 0;
    for (const m of done) {
      const li = document.createElement("li");
      li.innerHTML = `<p class="j-meta num">${L("М", "M")}-${String(m.id).padStart(2, "0")} · ${m.title}</p><p class="j-big"></p>${m.fact.photo ? `<figure class="fact-photo"><img alt="" loading="lazy"><figcaption><span class="j-cap"></span> <span class="credit">${L("Фото: NASA", "Photo: NASA")}</span></figcaption></figure>` : ""}<p class="j-text"></p><button type="button" class="btn btn-ghost btn-sm">${L("Прочитать вслух", "Read aloud")}</button>`;
      li.querySelector(".j-big").textContent = m.fact.title;
      if (m.fact.photo) {
        const img = li.querySelector(".fact-photo img");
        img.src = m.fact.photo.src; img.alt = m.fact.photo.caption;
        li.querySelector(".j-cap").textContent = m.fact.photo.caption;
      }
      li.querySelector(".j-text").textContent = m.fact.text;
      li.querySelector("button").addEventListener("click", () => { G.voice.stop(); speak(m.fact.title + ". " + m.fact.text); });
      list.appendChild(li);
    }
    const st = $("journal-status");
    st.classList.toggle("is-done", chapterDone());
    st.textContent = chapterDone()
      ? L(`Глава 1 · ${CHAPTERS[0].title} — пройдена`, `Chapter 1 · ${CHAPTERS[0].title} — complete`)
      : L(`Глава 1 · ${CHAPTERS[0].title} — ${done.length} из ${MISSIONS.length} миссий`, `Chapter 1 · ${CHAPTERS[0].title} — ${done.length} of ${MISSIONS.length} missions`);
    const jp = $("journal-patch");
    jp.hidden = !progress.patch;
    if (progress.patch) { jp.innerHTML = ""; drawPatch(jp, 120); }
    const ch1 = G.portrait.available && G.portrait.get().ch1;
    $("journal-photo").hidden = !ch1;
    if (ch1) { $("journal-photo-img").src = ch1; $("journal-photo-img").alt = $("journal-photo-cap").textContent = crewCaption(); }
    open("dlg-journal");
  }
  $("btn-journal").addEventListener("click", openJournal);

  // ───────── Смена ─────────
  function openShift() {
    $("shift-text").textContent = L(`${session.completed} ${session.completed >= 5 ? "миссий" : "миссии"} за смену — хорошая работа, ${kidName()}. Ракета подождёт до завтра.`,
      `${session.completed} missions this shift — great work, ${kidName()}. The rocket will wait until tomorrow.`);
    open("dlg-shift");
    speak(L("Смена окончена. ", "Shift over. ") + $("shift-text").textContent);
  }
  $("btn-shift-end").addEventListener("click", () => {
    close("dlg-shift");
    G.voice.stop();
    // Следующее «Продолжить» — уже новая смена.
    session.completed = 0; session.nextBreak = 5; session.startedAt = Date.now();
    homeNote = L(`Смена завершена. До завтра, ${kidName()}!`, `Shift complete. See you tomorrow, ${kidName()}!`);
    showHome();
  });
  $("btn-shift-more").addEventListener("click", () => {
    close("dlg-shift");
    session.nextBreak = session.completed + 2;
    startMission(Math.min(mission.id + 1, MISSIONS.length));
  });

  setInterval(() => {
    if (!session.startedAt) return;
    const t = Math.floor((Date.now() - session.startedAt) / 1000);
    session.minutes = Math.floor(t / 60);
  }, 1000);

  // ───────── Старт ракеты ─────────
  // Настоящая съёмка NASA (старт «Аполлона-11»); если видео не запустилось — нарисованный старт.
  async function playLaunch() {
    const { sleep } = G.world;
    const launchEl = $("launch"), cap = $("launch-caption"), v = $("launch-video");
    $("launch-svg").innerHTML = "";
    cap.textContent = "";
    launchEl.hidden = false;
    G.sound.music("launch");   // шум пультовой стихает, звучит музыка старта
    const video = await playLaunchVideo();
    if (!video) await playLaunchDrawn();
    cap.textContent = L(`${kidName().toUpperCase()}, ЭТО ТВОЯ РАКЕТА`, `${kidName().toUpperCase()}, THIS IS YOUR ROCKET`);
    await speak(L(`${kidName()}, это твоя ракета.`, `${kidName()}, this is your rocket.`));
    if (video) await videoAt(v, Infinity);   // досмотреть до конца
    await sleep(800);
    G.sound.stopMusic(1500);
    launchEl.hidden = true;
    v.pause();
    v.hidden = $("launch-credit").hidden = true;
    $("launch").classList.remove("is-video");
    $("launch-svg").hidden = false;
  }

  // Подписи по времени ролика (секунды): кадры зажигания, отрыва и ракеты над облаком.
  const LAUNCH_CUES = [
    { t: 1.6, cap: L("ЗАЖИГАНИЕ", "IGNITION"), say: L("Зажигание.", "Ignition.") },
    { t: 4.8, cap: L("ЕСТЬ ПОДЪЁМ", "LIFTOFF"), say: L("Есть подъём!", "Liftoff!") },
    { t: 12, cap: L("БАШНЯ ПРОЙДЕНА", "TOWER CLEARED"), say: L("Башня пройдена.", "Tower cleared.") },
  ];
  // Ждать момента ролика. Если видео застряло — не дольше, чем шёл бы сам ролик, плюс запас.
  function videoAt(v, t) {
    const deadline = Date.now() + 25000;
    return new Promise((res) => {
      const tick = () => (v.currentTime >= t || v.ended || v.error || Date.now() > deadline ? res() : setTimeout(tick, 100));
      tick();
    });
  }
  async function playLaunchVideo() {
    const v = $("launch-video");
    if (!v.canPlayType("video/mp4")) return false;
    v.hidden = false;
    $("launch-svg").hidden = true;
    v.currentTime = 0;
    const started = await Promise.race([v.play().then(() => true, () => false), G.world.sleep(6000).then(() => false)]);
    if (!started || v.error) {
      v.pause();
      v.hidden = true;
      $("launch-svg").hidden = false;
      return false;
    }
    $("launch-credit").hidden = false;
    $("launch").classList.add("is-video");
    for (const c of LAUNCH_CUES) {
      await videoAt(v, c.t);
      $("launch-caption").textContent = c.cap;
      speak(c.say);
    }
    await videoAt(v, 16);
    return true;
  }

  // ───────── Старт ракеты ─────────
  async function playLaunchDrawn() {
    const { el, tween } = G.world;
    const svg = $("launch-svg");
    svg.innerHTML = "";
    const defs = el("defs", {}, svg);
    const fl = el("radialGradient", { id: "flame", cx: "50%", cy: "20%", r: "80%" }, defs);
    el("stop", { offset: "0%", "stop-color": "#fff6d8" }, fl);
    el("stop", { offset: "45%", "stop-color": "#ffb347" }, fl);
    el("stop", { offset: "100%", "stop-color": "#ff5a1f", "stop-opacity": "0" }, fl);

    // Башня обслуживания (LUT) и стартовый стол.
    const tower = el("g", { class: "lut" }, svg);
    el("rect", { x: -22, y: -122, width: 9, height: 122 }, tower);
    for (let y = -118; y < 0; y += 6) el("path", { d: `M-22 ${y} L-13 ${y + 6} M-13 ${y} L-22 ${y + 6}` }, tower);
    el("rect", { x: -40, y: 0, width: 80, height: 8, class: "pad" }, svg);

    const ship = el("g", {}, svg);
    const flame = el("ellipse", { cx: 0, cy: 12, rx: 0, ry: 0, fill: "url(#flame)" }, ship);
    G.world.drawRocket(ship, G.levels.ROCKET.map((p) => p.id));
    const smoke = el("g", { class: "smoke" }, svg);

    const cap = $("launch-caption");
    cap.textContent = L("ЗАЖИГАНИЕ", "IGNITION");
    speak(L("Зажигание.", "Ignition."));
    await tween(1600, (p) => { flame.setAttribute("rx", 8 * p); flame.setAttribute("ry", 14 * p); });
    for (let i = 0; i < 14; i++) {
      const c = el("circle", { cx: (Math.random() - 0.5) * 30, cy: 4, r: 3 }, smoke);
      c.style.setProperty("--dx", (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 30) + "px");
      c.style.animationDelay = i * 60 + "ms";
    }
    cap.textContent = L("ЕСТЬ ПОДЪЁМ", "LIFTOFF");
    speak(L("Есть подъём!", "Liftoff!"));
    let flick = 0;
    await tween(7000, (p) => {
      const y = -Math.pow(p, 2.2) * 220;
      flick = (flick + 1) % 4;
      ship.setAttribute("transform", `translate(0 ${y})`);
      flame.setAttribute("ry", 16 + flick * 1.5 + p * 10);
    });
    cap.textContent = L("БАШНЯ ПРОЙДЕНА", "TOWER CLEARED");
    await speak(L("Башня пройдена.", "Tower cleared."));
  }

  // ───────── Нашивка экспедиции ─────────
  function drawPatch(host, size) {
    const { el } = G.world;
    const svg = el("svg", { viewBox: "-60 -60 120 120", width: size, height: size, class: "patch", role: "img", "aria-label": L("Нашивка экспедиции 1", "Expedition 1 patch") }, host);
    const defs = el("defs", {}, svg);
    el("path", { id: "patch-arc-top", d: "M-44 0 A44 44 0 0 1 44 0" }, defs);
    el("path", { id: "patch-arc-bot", d: "M-44 0 A44 44 0 0 0 44 0" }, defs);
    el("circle", { r: 58, class: "patch-rim" }, svg);
    el("circle", { r: 51, class: "patch-ring" }, svg);
    el("circle", { r: 37, class: "patch-sky" }, svg);
    el("circle", { cx: 16, cy: -16, r: 9, class: "patch-moon" }, svg);
    el("circle", { cx: 20, cy: -19, r: 8, class: "patch-sky" }, svg);
    const rk = el("g", { transform: "translate(-4 30) scale(0.52)" }, svg);
    G.world.drawRocket(rk, G.levels.ROCKET.map((p) => p.id));
    const top = el("text", { class: "patch-text" }, svg);
    const tp = el("textPath", { href: "#patch-arc-top", startOffset: "50%", "text-anchor": "middle" }, top);
    tp.textContent = L("ЭКСПЕДИЦИЯ 1 · ", "EXPEDITION 1 · ") + (progress.name ? progress.name.toUpperCase() : "VAB");
    const bot = el("text", { class: "patch-text" }, svg);
    const bp = el("textPath", { href: "#patch-arc-bot", startOffset: "50%", "text-anchor": "middle" }, bot);
    bp.textContent = L("БОРТ ", "DRONE ") + G.callsign;
    return svg;
  }

  function showPatch() {
    const box = $("patch-big");
    box.innerHTML = "";
    drawPatch(box, 220);
    renderPatchPhoto();
    open("dlg-patch");
    speak(L("Глава 1 пройдена.", "Chapter 1 complete."));
  }
  $("btn-patch-ok").addEventListener("click", () => { close("dlg-patch"); G.voice.stop(); showHome(); });

  // Для автотестов.
  G.debug = { get editor() { return editor; }, startMission, run };
})();
