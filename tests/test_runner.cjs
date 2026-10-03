global.window = {};
const { RUNNER } = require(require("path").join(__dirname, "../js/python.js"));
const { loadPyodide } = require(process.env.S + "/pyo/package/pyodide.js");
(async () => {
  const py = await loadPyodide();
  py.runPython(RUNNER);
  const run = py.globals.get("run");
  const cases = {
    ok: 'print("ЦУП, приём")\nright()\nright(3)\ngrab()',
    typo: 'rigth(3)\ngrab()',
    paren: 'right(3\ngrab()',
    quote: 'print("ЦУП)',
    noparens: 'right\ngrab()',
    loop: 'while True:\n    pass',
    loopActions: 'while True:\n    right()',
    argstr: 'right("5")',
    countdown: 'for i in range(10, 0, -1):\n    print(i)\nlaunch()',
    emptyfor: 'for i in range(10, 0, -1):\n    \nlaunch()',
    cyr: 'вправо()',
    indent: 'right()\n  grab()',
    capital: 'Right()',
    grabarg: 'grab(2)',
  };
  for (const [k, code] of Object.entries(cases)) {
    const t = Date.now();
    const r = JSON.parse(run(code));
    console.log(k.padEnd(12), (Date.now()-t+"ms").padEnd(7), JSON.stringify(r.error || r.actions).slice(0, 150));
  }
})();
