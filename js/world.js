// Сцена: монтажный корпус (вид сбоку), дрон, детали, проигрывание программы.
// И Сатурн-5 в настоящем масштабе — в боковой панели и в ролике старта.
(function () {
  const G = (window.G = window.G || {});
  const NS = "http://www.w3.org/2000/svg";
  const C = 100;                   // размер клетки в единицах SVG
  const M = { l: 64, t: 34, r: 18, b: 56 };

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tween(ms, fn) {
    if (reduced()) { fn(1); return Promise.resolve(); }
    return new Promise((resolve) => {
      const t0 = performance.now();
      function frame(now) {
        const p = Math.min(1, (now - t0) / ms);
        fn(p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
        if (p < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ───────── Детали ракеты в горизонтальном положении (как их привозят в корпус) ─────────
  function drawPart(id, parent) {
    const g = el("g", { class: "part", "data-id": id }, parent);
    const body = (x, y, w, h) => el("rect", { x, y, width: w, height: h, rx: 3, class: "part-body" }, g);
    const bell = (x, y) => el("path", { d: `M${x} ${y - 5} L${x - 8} ${y - 8} L${x - 8} ${y + 8} L${x} ${y + 5} Z`, class: "part-bell" }, g);
    const label = (txt, x) => el("text", { x, y: 5, class: "part-label", "text-anchor": "middle" }, g).textContent = txt;
    if (id === "S-IC") {
      body(-34, -20, 72, 40); bell(-34, -10); bell(-34, 10);
      el("rect", { x: -34, y: -20, width: 14, height: 20, class: "part-roll" }, g);
      el("rect", { x: -20, y: 0, width: 14, height: 20, class: "part-roll" }, g);
      label("S-IC", 12);
    } else if (id === "S-II") {
      body(-30, -20, 64, 40); bell(-30, -8); bell(-30, 8);
      el("rect", { x: -30, y: -20, width: 6, height: 40, class: "part-roll" }, g);
      label("S-II", 4);
    } else if (id === "S-IVB") {
      el("path", { d: "M-32 -19 L-20 -14 L-20 14 L-32 19 Z", class: "part-body" }, g);
      body(-20, -14, 54, 28); bell(-32, 0);
      el("rect", { x: -20, y: -14, width: 10, height: 14, class: "part-roll" }, g);
      label("S-IVB", 13);
    } else if (id === "IU") {
      el("rect", { x: -9, y: -18, width: 18, height: 36, rx: 2, class: "part-body part-iu" }, g);
      for (let i = -12; i <= 12; i += 8) el("line", { x1: -9, x2: 9, y1: i, y2: i, class: "part-line" }, g);
      el("text", { x: 0, y: 34, class: "part-label is-out", "text-anchor": "middle" }, g).textContent = "IU";
    } else if (id === "FLAG") {
      // Красная лента «Remove before flight».
      el("line", { x1: 0, y1: -20, x2: 0, y2: -11, class: "part-line" }, g);
      el("path", { d: "M-32 -11 H32 V11 H-32 Z", class: "part-flag" }, g);
      el("text", { x: 0, y: -1, class: "part-flag-text", "text-anchor": "middle" }, g).textContent = "REMOVE BEFORE";
      el("text", { x: 0, y: 7, class: "part-flag-text", "text-anchor": "middle" }, g).textContent = "FLIGHT";
      el("text", { x: 0, y: 30, class: "part-label is-out", "text-anchor": "middle" }, g).textContent = G.L("ФЛАЖОК", "FLAG");
    } else if (id === "APOLLO") {
      el("path", { d: "M-36 -14 L-14 -9 L-14 9 L-36 14 Z", class: "part-body" }, g);  // переходник с лунным модулем
      body(-14, -9, 16, 18);                                                           // служебный модуль
      el("path", { d: "M2 -9 L14 -3 L14 3 L2 9 Z", class: "part-body part-cm" }, g);  // командный модуль
      el("line", { x1: 14, y1: 0, x2: 36, y2: 0, class: "part-les" }, g);             // система спасения
      el("rect", { x: 22, y: -2, width: 10, height: 4, class: "part-body" }, g);
      el("text", { x: -6, y: 30, class: "part-label is-out", "text-anchor": "middle" }, g).textContent = G.L("АПОЛЛОН", "APOLLO");
    }
    return g;
  }

  // ───────── Дрон ─────────
  function drawDrone(parent) {
    const g = el("g", { class: "drone" }, parent);
    el("circle", { r: 46, cy: -4, class: "drone-ring" }, g);
    if (G.callsign) {
      el("text", { x: 0, y: -34, class: "drone-tag", "text-anchor": "middle" }, g).textContent = G.callsign.toUpperCase();
    }
    const hold = el("g", { class: "drone-hold", transform: "translate(0 30)" }, g);
    el("line", { x1: -26, y1: -14, x2: 26, y2: -14, class: "drone-arm" }, g);
    for (const x of [-30, 30]) {
      el("line", { x1: x, y1: -14, x2: x, y2: -20, class: "drone-arm" }, g);
      el("ellipse", { cx: x, cy: -22, rx: 16, ry: 3, class: "drone-rotor" }, g);
    }
    el("rect", { x: -20, y: -12, width: 40, height: 18, rx: 4, class: "drone-body" }, g);
    el("rect", { x: -12, y: -7, width: 16, height: 6, rx: 1, class: "drone-visor" }, g);
    el("circle", { cx: 12, cy: -3, r: 2.6, class: "drone-lamp" }, g);
    el("path", { d: "M-8 6 L-8 14 L-4 18 M8 6 L8 14 L4 18", class: "drone-claw" }, g);
    const waves = el("g", { class: "drone-waves" }, g);
    for (const r of [10, 18, 26]) el("path", { d: `M${20 + r * 0.3} ${-18 - r * 0.6} a${r} ${r} 0 0 1 ${r * 0.7} ${r * 0.7}`, class: "wave" }, waves);
    return { g, hold, waves };
  }

  // ───────── Сцена ─────────
  function createScene(svg) {
    const { cols, rows } = G.levels.GRID;
    const W = M.l + cols * C + M.r, H = M.t + rows * C + M.b;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const px = (x) => M.l + x * C + C / 2;
    const py = (y) => M.t + (rows - 1 - y) * C + C / 2;

    let mission = null, state = null, nodes = null;

    function build() {
      svg.innerHTML = "";
      const defs = el("defs", {}, svg);
      const pat = el("pattern", { id: "bp", width: 20, height: 20, patternUnits: "userSpaceOnUse" }, defs);
      el("path", { d: "M20 0 L0 0 0 20", class: "bp-line" }, pat);
      const hz = el("pattern", { id: "hz", width: 16, height: 16, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
      el("rect", { width: 8, height: 16, class: "hz-a" }, hz);

      el("rect", { x: 0, y: 0, width: W, height: H, class: "scene-bg" }, svg);
      el("rect", { x: M.l, y: M.t, width: cols * C, height: rows * C, fill: "url(#bp)" }, svg);

      // Подписи осей: ярусы слева, столбцы снизу.
      for (let y = 0; y < rows; y++) {
        el("text", { x: M.l - 14, y: py(y) + 5, class: "axis", "text-anchor": "end" }, svg).textContent = y + 1;
      }
      for (let x = 0; x < cols; x++) {
        el("text", { x: px(x), y: M.t + rows * C + 42, class: "axis", "text-anchor": "middle" }, svg).textContent = x + 1;
      }
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        el("rect", { x: M.l + x * C + 3, y: M.t + (rows - 1 - y) * C + 3, width: C - 6, height: C - 6, rx: 4, class: "cell" }, svg);
      }
      // Пол корпуса.
      el("rect", { x: M.l, y: M.t + rows * C, width: cols * C, height: 12, fill: "url(#hz)", class: "floor" }, svg);
      el("line", { x1: M.l, x2: M.l + cols * C, y1: M.t + rows * C, y2: M.t + rows * C, class: "floor-line" }, svg);

      // ПРИЁМ: площадка под кран.
      const P = G.levels.PLATFORM;
      const pg = el("g", { class: "platform" + (mission.places ? " is-goal" : "") }, svg);
      el("rect", { x: M.l + P.x * C + 3, y: M.t + (rows - 1 - P.y) * C + 3, width: C - 6, height: C - 6, rx: 6, class: "goal-cell" }, pg);
      el("line", { x1: px(P.x), x2: px(P.x), y1: 0, y2: py(P.y) - 40, class: "crane-cable" }, pg);
      el("path", { d: `M${px(P.x) - 7} ${py(P.y) - 40} q7 10 14 0`, class: "crane-hook" }, pg);
      el("rect", { x: M.l + P.x * C + 8, y: py(P.y) + 30, width: C - 16, height: 12, class: "platform-base" }, pg);
      el("text", { x: px(P.x), y: py(P.y) + 26, class: "platform-label", "text-anchor": "middle" }, pg).textContent = G.L("ПРИЁМ", "PAD");
      if (mission.places) {
        const tag = el("g", { class: "goal-tag", transform: `translate(${px(P.x)} ${py(P.y) - 36})` }, pg);
        el("rect", { x: -40, y: -9, width: 80, height: 18, rx: 4 }, tag);
        el("text", { x: 0, y: 5, "text-anchor": "middle" }, tag).textContent = G.L("ПОСТАВИТЬ", "PUT HERE");
      }

      // Фермы.
      for (const [gx, gy] of mission.girders) {
        const x0 = M.l + gx * C + 6, y0 = M.t + (rows - 1 - gy) * C + 6, s = C - 12;
        const gg = el("g", { class: "girder" }, svg);
        el("rect", { x: x0, y: y0, width: s, height: s }, gg);
        el("path", { d: `M${x0} ${y0} L${x0 + s} ${y0 + s} M${x0 + s} ${y0} L${x0} ${y0 + s} M${x0} ${y0 + s / 2} L${x0 + s} ${y0 + s / 2}` }, gg);
      }

      // Детали (на стеллажах, если не на полу).
      const partNodes = {};
      for (const p of state.parts) {
        if (p.y > 0) el("line", { x1: px(p.x) - 40, x2: px(p.x) + 40, y1: py(p.y) + 36, y2: py(p.y) + 36, class: "rack" }, svg);
        const n = drawPart(p.id, svg);
        n.setAttribute("transform", `translate(${px(p.x)} ${py(p.y) + 10})`);
        // Метка цели: что взять.
        el("rect", { x: -C / 2 + 3, y: -C / 2 - 7, width: C - 6, height: C - 6, rx: 6, class: "goal-cell" }, n);
        const tag = el("g", { class: "goal-tag", transform: `translate(0 ${-C / 2 + 4})` }, n);
        el("rect", { x: -26, y: -9, width: 52, height: 18, rx: 4 }, tag);
        el("text", { x: 0, y: 5, "text-anchor": "middle" }, tag).textContent = G.L("ВЗЯТЬ", "GRAB");
        partNodes[p.id] = n;
      }

      const drone = drawDrone(svg);
      if (state.drone.holding) {
        const n = drawPart(state.drone.holding, drone.hold);
        n.setAttribute("transform", "scale(0.8)");
      }
      nodes = { drone, partNodes };
      placeDrone();
    }

    function placeDrone(dx = 0, dy = 0) {
      const x = px(state.drone.x) + dx, y = py(state.drone.y) - 14 + dy;
      nodes.drone.g.setAttribute("transform", `translate(${x} ${y})`);
    }

    function load(m) {
      mission = m;
      state = {
        drone: { x: m.drone.x, y: m.drone.y, holding: m.drone.holding || null },
        parts: m.parts.map((p) => ({ ...p })),
        stack: [], prints: [], launched: false,
      };
      build();
    }

    async function flash(cls, ms = 900) {
      nodes.drone.g.classList.add(cls);
      await sleep(ms);
      nodes.drone.g.classList.remove(cls);
    }

    const blocked = (x, y) => mission.girders.some(([gx, gy]) => gx === x && gy === y);

    async function step(dx, dy, speed) {
      const nx = state.drone.x + dx, ny = state.drone.y + dy;
      const out = nx < 0 || ny < 0 || nx >= cols || ny >= rows;
      if (out || blocked(nx, ny)) {
        // Дрон дёргается в сторону препятствия и возвращается.
        G.sound && G.sound.fx("bump");
        await tween(speed * 0.5, (p) => placeDrone(dx * C * 0.25 * Math.sin(p * Math.PI), -dy * C * 0.25 * Math.sin(p * Math.PI)));
        return out ? "wall" : "girder";
      }
      const x0 = state.drone.x, y0 = state.drone.y;
      G.sound && G.sound.fx("move", speed);
      await tween(speed, (p) => {
        nodes.drone.g.setAttribute("transform",
          `translate(${px(x0 + dx * p)} ${py(y0 + dy * p) - 14})`);
      });
      state.drone.x = nx; state.drone.y = ny;
      return null;
    }

    const DIRS = { right: [1, 0], left: [-1, 0], up: [0, 1], down: [0, -1] };

    // Проиграть действия. hooks: onLine(n), onPrint(text) → Promise, onPlaced(id).
    // Возвращает { error: msg | null, ctx }.
    async function play(actions, hooks, speed = 320) {
      const F = G.errors.FLIGHT;
      for (const a of actions) {
        hooks.onLine && hooks.onLine(a.line);
        if (DIRS[a.op]) {
          const [dx, dy] = DIRS[a.op];
          for (let i = 0; i < a.n; i++) {
            const err = await step(dx, dy, speed);
            if (err) { await flash("is-alert"); return { error: F[err](), line: a.line, ctx: state }; }
          }
          if (a.n === 0) await sleep(speed / 2);
        } else if (a.op === "grab") {
          if (state.drone.holding) { await flash("is-alert"); return { error: F.grabFull(), line: a.line, ctx: state }; }
          const p = state.parts.find((q) => q.x === state.drone.x && q.y === state.drone.y);
          if (!p) { await flash("is-alert"); return { error: F.grabEmpty(), line: a.line, ctx: state }; }
          const node = nodes.partNodes[p.id];
          G.sound && G.sound.fx("grab");
          const startY = 10 + 14, endY = 30 + 0;
          await tween(speed, (k) => node.setAttribute("transform", `translate(${px(p.x)} ${py(p.y) + startY - 14 - (startY - endY) * k * 0.4})`));
          node.remove();
          const held = drawPart(p.id, nodes.drone.hold);
          held.setAttribute("transform", "scale(0.8)");
          state.parts = state.parts.filter((q) => q !== p);
          state.drone.holding = p.id;
          await sleep(speed / 2);
        } else if (a.op === "drop") {
          if (!state.drone.holding) { await flash("is-alert"); return { error: F.dropEmpty(), line: a.line, ctx: state }; }
          const P = G.levels.PLATFORM;
          if (state.drone.x !== P.x || state.drone.y !== P.y) { await flash("is-alert"); return { error: F.dropWrong(), line: a.line, ctx: state }; }
          const id = state.drone.holding;
          state.drone.holding = null;
          nodes.drone.hold.innerHTML = "";
          // Кран поднимает деталь наверх, к ракете.
          const lifted = drawPart(id, svg);
          const x = px(P.x), y0 = py(P.y) + 10;
          G.sound && G.sound.fx("crane", speed * 3);
          await tween(speed * 3, (k) => {
            lifted.setAttribute("transform", `translate(${x} ${y0 - k * (y0 + 60)}) rotate(${-90 * k})`);
          });
          lifted.remove();
          state.stack.push(id);
          hooks.onPlaced && hooks.onPlaced(id);
        } else if (a.op === "print") {
          state.prints.push(a.text);
          nodes.drone.waves.classList.add("is-on");
          await (hooks.onPrint ? hooks.onPrint(a.text) : sleep(600));
          nodes.drone.waves.classList.remove("is-on");
        } else if (a.op === "launch") {
          if (!mission.allowLaunch) { await flash("is-alert"); return { error: F.launchLocked(), line: a.line, ctx: state }; }
          const nums = state.prints.map((t) => t.trim()).join(",");
          if (!nums.endsWith("10,9,8,7,6,5,4,3,2,1")) {
            await flash("is-alert");
            return { error: F.launchEarly(), line: a.line, ctx: state };
          }
          state.launched = true;
        }
      }
      return { error: null, ctx: state };
    }

    // Дрон-инструктор: тот же дрон, но полупрозрачный — показывает образец.
    function ghost(on) { nodes.drone.g.classList.toggle("is-ghost", on); }

    return { load, play, ghost, get state() { return state; } };
  }

  // ───────── Сатурн-5 в масштабе (метры) ─────────
  // Рисует ракету снизу вверх. placed — id установленных деталей.
  function drawRocket(parent, placed, opts = {}) {
    const ground = opts.ground ?? 0;
    const g = el("g", { class: "rocket" }, parent);
    let y = ground;
    const seg = (id, fn) => {
      const part = G.levels.ROCKET.find((p) => p.id === id);
      const on = placed.includes(id);
      const sg = el("g", { class: "rk-seg " + (on ? "is-on" : "is-off"), "data-id": id }, g);
      fn(sg, y, part);
      y -= part.h;
      return sg;
    };
    const rect = (p, x, y, w, h, cls = "rk-white") => el("rect", { x, y, width: w, height: h, class: cls }, p);
    const poly = (p, pts, cls = "rk-white") => el("polygon", { points: pts.map((q) => q.join(",")).join(" "), class: cls }, p);

    seg("S-IC", (p, b, part) => {
      // Двигатели F-1 входят в высоту ступени (42,1 м), поэтому корпус кончается выше земли.
      const r = part.d / 2, top = b - part.h, e = 5.8, base = b - e;
      for (const x of [-3.6, 0, 3.6]) poly(p, [[x - 1.1, base], [x + 1.1, base], [x + 1.9, b], [x - 1.9, b]], "rk-engine");
      poly(p, [[-r, base - 9], [-r - 2.6, b], [-r, b - 2]], "rk-fin");
      poly(p, [[r, base - 9], [r + 2.6, b], [r, b - 2]], "rk-fin");
      rect(p, -r, top, part.d, part.h - e);
      rect(p, -r, base - 9, r, 9, "rk-black");
      rect(p, 0, top + 13, r, 9, "rk-black");
      rect(p, -r, top, part.d, 1.4, "rk-black");
    });
    seg("S-II", (p, b, part) => {
      const r = part.d / 2;
      rect(p, -r, b - part.h, part.d, part.h);
      rect(p, -r, b - 5.5, part.d, 5.5, "rk-band");
    });
    seg("S-IVB", (p, b, part) => {
      const r = part.d / 2, R = 10.1 / 2;
      poly(p, [[-R, b], [R, b], [r, b - 5.5], [-r, b - 5.5]]);
      rect(p, -r, b - part.h, part.d, part.h - 5.5);
      rect(p, -r, b - 9.5, r, 4, "rk-black");
    });
    seg("IU", (p, b, part) => { rect(p, -part.d / 2, b - part.h, part.d, part.h, "rk-iu"); });
    seg("APOLLO", (p, b) => {
      const sla = 8.5, sm = 4.0, cm = 3.5, les = 8.9;
      poly(p, [[-3.3, b], [3.3, b], [1.95, b - sla], [-1.95, b - sla]]);
      rect(p, -1.95, b - sla - sm, 3.9, sm, "rk-sm");
      poly(p, [[-1.95, b - sla - sm], [1.95, b - sla - sm], [0.5, b - sla - sm - cm], [-0.5, b - sla - sm - cm]], "rk-cm");
      const t = b - sla - sm - cm;
      el("line", { x1: 0, y1: t, x2: 0, y2: t - les + 1.2, class: "rk-les" }, p);
      poly(p, [[-0.45, t - les + 4], [0.45, t - les + 4], [0.45, t - les + 1.2], [0, t - les], [-0.45, t - les + 1.2]], "rk-white");
    });
    return g;
  }

  function renderRocketPanel(svg, placed, justPlaced, opts = {}) {
    svg.innerHTML = "";
    svg.setAttribute("viewBox", "-17 -118 34 128");
    // Шкала высоты через каждые 20 м.
    for (let m = 0; m <= 80; m += 20) {
      el("line", { x1: -16, x2: -13.5, y1: -m, y2: -m, class: "rk-tick" }, svg);
      el("text", { x: -16, y: -m - 1, class: "rk-scale" }, svg).textContent = m;
    }
    el("line", { x1: -16, x2: 16, y1: 0, y2: 0, class: "rk-ground" }, svg);
    // Мерка для сравнения (девятиэтажка или статуя Свободы) — линия за ракетой.
    if (opts.ref !== false) {
      const ref = G.levels.SCALE_REF;
      el("line", { x1: -16, x2: 16, y1: -ref.h, y2: -ref.h, class: "rk-ref" }, svg);
      el("text", { x: -16, y: -ref.h - 4.5, class: "rk-scale rk-ref-label" }, svg).textContent = ref.label[0];
      el("text", { x: -16, y: -ref.h - 1.2, class: "rk-scale rk-ref-label" }, svg).textContent = ref.label[1];
    }
    drawRocket(svg, placed);
    const h = G.levels.ROCKET.filter((p) => placed.includes(p.id)).reduce((s, p) => s + p.h, 0);
    if (justPlaced) {
      const node = svg.querySelector(`[data-id="${justPlaced}"]`);
      if (node) node.classList.add("is-new");
    }
    return Math.round(h * 10) / 10;
  }

  G.world = { createScene, drawRocket, drawDrone, drawPart, renderRocketPanel, el, sleep, tween };
})();
