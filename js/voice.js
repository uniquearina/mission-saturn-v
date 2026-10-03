// Голос: встроенный синтез речи браузера.
// Один голос на обе роли — разные движки в Chrome говорят одновременно.
// ЦУП — обычная интонация; БОРТ (бортовой компьютер) — ниже и медленнее.
// Фразы идут строго по очереди: следующая начинается, когда закончилась предыдущая.
(function () {
  const G = (window.G = window.G || {});
  // Сенсорный экран (телефон, планшет): меняет подсказки про клавиатуру.
  G.touch = window.matchMedia("(pointer: coarse)").matches;
  const synth = window.speechSynthesis || null;

  const ROLES = {
    cup: { rate: 1.0, pitch: 1.0 },
    bort: { rate: 0.9, pitch: 0.6 },
  };

  let voice = null;
  let muted = false;
  let token = 0;               // растёт при stop(): старые фразы из очереди не звучат
  let chain = Promise.resolve();

  function pickVoice() {
    if (!synth) return;
    const prefix = G.lang === "ru" ? /^ru/i : /^en/i;
    const list = synth.getVoices().filter((v) => prefix.test(v.lang));
    // Встроенные голоса надёжнее сетевых (Google): не обрываются и не накладываются.
    const good = /milena|yuri|samantha|daniel|karen|premium|enhanced/i;
    const score = (v) => (v.localService ? 0 : 10) + (good.test(v.name) ? 0 : 1) + (/^en-US/i.test(v.lang) || G.lang === "ru" ? 0 : 0.5);
    voice = list.sort((a, b) => score(a) - score(b))[0] || null;
  }
  if (synth) {
    pickVoice();
    synth.addEventListener?.("voiceschanged", pickVoice);
  }

  function speakNow(text, role, my) {
    return new Promise((resolve) => {
      if (my !== token || muted) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const r = ROLES[role] || ROLES.cup;
      u.lang = G.lang === "ru" ? "ru-RU" : "en-US";
      if (voice) u.voice = voice;
      u.rate = r.rate;
      u.pitch = r.pitch;
      let finished = false;
      const done = () => { if (!finished) { finished = true; clearTimeout(guard); resolve(); } };
      // Страховка, если браузер не пришлёт onend.
      let guard = 0;
      u.onend = done;
      u.onerror = done;
      // ЦУП: тон Квиндар перед фразой и после неё, как в радиосвязи «Аполлона».
      const quindar = role === "cup" && G.sound;
      if (quindar) u.onend = u.onerror = () => { G.sound.fx("quindarOut"); done(); };
      const start = () => {
        if (my !== token || muted) return resolve();
        guard = setTimeout(done, 2500 + text.length * 120);
        synth.speak(u);
      };
      if (quindar) { G.sound.fx("quindarIn"); setTimeout(start, 300); } else start();
    });
  }

  // Возвращает Promise, который выполняется, когда фраза договорена.
  function say(text, role = "cup") {
    if (!synth || muted || !text) return Promise.resolve();
    const my = token;
    chain = chain.then(() => speakNow(text, role, my));
    return chain;
  }

  G.voice = {
    say,
    stop() { token++; chain = Promise.resolve(); if (synth) synth.cancel(); },
    get muted() { return muted; },
    setMuted(m) { muted = m; if (m) this.stop(); },
    get available() { return !!synth; },
  };
})();
