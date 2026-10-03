// Портрет «ребёнок-космонавт»: исходное фото и готовые картинки (avatar, ch1). Хранятся в браузере.
// Два режима:
//   local — «фото в шлеме» (js/helmet.js): картинки собираются на устройстве, фото никуда не уходит;
//   ai    — для семьи (вошли по списку доверенных почт): рисует OpenAI, картинки ещё и в аккаунте.
(function () {
  const G = (window.G = window.G || {});
  try { localStorage.removeItem("saturn5.device"); } catch { /* без сохранения */ }   // номер устройства больше не нужен

  const keyFor = (kid) => "saturn5.portrait." + (kid ? "kid" + kid : "local");
  const kidNow = () => G.account.activeKid || null;
  const pending = {};   // scene → Promise
  const errors = {};    // scene → код ошибки последней попытки
  let adoptedTo = null; // профиль, в который перенесли фото этого устройства

  // Сохранить картинки в аккаунт (только для вошедших).
  const upload = (kid, data) => fetch("api/portrait", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kid, ...data }),
  }).catch(() => {});

  function read(kid) {
    try { return JSON.parse(localStorage.getItem(keyFor(kid))) || {}; } catch { return {}; }
  }
  function write(kid, data) {
    try { localStorage.setItem(keyFor(kid), JSON.stringify(data)); } catch { /* места нет — живём без сохранения */ }
  }

  G.portrait = {
    // Фото в шлеме работает везде, даже без сервера.
    available: true,
    // ИИ-портрет — только семье: без входа фото ребёнка никуда не отправляем.
    get mode() { return G.account.available && G.account.email ? "ai" : "local"; },
    onUpdate: null,

    get(kid = kidNow()) { return read(kid); },

    // Для вошедших — подтянуть картинки с сервера (например, сделанные на другом устройстве).
    async sync() {
      const kid = kidNow();
      if (!G.account.email || !kid) return;
      try {
        const d = await (await fetch("api/portrait?kid=" + kid, { credentials: "same-origin" })).json();
        if (d && (d.source || d.avatar || d.ch1)) write(kid, { ...read(kid), ...d });
      } catch { /* нет сети */ }
    },

    // Квадрат 768×768 из центра фото, JPEG — легко отправить и хранить.
    async prepare(file) {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const c = document.createElement("canvas");
      c.width = c.height = 768;
      c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 768, 768);
      return c.toDataURL("image/jpeg", 0.85);
    },

    // Выбрали фото: для шлема — взрослый подгоняет лицо в стекле, для ИИ — квадрат из центра.
    choose(file) {
      return this.mode === "local" ? G.helmet.fit(file) : this.prepare(file).catch(() => null);
    },

    // Новое фото: старые картинки больше не подходят.
    setSource(src) {
      const kid = kidNow();
      write(kid, { source: src });
      this.onUpdate && this.onUpdate();
    },

    isPending(scene) { return !!pending[scene]; },
    // Почему не получилось в прошлый раз: too_many, blocked, failed (или null).
    errorOf(scene) { return errors[scene] || null; },

    // Нарисовать сцену. Возвращает Promise с картинкой или null.
    generate(scene) {
      const kid = kidNow();
      const src = read(kid).source;
      if (!src) return Promise.resolve(null);
      if (pending[scene]) return pending[scene];
      delete errors[scene];
      const draw = this.mode === "local"
        ? (scene === "avatar" ? G.helmet.avatar(src) : G.helmet.expedition(src)).then((image) => ({ image }))
        : fetch("api/portrait", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ photo: src, scene, kid: kid || undefined }),
        }).then((r) => r.json());
      pending[scene] = draw
        .then(async (res) => {
          if (!res.image) { errors[scene] = res.error || "failed"; return null; }
          // Пока рисовали, взрослый мог войти по почте: тогда картинка — в профиль ребёнка и в аккаунт.
          const dest = kid || adoptedTo;
          write(dest, { ...read(dest), [scene]: res.image });
          if (!kid && dest) await upload(dest, { [scene]: res.image });
          return res.image;
        })
        .catch(() => { errors[scene] = "failed"; return null; })
        .finally(() => {
          delete pending[scene];
          this.onUpdate && this.onUpdate();
        });
      this.onUpdate && this.onUpdate();
      return pending[scene];
    },

    // После входа по почте: фото и картинки, сделанные на этом устройстве без входа, переходят в профиль ребёнка.
    // Картинки без исходного фото — это портрет, дорисованный уже после переноса: забираем и их.
    async adopt(kid) {
      const local = read(null), mine = read(kid);
      if (!Object.keys(local).length) return;
      if (local.source && mine.source && local.source !== mine.source) return;   // у ребёнка своё фото
      if (!local.source && !mine.source) return;
      const add = Object.fromEntries(Object.entries(local).filter(([k]) => !mine[k]));
      adoptedTo = kid;
      try { localStorage.removeItem(keyFor(null)); } catch { /* без сохранения */ }
      if (!Object.keys(add).length) return;
      write(kid, { ...mine, ...add });
      await upload(kid, add);
      this.onUpdate && this.onUpdate();
    },

    // Убрать из браузера картинки профилей, которых больше нет в аккаунте (удалили на сервере или с другого устройства).
    prune(kidIds) {
      try {
        for (const k of Object.keys(localStorage)) {
          const m = k.match(/^saturn5\.portrait\.kid(\d+)$/);
          if (m && !kidIds.includes(Number(m[1]))) localStorage.removeItem(k);
        }
      } catch { /* без сохранения */ }
    },

    async remove() {
      const kid = kidNow();
      try { localStorage.removeItem(keyFor(kid)); } catch { /* без сохранения */ }
      if (G.account.email && kid) await fetch("api/portrait?kid=" + kid, { method: "DELETE", credentials: "same-origin" }).catch(() => {});
      this.onUpdate && this.onUpdate();
    },
  };
})();
