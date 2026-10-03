// Редактор кода (CodeMirror 5) и «умная клавиатура».
// Буквы определяются по физической клавише (event.code), а не по раскладке:
// вне кавычек всегда латиница, внутри кавычек и в комментариях — кириллица.
(function () {
  const G = (window.G = window.G || {});

  // [без Shift, с Shift] для латиницы и для кириллицы (ЙЦУКЕН).
  const LAT = {}, RUS = {};
  "qwertyuiopasdfghjklzxcvbnm".split("").forEach((c) => {
    LAT["Key" + c.toUpperCase()] = [c, c.toUpperCase()];
  });
  const ruLetters = {
    KeyQ: "й", KeyW: "ц", KeyE: "у", KeyR: "к", KeyT: "е", KeyY: "н", KeyU: "г", KeyI: "ш",
    KeyO: "щ", KeyP: "з", BracketLeft: "х", BracketRight: "ъ", KeyA: "ф", KeyS: "ы", KeyD: "в",
    KeyF: "а", KeyG: "п", KeyH: "р", KeyJ: "о", KeyK: "л", KeyL: "д", Semicolon: "ж", Quote: "э",
    KeyZ: "я", KeyX: "ч", KeyC: "с", KeyV: "м", KeyB: "и", KeyN: "т", KeyM: "ь", Comma: "б",
    Period: "ю", Backquote: "ё",
  };
  for (const [code, ch] of Object.entries(ruLetters)) RUS[code] = [ch, ch.toUpperCase()];

  const LAT_SYM = {
    Digit1: ["1", "!"], Digit2: ["2", '"'], Digit3: ["3", "#"], Digit4: ["4", "$"], Digit5: ["5", "%"],
    Digit6: ["6", ":"], Digit7: ["7", "&"], Digit8: ["8", "*"], Digit9: ["9", "("], Digit0: ["0", ")"],
    Minus: ["-", "_"], Equal: ["=", "+"], BracketLeft: ["[", "{"], BracketRight: ["]", "}"],
    Backslash: ["\\", "|"], Semicolon: [";", ":"], Quote: ["'", '"'], Comma: [",", "<"],
    Period: [".", ">"], Slash: ["/", "?"], Backquote: ["`", "~"], Space: [" ", " "],
  };
  const PAIRS = { "(": ")", '"': '"', "'": "'" };

  // Где курсор: в коде, в строке (внутри кавычек) или в комментарии.
  function context(lineText, ch) {
    let quote = null;
    for (let i = 0; i < ch; i++) {
      const c = lineText[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "#") return "comment";
    }
    return quote ? "string" : "code";
  }

  // Символы, которые на латинской раскладке получаются только с Shift.
  const SHIFTED = new Set('{}:"<>~?'.split(""));

  // Если система уже дала «правильный» символ — берём его как есть;
  // переводим по физической клавише, только когда раскладка не та.
  function charFor(e, ctx) {
    const k = e.key;
    if (!k || k.length !== 1) return null;
    const ascii = k.charCodeAt(0) < 128;
    const isLetter = k.toLowerCase() !== k.toUpperCase();
    const upper = isLetter ? k !== k.toLowerCase() : e.shiftKey || SHIFTED.has(k);

    if (ctx === "code") {
      if (ascii) return k === "@" ? '"' : k === "^" ? ":" : k;
      const m = LAT[e.code] || LAT_SYM[e.code];   // русская раскладка → латиница
      return m ? m[upper ? 1 : 0] : null;
    }
    // Внутри кавычек и в комментариях. Кириллица по физической клавише — только в русской версии.
    if (!ascii || G.lang !== "ru") return k;
    if (e.code === "Quote" && k === '"') return '"';  // Shift+' остаётся кавычкой
    if (RUS[e.code]) return RUS[e.code][upper ? 1 : 0];
    if (e.code === "Slash") return upper ? "," : ".";
    if (k === "@") return '"';
    return k;
  }

  function create(host, { onRun, onChange } = {}) {
    const cm = CodeMirror(host, {
      mode: { name: "python", version: 3 },
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      lineWrapping: false,
      autofocus: false,
      spellcheck: false,
      autocorrect: false,       // телефон не должен исправлять print на Print
      autocapitalize: false,
      extraKeys: {
        Tab: (c) => c.replaceSelection("    "),
        "Shift-Tab": "indentLess",
        "Ctrl-Enter": () => onRun && onRun(),
        "Cmd-Enter": () => onRun && onRun(),
      },
    });

    // Телефоны ставят «умные» кавычки “ ” « » — Python их не понимает. Меняем на прямые.
    cm.on("beforeChange", (c, change) => {
      if (!change.update || !change.text) return;
      const fixed = change.text.map((l) => l.replace(/[“”„«»]/g, '"').replace(/[‘’‚]/g, "'"));
      if (fixed.join("\n") !== change.text.join("\n")) change.update(change.from, change.to, fixed);
    });
    // На телефоне экранная клавиатура закрывает полэкрана — держим программу на виду.
    if (G.touch) cm.on("focus", () => setTimeout(() => host.scrollIntoView({ block: "center", behavior: "smooth" }), 350));

    cm.on("keydown", (c, e) => {
      if (c.getOption("readOnly")) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const cur = c.getCursor();
      const line = c.getLine(cur.line);
      const ctx = context(line, cur.ch);
      const next = line[cur.ch];
      const hasSel = c.somethingSelected();

      if (e.key === "Backspace" && !hasSel) {
        // Курсор после одних пробелов — убираем весь отступ одним нажатием.
        const before = line.slice(0, cur.ch);
        if (before.length > 0 && /^ +$/.test(before)) {
          e.preventDefault();
          c.replaceRange("", { line: cur.line, ch: Math.max(0, cur.ch - 4) }, cur);
          return;
        }
        const prev = line[cur.ch - 1];
        if (prev && PAIRS[prev] && PAIRS[prev] === next) {
          e.preventDefault();
          c.replaceRange("", { line: cur.line, ch: cur.ch - 1 }, { line: cur.line, ch: cur.ch + 1 });
        }
        return;
      }

      const ch = charFor(e, ctx);
      if (ch === null) return;
      e.preventDefault();

      // Закрывающая скобка или кавычка, которая уже стоит, — просто перешагиваем.
      if (!hasSel && (ch === ")" || ch === '"' || ch === "'") && next === ch &&
          (ch === ")" ? ctx === "code" : ctx === "string")) {
        c.setCursor({ line: cur.line, ch: cur.ch + 1 });
        return;
      }
      // Открывающая — ставим пару.
      if (ctx === "code" && PAIRS[ch] && !hasSel) {
        c.replaceSelection(ch + PAIRS[ch]);
        c.setCursor({ line: cur.line, ch: cur.ch + 1 });
        return;
      }
      c.replaceSelection(ch);
    });

    const api = {
      cm,
      get value() { return cm.getValue(); },
      set(text, cursor) {
        cm.setValue(text || "");
        cm.clearHistory();
        if (cursor) cm.setCursor(cursor);
        else cm.setCursor(cm.lineCount(), 0);
      },
      focus() { cm.focus(); },
      setReadOnly(ro) { cm.setOption("readOnly", ro); host.classList.toggle("is-running", ro); },

      // Вставить команду с плитки: на новую строку, если текущая не пустая.
      insert(snippet, caretFromEnd = 0) {
        const cur = cm.getCursor();
        const line = cm.getLine(cur.line);
        if (line.trim() !== "") {
          const indent = line.match(/^\s*/)[0];
          cm.replaceRange("\n" + indent, { line: cur.line, ch: line.length });
          cm.setCursor({ line: cur.line + 1, ch: indent.length });
        }
        cm.replaceSelection(snippet);
        const after = cm.getCursor();
        cm.setCursor({ line: after.line, ch: after.ch + caretFromEnd });
        if (!G.touch) cm.focus();   // на телефоне не вызываем клавиатуру: можно собирать плитками
      },

      // Светлая подсказка в пустой строке («← напиши здесь …»), исчезает при вводе.
      setGhost(line, text) {
        if (ghost) { ghost.clear(); ghost = null; }
        if (line === undefined || !text) return;
        const el = document.createElement("span");
        el.className = "cm-ghost";
        el.textContent = text;
        ghostLine = line;
        ghost = cm.setBookmark({ line, ch: cm.getLine(line).length }, { widget: el, insertLeft: true });
      },

      // Пустое место, куда вписать число: рамка «?» прямо в коде. Видно, куда писать, где бы ни стоял курсор.
      // Нажатие на рамку ставит туда курсор; как только строку поменяли — рамка пропадает.
      setSlot(line, ch) {
        if (slot) { slot.clear(); slot = null; }
        if (line === undefined) return;
        const el = document.createElement("span");
        el.className = "cm-slot";
        el.textContent = "?";
        el.addEventListener("mousedown", (e) => { e.preventDefault(); cm.focus(); cm.setCursor({ line, ch }); });
        slotLine = line;
        slotText = cm.getLine(line);
        slot = cm.setBookmark({ line, ch }, { widget: el, insertLeft: true });
      },

      markLine(n, cls) {
        if (n > 0 && n <= cm.lineCount()) cm.addLineClass(n - 1, "background", cls);
      },
      clearMarks() {
        for (let i = 0; i < cm.lineCount(); i++) {
          cm.removeLineClass(i, "background", "line-run");
          cm.removeLineClass(i, "background", "line-error");
        }
      },

      // Сколько строк занимает программа (пустые и комментарии не считаются).
      usedLines() {
        return cm.getValue().split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length;
      },
      keyboardMode() {
        const cur = cm.getCursor();
        return context(cm.getLine(cur.line), cur.ch) === "code" ? "EN" : "РУ";
      },
    };

    let ghost = null, ghostLine = -1, slot = null, slotLine = -1, slotText = "";
    cm.on("changes", () => {
      if (ghost && cm.getLine(ghostLine) !== undefined && cm.getLine(ghostLine).trim() !== "") { ghost.clear(); ghost = null; }
      if (slot && cm.getLine(slotLine) !== slotText) { slot.clear(); slot = null; }
      onChange && onChange(api);
    });
    cm.on("cursorActivity", () => onChange && onChange(api));
    return api;
  }

  G.editor = { create, context, charFor };
})();
