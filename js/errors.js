// Перевод ошибок Python и ошибок полёта в короткие сообщения бортового компьютера.
// Голос читает ровно текст сообщения (в русской версии английские слова — по-русски).
(function () {
  const G = (window.G = window.G || {});
  const L = (ru, en) => G.L(ru, en);

  const COMMANDS = ["print", "right", "left", "up", "down", "grab", "drop", "launch", "range", "for"];

  // Как русский голос должен произносить слова Python.
  const SAY = {
    print: "принт", right: "райт", left: "лефт", up: "ап", down: "даун",
    grab: "грэб", drop: "дроп", launch: "лонч", range: "рэйндж", for: "фор",
    "S-IVB": "эс четыре би", "S-IC": "эс один си", "S-II": "эс два", VAB: "ви эй би",
    Enter: "энтер", Shift: "шифт", in: "ин", i: "и",
  };

  // Слова, где встроенный голос ставит ударение не туда: знак ударения (U+0301) после ударной гласной.
  // На экране его нет — только в тексте для голоса. Новые слова дописывать сюда.
  const STRESS = {
    "перенеси": "перенеси\u0301",
    "подлети": "подлети\u0301",
  };
  const stressRe = new RegExp(`(^|[^А-Яа-яЁё])(${Object.keys(STRESS).join("|")})(?=[^А-Яа-яЁё]|$)`, "gi");

  function sayable(text) {
    let s = String(text);
    if (G.lang === "ru") {
      s = s.replace(stressRe, (m, a, w) => {
        const fixed = STRESS[w.toLowerCase()];
        return a + (w[0] === w[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed);
      });
      s = s.replace(/S-IVB|S-IC|S-II|VAB|Enter|Shift/g, (m) => SAY[m])
        .replace(/\bPython\b/g, "пайтон")
        .replace(/\bF-1\b/g, "эф один")
        .replace(/°C/g, " градусов")
        .replace(/\b(print|right|left|up|down|grab|drop|launch|range|for|in|i)\b/g, (m) => SAY[m])
        // Слова заглавными (ПУСК, ПРИЁМ) голос читает по буквам — делаем обычными.
        .replace(/(^|[^А-Яа-яЁё])([А-ЯЁ]{2,})(?=[^А-Яа-яЁё]|$)/g, (m, a, w) => a + w.toLowerCase());
    } else {
      s = s.replace(/S-IVB/g, "S four B").replace(/S-IC/g, "S one C").replace(/S-II/g, "S two")
        .replace(/°C/g, " degrees Celsius")
        .replace(/\b(PAD|RUN|GO|HOUSTON|PUT HERE|GRAB|LIFTOFF|IGNITION)\b/g, (m) => m.toLowerCase());
    }
    return s.replace(/[()"«»“”_]/g, " ").replace(/\s+/g, " ").trim();
  }

  function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
          d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  function closest(word) {
    const w = word.toLowerCase();
    let best = null, bestD = Infinity;
    for (const c of COMMANDS) {
      const dist = levenshtein(w, c);
      if (dist < bestD) { best = c; bestD = dist; }
    }
    return bestD <= Math.max(1, Math.floor(best.length / 2)) ? best : null;
  }

  function msg(text, line) {
    return { text, line: line || 0 };
  }

  const lineTag = (n) => (n ? L(` Строка ${n}.`, ` Line ${n}.`) : "");

  // Слова в print без кавычек: print(Ступень на месте).
  const noQuotes = (src) => /\bprint\(\s*[^\s"')\d-]/.test(src || "");
  const noQuotesMsg = (n) => msg(L(`Слова для ЦУП пишутся внутри кавычек: print("Ступень на месте").${lineTag(n)}`,
    `Words for Houston go inside quotes: print("Stage is in place").${lineTag(n)}`), n);

  // Ошибка из Python-раннера → сообщение. src — текст строки с ошибкой (если есть).
  function fromPython(err, src) {
    const n = err.line, t = lineTag(n);
    const line = src || err.text || "";
    if (err.kind === "syntax" && noQuotes(line)) return noQuotesMsg(n);
    if (err.kind === "name" && /^[\p{L}\p{N}_]+$/u.test(err.name || "") && new RegExp("print\\(\\s*" + err.name, "u").test(line)) return noQuotesMsg(n);
    switch (err.kind) {
      case "name": {
        const name = err.name;
        if (/[а-яё]/i.test(name))
          return msg(L(`Команды пишутся английскими буквами. Переключи раскладку.${t}`, `Commands use English letters. Switch the keyboard layout.${t}`), n);
        const guess = closest(name);
        if (guess && guess === name.toLowerCase() && guess !== name)
          return msg(L(`Python различает большие и маленькие буквы: пиши ${guess}.${t}`, `Python cares about capital letters: write ${guess}.${t}`), n);
        if (guess)
          return msg(L(`Неизвестная команда ${name}. Возможно: ${guess}.${t}`, `Unknown command ${name}. Did you mean ${guess}?${t}`), n);
        return msg(L(`Неизвестное слово ${name}. Если это текст — возьми его в кавычки.${t}`, `Unknown word ${name}. If it's text, put it in quotes.${t}`), n);
      }
      case "syntax": return fromSyntax(err);
      case "no_parens":
        return msg(L(`После ${err.cmd} нужны скобки: ${err.cmd}().${t}`, `${err.cmd} needs brackets: ${err.cmd}().${t}`), n);
      case "arg_type":
        return msg(L(`В скобках нужно число клеток без кавычек: ${err.cmd}(3).${t}`, `Put a number of squares in the brackets, without quotes: ${err.cmd}(3).${t}`), n);
      case "arg_range":
        return msg(L(`Корпус не такой большой. Число клеток — от 1 до 20.${t}`, `The hangar isn't that big. Use 1 to 20 squares.${t}`), n);
      case "too_many_args":
        return msg(L(`В скобках ${err.cmd}() нужно одно число.${t}`, `${err.cmd}() needs just one number in the brackets.${t}`), n);
      case "no_args":
        return msg(L(`Команде ${err.cmd}() ничего в скобках не нужно.${t}`, `${err.cmd}() needs nothing in the brackets.${t}`), n);
      case "no_input":
        return msg(L("Команда input здесь не работает: ЦУП не может ответить с клавиатуры.", "input doesn't work here: Houston can't answer from the keyboard."), n);
      case "runaway":
        return msg(L("Энергия на исходе: программа крутится без конца. Остановлено.", "Power is running low: the program loops forever. Stopped."), n);
      case "type":
        return msg(L(`Команда записана неправильно.${t}`, `The command is written incorrectly.${t}`), n);
      default:
        return msg(L(`Сбой в программе (${err.subtype || "ошибка"}).${t}`, `Program failure (${err.subtype || "error"}).${t}`), n);
    }
  }

  function fromSyntax(err) {
    const m = err.msg || "", n = err.line;
    if (/\)\s*[A-Za-z_]/.test(err.text || ""))
      return msg(L(`Строка ${n}: две команды подряд. Одна строка — одна команда: нажми Enter после ).`, `Each command goes on its own line. Press Enter after ) on line ${n}.`), n);
    if (/was never closed/.test(m))
      return msg(L(`Строка ${n}: скобка не закрыта. Поставь ) в конце.`, `A bracket is not closed. Add ) at the end of line ${n}.`), n);
    if (/unterminated string/.test(m))
      return msg(L(`Строка ${n}: не хватает закрывающей кавычки ".`, `The closing quote " is missing on line ${n}.`), n);
    if (/unmatched '\)'/.test(m))
      return msg(L(`Строка ${n}: лишняя скобка ).`, `Extra bracket ) on line ${n}.`), n);
    if (/expected an indented block/.test(m))
      return msg(L("Внутри цикла нужна команда с отступом. Например: print(i).", "The loop needs an indented command. For example: print(i)."), n);
    if (/unexpected indent/.test(m))
      return msg(L(`Строка ${n}: лишние пробелы в начале. Убери их.`, `Extra spaces at the start of line ${n}. Remove them.`), n);
    if (/unindent does not match|inconsistent/.test(m))
      return msg(L(`Строка ${n}: отступы не совпадают.`, `The indents don't match on line ${n}.`), n);
    if (/expected ':'/.test(m))
      return msg(L(`Строка ${n}: в конце нужно двоеточие :`, `Line ${n} needs a colon : at the end.`), n);
    if (/invalid character|invalid non-printable/.test(m))
      return msg(L(`Строка ${n}: странный знак. Сотри его.`, `Strange character on line ${n}. Delete it.`), n);
    return msg(L(`Не могу разобрать строку ${n}. Проверь скобки и кавычки.`, `I can't read line ${n}. Check the brackets and quotes.`), n);
  }

  // Ошибки полёта (сцена).
  const FLIGHT = {
    wall: () => msg(L("Стена корпуса. Дальше лететь нельзя.", "Hangar wall. Can't fly any further.")),
    girder: () => msg(L("Впереди ферма. Дрон остановился, чтобы не врезаться. Найди другой путь.", "Girder ahead. The drone stopped so it wouldn't crash. Find another path.")),
    grabEmpty: () => ({ ...msg(L("Захват пуст: здесь нет детали.", "Nothing to grab: there's no part here.")), kind: "grabEmpty" }),
    grabFull: () => msg(L("Захват уже занят. Сначала поставь деталь: drop().", "The gripper is full. Put the part down first: drop().")),
    dropEmpty: () => msg(L("Ставить нечего: захват пуст.", "Nothing to drop: the gripper is empty.")),
    dropWrong: () => msg(L("Здесь ставить нельзя. Детали ставятся на ПРИЁМ внизу слева.", "You can't put it here. Parts go on the PAD at the bottom left.")),
    launchLocked: () => msg(L("launch() заблокирован: ракета ещё не собрана.", "launch() is locked: the rocket isn't built yet.")),
    launchEarly: () => msg(L("Отсчёт должен начаться с 10 и дойти до 1. Впиши 10 первым числом в скобках.", "The countdown must start at 10 and reach 1. Type 10 as the first number in the brackets.")),
    memory: (used, max) => msg(L(`В программе ${used} ${lines(used)}, а в компьютер дрона помещается только ${max}. Сократи программу.`,
      `Your program has ${used} lines, but the drone's computer fits only ${max}. Make the program shorter.`)),
  };

  function lines(n) {
    const d = n % 10, dd = n % 100;
    if (d === 1 && dd !== 11) return "строка";
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "строки";
    return "строк";
  }

  G.errors = { fromPython, FLIGHT, sayable, closest, msg, SAY };
})();
