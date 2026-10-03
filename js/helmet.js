// «Фото в шлеме»: портрет космонавта собирается прямо на устройстве — без сервера и без ИИ.
// Шаблоны (скафандр, шлем, ПИП) один раз нарисовал OpenAI без ребёнка (tools/gen-helmet-art.py),
// стекло шлема в них вырезано (tools/cut-helmet-art.py). Лицо ребёнка кладётся под шаблон.
// Взрослый подгоняет лицо (G.helmet.fit), из него рисуются аватарка (avatar) и фото у ракеты (ch1).
// Фото никуда не отправляется.
(function () {
  const G = (window.G = window.G || {});
  const S = 1024;                               // размер готовых картинок
  const FACE = 640;                             // вырезанное лицо: квадрат вокруг стекла
  // Шаблоны и рамка стекла в каждом (печатает tools/cut-helmet-art.py).
  const ART = {
    avatar: { src: "assets/helmet/avatar.webp", hole: { x: 292, y: 182, w: 340, h: 362 } },
    ch1: { src: "assets/helmet/ch1.webp", hole: { x: 324, y: 311, w: 241, h: 251 } },
  };

  function canvas(w, h = w) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  const loadImage = (src) => new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = fail;
    i.src = src;
  });
  const art = {};   // сцена → Promise<Image>
  const template = (scene) => (art[scene] = art[scene] || loadImage(ART[scene].src).catch((e) => { delete art[scene]; throw e; }));

  // Квадрат вокруг стекла: в него ложится вырезанное лицо.
  function faceBox(scene) {
    const { x, y, w, h } = ART[scene].hole;
    const side = Math.max(w, h);
    return { x: x + w / 2 - side / 2, y: y + h / 2 - side / 2, side };
  }

  // Лицо чуть теплее и с зерном — как плёнка шаблона.
  function film(ctx, x, y, w, h) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    const img = ctx.getImageData(x, y, Math.round(w), Math.round(h));
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      const l = 0.3 * r + 0.59 * g + 0.11 * b;
      r += (l - r) * 0.12; g += (l - g) * 0.12; b += (l - b) * 0.12;
      const n = (Math.random() - 0.5) * 14;
      d[i] = r * 1.03 + 5 + n; d[i + 1] = g + 2 + n; d[i + 2] = b * 0.94 + n;
    }
    ctx.putImageData(img, x, y);
  }

  // Стекло: края чуть темнее, сверху слева мягкий блик.
  function glass(ctx, scene) {
    const { x, y, w, h } = ART[scene].hole;
    const cx = x + w / 2, cy = y + h / 2, r = Math.max(w, h) / 2;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.clip();
    const dark = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    dark.addColorStop(0, "rgba(8,16,24,0)");
    dark.addColorStop(1, "rgba(8,16,24,0.4)");
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, w, h);
    const shine = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.6);
    shine.addColorStop(0, "rgba(255,255,255,0.22)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Собрать сцену: тёмный фон → лицо → шаблон со стеклом-дыркой → блик.
  function compose(ctx, scene, face, tpl, withFilm) {
    const b = faceBox(scene);
    ctx.fillStyle = "#1a242c";
    ctx.fillRect(0, 0, S, S);
    if (face) ctx.drawImage(face, b.x, b.y, b.side, b.side);
    if (withFilm) film(ctx, b.x, b.y, b.side, b.side);
    ctx.drawImage(tpl, 0, 0, S, S);
    glass(ctx, scene);
  }

  async function render(scene, faceSrc) {
    const [face, tpl] = await Promise.all([loadImage(faceSrc), template(scene)]);
    const c = canvas(S);
    compose(c.getContext("2d"), scene, face, tpl, true);
    return c.toDataURL("image/jpeg", 0.85);
  }
  const avatar = (faceSrc) => render("avatar", faceSrc);
  const expedition = (faceSrc) => render("ch1", faceSrc);

  // ───────── Подгонка лица: двигать пальцем, масштаб ползунком или двумя пальцами ─────────
  const $ = (id) => document.getElementById(id);

  function fit(file) {
    return new Promise(async (resolve) => {
      let bmp, tpl;
      try { [bmp, tpl] = await Promise.all([createImageBitmap(file), template("avatar")]); } catch { resolve(null); return; }
      const dlg = $("dlg-helmet"), view = $("helmet-canvas"), zoom = $("helmet-zoom");
      const vctx = view.getContext("2d");
      const faceC = canvas(FACE), fctx = faceC.getContext("2d");
      const base = FACE / Math.min(bmp.width, bmp.height);
      let z = 1.25, ox = 0, oy = FACE * 0.08;
      zoom.value = String(z);

      function draw() {
        const s = base * z;
        fctx.fillStyle = "#1a242c";
        fctx.fillRect(0, 0, FACE, FACE);
        fctx.drawImage(bmp, FACE / 2 - (bmp.width * s) / 2 + ox, FACE / 2 - (bmp.height * s) / 2 + oy, bmp.width * s, bmp.height * s);
        vctx.save();
        vctx.scale(view.width / S, view.height / S);
        compose(vctx, "avatar", faceC, tpl, false);
        vctx.restore();
      }
      // Сдвиг пальцем на экране → сдвиг в координатах вырезанного лица.
      const toFace = () => (S / view.getBoundingClientRect().width) * (FACE / faceBox("avatar").side);

      const pts = new Map();
      let pinch = null;
      function down(e) {
        view.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z };
        }
      }
      function move(e) {
        const p = pts.get(e.pointerId);
        if (!p) return;
        if (pts.size === 1) {
          const k = toFace();
          ox += (e.clientX - p.x) * k;
          oy += (e.clientY - p.y) * k;
        }
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          z = Math.min(4, Math.max(1, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
          zoom.value = String(z);
        }
        draw();
      }
      function up(e) {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
      }
      function wheel(e) {
        e.preventDefault();
        z = Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
        zoom.value = String(z);
        draw();
      }
      function onZoom() { z = Number(zoom.value); draw(); }

      function finish(ok) {
        view.removeEventListener("pointerdown", down);
        view.removeEventListener("pointermove", move);
        view.removeEventListener("pointerup", up);
        view.removeEventListener("pointercancel", up);
        view.removeEventListener("wheel", wheel);
        zoom.removeEventListener("input", onZoom);
        $("helmet-ok").onclick = $("helmet-cancel").onclick = null;
        dlg.hidden = true;
        if (bmp.close) bmp.close();
        resolve(ok ? faceC.toDataURL("image/jpeg", 0.88) : null);
      }
      view.addEventListener("pointerdown", down);
      view.addEventListener("pointermove", move);
      view.addEventListener("pointerup", up);
      view.addEventListener("pointercancel", up);
      view.addEventListener("wheel", wheel, { passive: false });
      zoom.addEventListener("input", onZoom);
      $("helmet-ok").onclick = () => finish(true);
      $("helmet-cancel").onclick = () => finish(false);
      dlg.hidden = false;
      draw();
      $("helmet-ok").focus();
    });
  }

  G.helmet = { fit, avatar, expedition };
})();
