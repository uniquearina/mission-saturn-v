// Язык игры: русский, если браузер на русском, иначе английский.
// L("рус", "eng") — выбрать строку; статические тексты страницы — из атрибутов data-en*.
(function () {
  const G = (window.G = window.G || {});
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  G.lang = /^ru\b|^ru-/i.test(nav) ? "ru" : "en";
  G.L = (ru, en) => (G.lang === "ru" ? ru : en);
  document.documentElement.lang = G.lang;

  if (G.lang === "en") {
    document.title = "Mission Saturn V";
    document.querySelectorAll("[data-en]").forEach((el) => { el.textContent = el.dataset.en; });
    document.querySelectorAll("[data-en-html]").forEach((el) => { el.innerHTML = el.dataset.enHtml; });
    document.querySelectorAll("[data-en-ph]").forEach((el) => { el.placeholder = el.dataset.enPh; });
    document.querySelectorAll("[data-en-aria]").forEach((el) => { el.setAttribute("aria-label", el.dataset.enAria); });
  }
})();
