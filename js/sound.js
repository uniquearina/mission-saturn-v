// Звук: эффекты синтезом (Web Audio, без файлов) и музыка (Suno, assets/audio).
// Тоны Квиндар — настоящие короткие сигналы радиосвязи «Аполлона»: 2525 Гц в начале передачи ЦУП и 2475 Гц в конце.
// Музыка звучит тихо и приглушается, пока говорит голос. Её можно выключить («без музыки»), эффекты остаются.
(function () {
  const G = (window.G = window.G || {});
  const MUSIC_KEY = "saturn5.music";
  let ctx = null, master = null, noiseBuf = null;

  // Звук в браузере включается только после нажатия — вызываем unlock() из обработчика клика.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    // Safari разрешает звук только в момент нажатия. Запускаем плееры беззвучно прямо сейчас —
    // потом их можно включить и без нажатия (например, после проверки входа).
    for (const name of ["home", "launch"]) {
      const a = track(name);
      if (a._primed || !a.paused) continue;
      a._primed = true;
      a.muted = true;
      a.play().then(() => { if (current !== name || !musicOn) a.pause(); a.muted = false; })
        .catch(() => { a.muted = false; a._primed = false; });
    }
    if (ambWanted && !amb) ambience(true);   // миссия открылась раньше, чем звук разрешили
  }

  // Тон с огибающей: частота, длительность, громкость, форма волны, задержка, скольжение частоты.
  function tone(freq, dur, vol, type = "sine", at = 0, slideTo = null) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Шум через полосовой фильтр: винты, щелчки, гул крана.
  function noise(dur, vol, freq, q = 1, at = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.04, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  const FX = {
    // Шаг дрона: гул винтов на время перелёта.
    move(ms = 320) { const d = ms / 1000; noise(d, 0.05, 220, 2); tone(140, d, 0.015, "sawtooth", 0, 165); },
    // Упёрся в ферму или стену.
    bump() { tone(90, 0.18, 0.12, "triangle"); noise(0.08, 0.08, 900, 3); },
    // Захват защёлкнулся.
    grab() { noise(0.04, 0.12, 2400, 4); tone(520, 0.06, 0.05, "square", 0.03); tone(380, 0.08, 0.04, "square", 0.08); },
    // Кран поднимает деталь к ракете.
    crane(ms = 960) { const d = ms / 1000; tone(70, d, 0.05, "sawtooth", 0, 95); noise(d, 0.03, 400, 1.5); tone(110, 0.25, 0.1, "triangle", d); },
    // Ошибка: двойной сигнал, как тревога на пульте.
    error() { tone(660, 0.14, 0.05, "square"); tone(495, 0.2, 0.05, "square", 0.17); },
    // Миссия выполнена: короткий восходящий аккорд.
    success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 0.07, "sine", i * 0.09)); },
    quindarIn() { tone(2525, 0.25, 0.025, "sine"); },
    quindarOut() { tone(2475, 0.25, 0.025, "sine"); },
  };

  // ───────── Музыка ─────────
  const tracks = {};
  let current = null, musicOn = true, ducked = false;
  try { musicOn = localStorage.getItem(MUSIC_KEY) !== "off"; } catch { /* по умолчанию включена */ }
  const LEVEL = { home: 0.5, launch: 0.95 };    // фон главной — потише, старт — во всю силу
  const DUCK = 0.5;                              // доля громкости, пока говорит голос

  function track(name) {
    if (!tracks[name]) {
      const a = new Audio(`assets/audio/${name === "home" ? "home-loop" : "launch"}.mp3`);
      a.loop = name === "home";
      a.preload = "auto";
      a.volume = 0;
      tracks[name] = a;
    }
    return tracks[name];
  }
  const target = (name) => (musicOn ? LEVEL[name] * (ducked ? DUCK : 1) : 0);

  // Плавно подвести громкость к нужной (по шагам, чтобы работало и в Safari).
  function fadeTo(a, vol, ms = 600) {
    clearInterval(a._fade);
    const from = a.volume, t0 = performance.now();
    a._fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (vol - from) * k));
      if (k >= 1) { clearInterval(a._fade); if (vol === 0 && a !== tracks[current]) a.pause(); }
    }, 40);
  }

  function play(name) {
    if (current === name && (!musicOn || !tracks[name].paused)) return;
    if (current !== name) stop();
    current = name;
    const a = track(name);
    if (name === "launch" && a.paused) a.currentTime = 0;
    if (!musicOn) return;
    start(a, name);
  }
  // Браузер может не дать включить звук без нажатия. Тогда пробуем снова при следующем нажатии.
  function start(a, name) {
    a.play().then(() => fadeTo(a, target(name))).catch(() => {
      addEventListener("pointerdown", () => { if (current === name && musicOn && a.paused) start(a, name); }, { once: true });
    });
  }
  function stop(ms = 800) {
    if (!current) return;
    const a = tracks[current];
    current = null;
    fadeTo(a, 0, ms);
  }

  // ───────── Шум пультовой (в миссиях вместо музыки) ─────────
  // Гул аппаратуры (бурый шум ниже 400 Гц), еле слышный фон сети 60 Гц и редкий треск радиопомех.
  let amb = null, ambWanted = false;   // ambWanted — шум нужен сейчас (идёт миссия)
  const AMB_LEVEL = 0.09;
  function ambience(on) {
    ambWanted = on;
    if (on && !amb && musicOn && ctx) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      // Бурый шум: 4 секунды по кругу.
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter();
      src.buffer = buf; src.loop = true;
      lp.type = "lowpass"; lp.frequency.value = 400;
      src.connect(lp).connect(g);
      const hums = [[60, 0.05], [120, 0.025]].map(([f, v]) => {
        const o = ctx.createOscillator(), hg = ctx.createGain();
        o.frequency.value = f; hg.gain.value = v;
        o.connect(hg).connect(g); o.start();
        return o;
      });
      src.start();
      // Радиопомехи: короткий треск раз в 6–14 секунд.
      const crackle = () => {
        if (!amb) return;
        if (!ducked) noise(0.5 + Math.random() * 0.5, 0.012, 1500 + Math.random() * 1500, 0.8);
        amb.timer = setTimeout(crackle, 6000 + Math.random() * 8000);
      };
      amb = { g, src, hums, timer: setTimeout(crackle, 4000) };
      ambLevel(1.5);
    } else if (!on && amb) {
      const a = amb;
      amb = null;
      clearTimeout(a.timer);
      const t = ctx.currentTime;
      a.g.gain.cancelScheduledValues(t);
      a.g.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => { a.src.stop(); a.hums.forEach((o) => o.stop()); a.g.disconnect(); }, 1500);
    }
  }
  // Громкость шума: тише под голос, ноль без музыки.
  function ambLevel(sec = 0.3) {
    if (!amb) return;
    const v = musicOn ? AMB_LEVEL * (ducked ? DUCK : 1) : 0;
    amb.g.gain.cancelScheduledValues(ctx.currentTime);
    amb.g.gain.setTargetAtTime(v, ctx.currentTime, sec / 3);
  }

  // Вернулись на вкладку (телефон гасил экран) — продолжить музыку.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !current || !musicOn) return;
    const a = tracks[current];
    if (a && a.paused && current === "home") start(a, current);
  });

  // Голос говорит → музыка тише.
  setInterval(() => {
    const now = !!(window.speechSynthesis && speechSynthesis.speaking);
    if (now === ducked) return;
    ducked = now;
    ambLevel();
    if (current) fadeTo(tracks[current], target(current), 300);
  }, 150);

  G.sound = {
    unlock,
    fx(name, arg) { try { FX[name] && FX[name](arg); } catch { /* звук не обязателен */ } },
    music(name) { ambience(false); play(name); },
    stopMusic: stop,
    ambience,
    get ambienceOn() { return !!amb; },   // для автотестов
    get musicOn() { return musicOn; },
    get playing() { return current && !tracks[current].paused ? current : null; },   // для автотестов
    get level() { return current ? Math.round(tracks[current].volume * 100) / 100 : 0; },
    setMusic(on) {
      musicOn = on;
      try { localStorage.setItem(MUSIC_KEY, on ? "on" : "off"); } catch { /* без сохранения */ }
      if (on && ambWanted && !amb) ambience(true);
      ambLevel();
      if (!current) return;
      const a = tracks[current];
      if (on) { if (a.paused) start(a, current); else fadeTo(a, target(current)); }
      else fadeTo(a, 0, 300);
    },
  };
})();
