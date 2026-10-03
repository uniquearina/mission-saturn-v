// Вход для семьи и профили детей. Работает только там, где есть сервер (Cloudflare);
// на claude.ai и при локальном запуске available = false, и игра живёт в браузере, как раньше.
// Вход — только по списку доверенных почт: владелец входит по письму, родные — по ссылке-приглашению.
(function () {
  const G = (window.G = window.G || {});

  async function api(path, opts = {}) {
    const r = await fetch("api/" + path, {
      credentials: "same-origin",
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
    });
    let data = null;
    try { data = await r.json(); } catch { /* не JSON */ }
    return { status: r.status, ok: r.ok, data };
  }

  let saveTimer = null, pending = null;

  G.account = {
    available: false,   // есть ли сервер
    email: null,        // кто вошёл
    owner: false,       // вошёл владелец игры: ему доступен список семьи
    kids: [],           // профили: { id, callsign (на сервере — имя ребёнка), progress }
    activeKid: null,

    async init() {
      try {
        const r = await fetch("api/me", { credentials: "same-origin" });
        if (!(r.headers.get("content-type") || "").includes("application/json")) return;
        this.available = true;
        if (r.ok) {
          const d = await r.json();
          this.email = d.email || null;
          this.owner = !!d.owner;
          this.kids = d.email ? d.kids : [];
        } else {
          this.email = null;
          this.owner = false;
          this.kids = [];
        }
      } catch { /* сервера нет */ }
    },

    requestLink(email) {
      return api("login", { method: "POST", body: JSON.stringify({ email, lang: G.lang }) });
    },

    async verify(token) {
      const r = await api("verify", { method: "POST", body: JSON.stringify({ token }) });
      if (r.ok) await this.init();
      return r;
    },

    async createKid(callsign, progress) {
      const r = await api("kids", { method: "POST", body: JSON.stringify({ callsign, progress }) });
      if (!r.ok) return null;
      this.kids.push(r.data);
      return r.data;
    },

    // Сохранение с задержкой: не дёргаем сервер на каждое изменение.
    save(progress) {
      if (!this.activeKid) return;
      const kid = this.kids.find((k) => k.id === this.activeKid);
      const copy = JSON.parse(JSON.stringify(progress));
      if (kid) { kid.progress = copy; kid.callsign = copy.name || kid.callsign; }
      pending = { progress: copy, callsign: copy.name || undefined };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => this.flush(), 700);
    },

    async flush() {
      if (!pending || !this.activeKid) return;
      const body = JSON.stringify(pending);
      pending = null;
      await api("kids/" + this.activeKid, { method: "PUT", body, keepalive: true }).catch(() => {});
    },

    async deleteKid(id) {
      const r = await api("kids/" + id, { method: "DELETE" });
      if (r.ok) {
        this.kids = this.kids.filter((k) => k.id !== id);
        if (this.activeKid === id) { this.activeKid = null; pending = null; }
      }
      return r.ok;
    },

    // Семья (только владелец): список почт, приглашение (добавить или новая ссылка), убрать.
    familyList() { return api("family"); },
    familyInvite(email) { return api("family", { method: "POST", body: JSON.stringify({ email }) }); },
    familyRemove(email) { return api("family?email=" + encodeURIComponent(email), { method: "DELETE" }); },

    async logout() {
      await this.flush();
      await api("logout", { method: "POST", body: "{}" }).catch(() => {});
      this.email = null;
      this.owner = false;
      this.kids = [];
      this.activeKid = null;
    },
  };

  addEventListener("pagehide", () => G.account.flush());
})();
