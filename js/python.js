// Python на борту: Pyodide, команды дрона и запуск программы ребёнка.
// Python выполняет программу целиком и возвращает список действий,
// а сцена (world.js) потом проигрывает их по одному.
(function () {
  const G = (window.G = window.G || {});

  const RUNNER = String.raw`
import sys, ast, json, builtins

FILENAME = "<борт>"
MAX_LINES = 5000      # защита от бесконечного цикла
MAX_ACTIONS = 300     # защита от слишком длинной программы
KNOWN = ("right", "left", "up", "down", "grab", "drop", "launch", "print")


class KidError(Exception):
    def __init__(self, kind, **info):
        super().__init__(kind)
        self.kind = kind
        self.info = info


class Runaway(Exception):
    pass


def _user_line(tb=None):
    """Номер строки в программе ребёнка (а не внутри наших функций)."""
    line = 0
    if tb is not None:
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == FILENAME:
                line = tb.tb_lineno
            tb = tb.tb_next
        return line
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == FILENAME:
            return f.f_lineno
        f = f.f_back
    return 0


def _fail(kind, actions, line=0, **info):
    return json.dumps({"ok": False, "actions": actions,
                       "error": dict(kind=kind, line=line, **info)}, ensure_ascii=False)


def run(code):
    actions = []

    def record(action):
        if len(actions) >= MAX_ACTIONS:
            raise Runaway()
        action["line"] = _user_line()
        actions.append(action)

    def make_move(name):
        def move(n=1, *extra):
            if extra:
                raise KidError("too_many_args", cmd=name)
            if isinstance(n, bool) or not isinstance(n, int):
                raise KidError("arg_type", cmd=name, value=repr(n))
            if n < 0 or n > 20:
                raise KidError("arg_range", cmd=name, value=n)
            record({"op": name, "n": n})
        return move

    def make_simple(name):
        def simple(*args):
            if args:
                raise KidError("no_args", cmd=name)
            record({"op": name})
        return simple

    def kid_print(*args, sep=" ", end="\n"):
        record({"op": "print", "text": sep.join(str(a) for a in args)})

    def kid_input(*args):
        raise KidError("no_input")

    g = {"__builtins__": builtins, "__name__": "__main__",
         "print": kid_print, "input": kid_input}
    for name in ("right", "left", "up", "down"):
        g[name] = make_move(name)
    for name in ("grab", "drop", "launch"):
        g[name] = make_simple(name)

    try:
        tree = ast.parse(code, FILENAME)
    except SyntaxError as e:
        return _fail("syntax", [], line=e.lineno or 0, msg=str(e.msg),
                     subtype=type(e).__name__, col=e.offset or 0, text=e.text or "")

    # Частая ошибка: команда без скобок. Python молча ничего не делает.
    for node in ast.walk(tree):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Name) \
                and node.value.id in KNOWN:
            return _fail("no_parens", [], line=node.lineno, cmd=node.value.id)

    steps = [0]

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        if event == "line":
            steps[0] += 1
            if steps[0] > MAX_LINES:
                raise Runaway()
        return tracer

    sys.settrace(tracer)
    try:
        exec(compile(tree, FILENAME, "exec"), g)
    except Runaway as e:
        return _fail("runaway", actions, line=_user_line(e.__traceback__))
    except KidError as e:
        return _fail(e.kind, actions, line=_user_line(e.__traceback__), **e.info)
    except NameError as e:
        return _fail("name", actions, line=_user_line(e.__traceback__),
                     name=getattr(e, "name", None) or "")
    except TypeError as e:
        return _fail("type", actions, line=_user_line(e.__traceback__), msg=str(e))
    except Exception as e:
        return _fail("other", actions, line=_user_line(e.__traceback__),
                     subtype=type(e).__name__, msg=str(e))
    finally:
        sys.settrace(None)
    return json.dumps({"ok": True, "actions": actions}, ensure_ascii=False)
`;

  let pyodide = null;
  let runFn = null;

  G.python = {
    ready: false,

    // base — путь к папке с файлами Pyodide (рядом со страницей).
    async load(base) {
      // Стандартная библиотека хранится как base64-текст: архивы .zip
      // на claude.ai не раздаются. Собираем архив обратно в браузере.
      const b64 = await (await fetch(base + "python_stdlib.b64.txt")).text();
      const bin = atob(b64.replace(/\s+/g, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const stdLibURL = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      pyodide = await loadPyodide({
        indexURL: base,
        stdLibURL,
        lockFileURL: base + "pyodide-lock.json",
      });
      pyodide.runPython(RUNNER);
      runFn = pyodide.globals.get("run");
      this.ready = true;
    },

    // Возвращает { ok, actions: [...], error?: {kind, line, ...} }
    run(code) {
      if (!runFn) throw new Error("Python ещё не загружен");
      return JSON.parse(runFn(code));
    },
  };

  // Для проверки в Node: экспортируем текст раннера.
  if (typeof module !== "undefined") module.exports = { RUNNER };
})();
