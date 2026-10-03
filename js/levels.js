// Глава 1 · Монтажный корпус (VAB). Данные миссий на двух языках: L("рус", "eng").
// Поле: x — столбец слева направо (0…5), y — ярус снизу вверх (0…3).
// ПРИЁМ (площадка под кран) всегда в левом нижнем углу.
(function () {
  const G = (window.G = window.G || {});
  const L = G.L;

  // Сатурн-5 в настоящем масштабе: высоты и диаметры в метрах. Сумма — 110,6 м.
  const ROCKET = [
    { id: "S-IC", h: 42.1, d: 10.1 },
    { id: "S-II", h: 24.9, d: 10.1 },
    { id: "S-IVB", h: 17.8, d: 6.6 },
    { id: "IU", h: 0.9, d: 6.6 },
    { id: "APOLLO", h: 24.9, d: 3.9 },
  ];

  // Мерка для сравнения на шкале ракеты: русскому ребёнку понятнее девятиэтажка,
  // англоязычному — статуя Свободы с постаментом.
  const SCALE_REF = L({ h: 28, label: ["девять", "этажей"] }, { h: 93, label: ["Statue of", "Liberty"] });

  const PLATFORM = { x: 0, y: 0 };
  const GRID = { cols: 6, rows: 4 };

  // Общие проверки цели.
  const delivered = (id) => (ctx) =>
    ctx.stack.includes(id) ? null
      : ctx.drone.holding === id
        ? G.errors.msg(L("Деталь всё ещё в захвате. Отвези на ПРИЁМ и поставь: drop().", "The part is still in the gripper. Take it to the PAD and put it down: drop()."))
        : G.errors.msg(L("Программа выполнена, но деталь не на месте.", "The program finished, but the part is not in place."));

  const READY = L("Готовая программа:", "Finished program:");

  const MISSIONS = [
    {
      id: 1, title: L("Связь", "Radio check"),
      brief: {
        text: L("Выйди на связь с ЦУП — центром управления полётами. Передай по радио: «ЦУП, приём».",
          "Contact Houston — Mission Control. Send a radio message: “Houston, come in”."),
        code: L('print("ЦУП, приём")', 'print("Houston, come in")'),
        note: L("Нажми плитку print, потом напиши текст внутри кавычек.", "Press the print tile, then type the text inside the quotes."),
      },
      // Первая встреча с кодом: собираем команду по шагам, новое подсвечено.
      example: { title: L("Учимся: как написать сообщение", "Learn: how to write a message"), code: L('print("ЦУП, приём")', 'print("Houston, come in")'), notes: [],
        caption: L("print — «напечатать». Текст пишется в кавычках, кавычки — в скобках.", "print means “print”. The text goes in quotes, the quotes go in brackets."),
        steps: [
          { before: "", add: 'print("")', after: "", text: L("Нажми плитку print — она напишет команду.", "Press the print tile — it writes the command.") },
          { before: 'print("', add: L("ЦУП, приём", "Houston, come in"), after: '")', text: L("Внутри кавычек напиши текст.", "Inside the quotes, type the text.") },
          { text: L("Нажми ПУСК.", "Press RUN.") },
        ] },
      drone: { x: 2, y: 1 }, parts: [], girders: [],
      commands: ["print"], insertTiles: true, maxLines: 5, starter: "",
      // Засчитываем, если в сообщении есть «приём» (можно с «е»).
      goal: (ctx) => ctx.prints.some((t) => L(/при[её]м/i, /come in/i).test(t)) ? null
        : ctx.prints.some((t) => t.trim())
          ? G.errors.msg(L('ЦУП ждёт сообщение «ЦУП, приём». Напиши его внутри кавычек.', 'Houston is waiting for “Houston, come in”. Type it inside the quotes.'))
          : G.errors.msg(L('ЦУП ничего не услышал. Напиши текст внутри кавычек: print("ЦУП, приём").', 'Houston heard nothing. Type the text inside the quotes: print("Houston, come in").')),
      success: { text: L("Борт {name}, слышим вас отлично. Связь установлена.", "{name}, we read you loud and clear. Radio check complete.") },
      hints: [
        { text: L("Нажми плитку print — она вставит заготовку.", "Press the print tile — it adds a template.") },
        { text: L("Текст пишется внутри кавычек: между \" и \".", "The text goes inside the quotes: between \" and \".") },
        { text: READY, code: L('print("ЦУП, приём")', 'print("Houston, come in")') },
      ],
      fact: {
        photo: { src: "assets/photos/m01-rollout.jpg", caption: L("Сатурн-5 «Аполлона-11» везут на старт, май 1969", "Apollo 11's Saturn V rolls out to the pad, May 1969") },
        title: L("110 метров", "110 meters"),
        text: L("Сатурн-5 высотой 110 метров — почти как четыре девятиэтажки, поставленные друг на друга.",
          "Saturn V was 110 meters tall — taller than the Statue of Liberty with its pedestal, which is 93 meters."),
      },
    },
    {
      id: 2, title: L("Первая ступень", "First stage"),
      brief: {
        text: L("Направь дрон к ступени S-IC и возьми её. Команды: right() — вправо, grab() — взять.",
          "Fly to the S-IC stage and pick it up. Commands: right() and grab()."),
      },
      example: { title: L("Учимся: одна команда — одна строка", "Learn: one command per line"), code: "right()\nleft()", notes: L(["шаг вправо", "шаг влево"], ["a step right", "a step left"]),
        caption: L("Одна строка — одна команда: написал — нажми Enter. Дрон выполнит их по очереди, сверху вниз.",
          "One line — one command: type it, then press Enter. The drone runs them in order, top to bottom."),
        captionTouch: L("Одна строка — одна команда: написал — нажми кнопку ↵. Дрон выполнит их по очереди, сверху вниз.",
          "One line — one command: type it, then tap ↵. The drone runs them in order, top to bottom.") },
      drone: { x: 0, y: 0 }, parts: [{ id: "S-IC", x: 1, y: 0 }], girders: [],
      commands: ["right", "left", "grab"], insertTiles: true, maxLines: 5, starter: "",
      goal: (ctx) => ctx.drone.holding === "S-IC" ? null
        : G.errors.msg(L("Ступень не в захвате: дрон должен долететь до неё и выполнить grab().", "The stage is not in the gripper. Fly to it and run grab().")),
      success: { text: L("Ступень S-IC в захвате. Отличная работа, {kid}.", "S-IC is in the gripper. Great work, {kid}.") },
      hints: [
        { text: L("Ступень в одной клетке справа: сначала right(), потом grab().", "The stage is one square to the right: first right(), then grab().") },
        { text: L("Две строки: right() и под ней grab().", "Two lines: right() and grab() below it.") },
        { text: READY, code: "right()\ngrab()" },
      ],
      fact: {
        photo: { src: "assets/photos/m02-f1.jpg", caption: L("Двигатель F-1 вблизи", "An F-1 engine up close") },
        title: L("5 двигателей F-1", "5 F-1 engines"),
        text: L("Пять двигателей F-1 первой ступени сжигали больше 2000 тонн топлива примерно за две с половиной минуты.",
          "The five F-1 engines of the first stage burned more than 2,000 tonnes of propellant in about two and a half minutes."),
      },
    },
    {
      id: 3, title: L("Установка", "Stacking"),
      brief: {
        text: L("Поставь S-IC на площадку ПРИЁМ слева. Новая команда: drop() — поставить.",
          "Put S-IC on the PAD on the left. New command: drop() — put down."),
      },
      example: { title: L("Учимся: drop() — поставить", "Learn: drop() — put down"), code: "left()\ndrop()", notes: L(["долететь до ПРИЁМА", "поставить деталь"], ["fly to the PAD", "put the part down"]), demo: false,
        caption: L("drop() ставит деталь из захвата. Ставить можно только на ПРИЁМ.", "drop() puts down the part in the gripper. Parts go only on the PAD.") },
      drone: { x: 2, y: 0, holding: "S-IC" }, parts: [], girders: [], places: "S-IC",
      commands: ["left", "right", "drop"], insertTiles: true, maxLines: 5, starter: "",
      goal: delivered("S-IC"),
      success: { text: L("Первая ступень на платформе. Кран зафиксировал.", "The first stage is on the platform. The crane has locked it.") },
      hints: [
        { text: L("ПРИЁМ — в двух клетках слева.", "The PAD is two squares to the left.") },
        { text: L("Два раза left(), потом drop().", "left() twice, then drop().") },
        { text: READY, code: "left()\nleft()\ndrop()" },
      ],
      fact: {
        photo: { src: "assets/photos/m03-vab.jpg", caption: L("Сатурн-5 выезжает из ворот здания сборки", "Saturn V rolls out of the assembly building doors") },
        title: L("Ворота 139 метров", "139-meter doors"),
        text: L("Ворота здания вертикальной сборки VAB высотой 139 метров. Это самые высокие ворота в мире.",
          "The doors of the Vehicle Assembly Building are 139 meters tall — the largest doors in the world."),
      },
    },
    {
      id: 4, title: L("Доклад", "Report"),
      brief: {
        text: L("Доложи ЦУП, что первая ступень стоит. Скобки уже есть — поставь кавычки и напиши сообщение сам.",
          "Report to Houston that the first stage is in place. The brackets are there — add quotes and write the message yourself."),
      },
      example: { title: L("Учимся: кавычки сам", "Learn: quotes on your own"), code: L('print("Ступень на месте")', 'print("Stage is in place")'), notes: L(["текст — какой хочешь"], ["any text you like"]),
        caption: L("В прошлый раз кавычки поставила плитка. Теперь поставь их сам: Shift и 2.", "Last time the tile added the quotes. Now add them yourself.") },
      drone: { x: 1, y: 1 }, parts: [], girders: [],
      commands: [], insertTiles: false, maxLines: 5,
      starter: "print()\n", cursor: { line: 0, ch: 6 },
      ghost: { line: 0, text: L("← кавычки и текст внутри скобок", "← quotes and text inside the brackets") },
      goal: (ctx) => ctx.prints.some((t) => t.trim()) ? null
        : G.errors.msg(L('ЦУП ничего не услышал. Внутри скобок нужны кавычки с текстом: print("Ступень на месте").', 'Houston heard nothing. Put quotes with text inside the brackets: print("Stage is in place").')),
      success: { text: L("Принято, {name}. Первая ступень на месте — отличная работа, {kid}.", "Copy that, {name}. First stage confirmed — great work, {kid}.") },
      hints: [
        { text: L("Поставь курсор между скобками и нажми Shift и 2 — появятся кавычки.", "Put the cursor between the brackets and type quotes.") },
        { text: L("Между кавычками напиши любой текст, например: Ступень на месте.", "Between the quotes type any text, for example: Stage is in place.") },
        { text: READY, code: L('print("Ступень на месте")', 'print("Stage is in place")') },
      ],
      fact: {
        photo: { src: "assets/photos/m04-houston.jpg", caption: L("Центр управления в Хьюстоне во время выхода на Луну, июль 1969", "Mission Control in Houston during the Moonwalk, July 1969") },
        title: L("Хьюстон", "Houston"),
        text: L("Центр управления полётами «Аполлонов» находился в городе Хьюстон. Поэтому астронавты обращались к нему просто: «Хьюстон».",
          "Mission Control for Apollo was in the city of Houston. That's why astronauts simply called it “Houston”."),
      },
    },
    {
      id: 5, title: L("Вторая ступень", "Second stage"),
      brief: {
        text: L("Привези S-II: она в пяти клетках справа. Компьютер дрона маленький: в программе можно написать не больше 5 строк. Пять раз right() туда и пять обратно не поместятся — пиши число в скобках.",
          "Bring S-II: it is five squares to the right. The drone's computer is small: a program can have at most 5 lines. Five right() there and five back won't fit — put a number in the brackets."),
      },
      example: { title: L("Учимся: число в скобках", "Learn: a number in the brackets"), code: "right(2)\nleft(1)", notes: L(["2 клетки вправо", "1 клетка влево"], ["2 squares right", "1 square left"]),
        caption: L("Число в скобках — сколько клеток пролететь. right(2) — это как две строки right().", "The number in the brackets is how many squares to fly. right(2) is like two lines of right().") },
      drone: { x: 0, y: 0 }, parts: [{ id: "S-II", x: 5, y: 0 }], girders: [], places: "S-II",
      commands: ["right", "left", "grab", "drop"], insertTiles: false, maxLines: 5, starter: "",
      goal: delivered("S-II"),
      success: { text: L("Вторая ступень установлена. Программа в четыре строки — как у настоящих инженеров.", "Second stage installed. A four-line program — just like real engineers.") },
      hints: [
        { text: L("right(5) — сразу пять клеток.", "right(5) — five squares in one line.") },
        { text: L("Туда — right(5), обратно — left(5). Между ними grab(), в конце drop().", "There — right(5), back — left(5). grab() in between, drop() at the end.") },
        { text: READY, code: "right(5)\ngrab()\nleft(5)\ndrop()" },
      ],
      fact: {
        photo: { src: "assets/photos/m05-s2.jpg", caption: L("Вторую ступень S-II ставят на первую", "The S-II stage is lowered onto the first stage") },
        title: L("Минус 253 °C", "Minus 253 °C"),
        text: L("Вторая ступень S-II летела на жидком водороде. Его охлаждают до минус 253 градусов, иначе он становится газом.",
          "The S-II second stage ran on liquid hydrogen. It has to be cooled to minus 253 degrees, or it turns into gas."),
      },
    },
    {
      id: 6, title: L("Ремонт", "Repair"),
      brief: {
        text: L("Программа для S-IVB пришла с ошибками. Нажми ПУСК, послушай бортовой компьютер и почини.",
          "The program for S-IVB arrived with errors. Press RUN, listen to the onboard computer and fix it."),
        note: L("Строка с # — заметка для людей, дрон её пропускает.", "A line starting with # is a note for people — the drone skips it."),
      },
      example: { title: L("Учимся: поиск ошибок", "Learn: finding errors"), code: L('prnt("бип")\nprint("бип")', 'prnt("beep")\nprint("beep")'), notes: L(["ошибка: пропущена буква", "исправлено"], ["error: a missing letter", "fixed"]), demo: false,
        caption: L("Бортовой компьютер называет строку с ошибкой и что не так. Найди ошибку, исправь и запусти снова.", "The onboard computer tells you which line has the error and what is wrong. Find it, fix it and run again.") },
      drone: { x: 0, y: 0 }, parts: [{ id: "S-IVB", x: 3, y: 0 }], girders: [], places: "S-IVB",
      commands: ["right", "left", "grab", "drop"], insertTiles: false, maxLines: 5,
      starter: L("# Программа с ошибками. Почини её.\n", "# A program with errors. Fix it.\n") + "rigth(3)\ngrab()\nleft(3\ndrop()\n",
      goal: delivered("S-IVB"),
      success: { text: L("Ошибки исправлены, третья ступень на месте. Так и работает отладка.", "Errors fixed, the third stage is in place. That's what debugging is.") },
      hints: [
        { text: L("Нажми ПУСК: бортовой компьютер назовёт первую ошибку и строку.", "Press RUN: the onboard computer will name the first error and its line.") },
        { text: L("Ошибок две: одно слово написано с ошибкой, а одной скобки не хватает.", "There are two errors: one word is misspelled and one bracket is missing.") },
        { text: L("Исправленная программа:", "Fixed program:"), code: "right(3)\ngrab()\nleft(3)\ndrop()" },
      ],
      fact: {
        photo: { src: "assets/photos/m06-s4b.jpg", caption: L("Третья ступень S-IVB в космосе — снимок с «Аполлона-8»", "The S-IVB stage in space, seen from Apollo 8") },
        title: L("Два включения", "Two burns"),
        text: L("Двигатель третьей ступени S-IVB включался дважды: сначала выводил корабль на орбиту Земли, потом разгонял к Луне.",
          "The S-IVB third stage engine fired twice: first to reach Earth orbit, then to send the spacecraft to the Moon."),
      },
    },
    {
      id: 7, title: L("Приборный отсек", "Instrument Unit"),
      brief: {
        text: L("Приборный отсек — мозг ракеты. Он лежит на верхней полке. Возьми его и поставь на ПРИЁМ. Новые команды: up() — вверх, down() — вниз.",
          "The Instrument Unit is the rocket's brain. It is on the top shelf. Pick it up and put it on the PAD. New commands: up() and down()."),
      },
      example: { title: L("Учимся: вверх и вниз", "Learn: up and down"), code: "up(2)\ndown(1)", notes: L(["2 клетки вверх", "1 клетка вниз"], ["2 squares up", "1 square down"]),
        caption: L("up() и down() — как right() и left(), только вверх и вниз. Число в скобках — сколько клеток.", "up() and down() work like right() and left(), just up and down. The number is how many squares.") },
      drone: { x: 4, y: 0 }, parts: [{ id: "IU", x: 4, y: 3 }], girders: [], places: "IU",
      commands: ["right", "left", "up", "down", "grab", "drop"], insertTiles: false, maxLines: 5, starter: "",
      goal: delivered("IU"),
      success: { text: L("Приборный отсек установлен. У ракеты появился мозг.", "Instrument Unit installed. The rocket has a brain now.") },
      hints: [
        { text: L("Отсек на три клетки выше дрона. Поднимись, возьми, потом лети к ПРИЁМУ.", "The unit is three squares above the drone. Go up, grab it, then fly to the PAD.") },
        { text: L("up(3), grab(), left(4), down(3), drop().", "up(3), grab(), left(4), down(3), drop().") },
        { text: READY, code: "up(3)\ngrab()\nleft(4)\ndown(3)\ndrop()" },
      ],
      fact: {
        photo: { src: "assets/photos/m07-iu.jpg", caption: L("Инженеры проверяют приборный отсек", "Engineers test the Instrument Unit") },
        title: L("Мозг ракеты", "The rocket's brain"),
        text: L("Приборный отсек — кольцо высотой меньше метра. Внутри компьютер, который вёл всю ракету в полёте.",
          "The Instrument Unit is a ring less than a meter tall. Inside is the computer that guided the whole rocket in flight."),
      },
    },
    {
      id: 8, title: L("Корабль «Аполлон»", "Apollo spacecraft"),
      brief: {
        text: L("Последняя деталь — корабль «Аполлон». Доставь его на ПРИЁМ. Посередине фермы — в них врезаться нельзя, найди проход.",
          "The last part is the Apollo spacecraft. Deliver it to the PAD. Girders stand in the middle — you can't fly through them, find a path."),
      },
      // Новой команды нет — экрана «Учимся» тоже нет, только задание.
      drone: { x: 5, y: 3 }, parts: [{ id: "APOLLO", x: 5, y: 1 }],
      girders: [[2, 1], [3, 1], [2, 2], [3, 2]], places: "APOLLO",
      commands: ["right", "left", "up", "down", "grab", "drop"], insertTiles: false, maxLines: 5, starter: "",
      goal: delivered("APOLLO"),
      success: { text: L("Корабль «Аполлон» установлен. Сатурн-5 собран полностью: 110 метров.", "Apollo spacecraft installed. Saturn V is fully stacked: 110 meters.") },
      hints: [
        { text: L("Фермы посередине, во втором и третьем ряду снизу. Нижний ряд свободен.", "The girders are in the middle, in rows 2 and 3 from the bottom. The bottom row is free.") },
        { text: L("Возьми корабль, спустись на нижний ряд и лети влево.", "Grab the spacecraft, drop to the bottom row and fly left.") },
        { text: READY, code: "down(2)\ngrab()\ndown(1)\nleft(5)\ndrop()" },
      ],
      fact: {
        photo: { src: "assets/photos/m08-crew.jpg", caption: L("Экипаж «Аполлона-11»: Армстронг, Коллинз, Олдрин", "The Apollo 11 crew: Armstrong, Collins, Aldrin") },
        title: L("16 июля 1969", "July 16, 1969"),
        text: L("Аполлон-11 стартовал 16 июля 1969 года. Экипаж: Нил Армстронг, Базз Олдрин и Майкл Коллинз.",
          "Apollo 11 launched on July 16, 1969. The crew: Neil Armstrong, Buzz Aldrin and Michael Collins."),
      },
    },
    {
      id: 9, title: L("Чек-лист", "Checklist"),
      brief: {
        text: L("Перед стартом ЦУП проверяет все системы. Передай три доклада: «Двигатели готовы», «Связь в норме», «Экипаж на борту».",
          "Before launch, Houston checks every system. Send three reports: “Engines ready”, “Radio OK”, “Crew aboard”."),
        note: L("Каждый доклад — своя строка со своим print.", "Each report is its own line with its own print."),
      },
      // Новой команды нет — экрана «Учимся» тоже нет.
      drone: { x: 3, y: 2 }, parts: [], girders: [],
      commands: [], insertTiles: false, maxLines: 5, starter: "",
      goal: (ctx) => {
        const n = ctx.prints.filter((t) => t.trim()).length;
        return n >= 3 ? null : G.errors.msg(L(`ЦУП получил докладов: ${n} из 3. Каждый доклад — отдельная строка с print.`, `Houston got ${n} of 3 reports. Each report is a separate line with print.`));
      },
      success: { text: L("Все системы — готов. Чек-лист пройден, {kid}.", "All systems go. Checklist complete, {kid}.") },
      hints: [
        { text: L("Нужно три строки, и в каждой — print с текстом в кавычках.", "You need three lines, each with print and text in quotes.") },
        { text: L('Первая строка: print("Двигатели готовы"). Остальные — так же, со своим текстом.', 'First line: print("Engines ready"). The others the same way, with their own text.') },
        { text: READY, code: L('print("Двигатели готовы")\nprint("Связь в норме")\nprint("Экипаж на борту")', 'print("Engines ready")\nprint("Radio OK")\nprint("Crew aboard")') },
      ],
      fact: {
        photo: { src: "assets/photos/m09-liftoff.jpg", caption: L("Старт «Аполлона-11», 16 июля 1969", "Apollo 11 liftoff, July 16, 1969") },
        title: L("Громче всех", "The loudest"),
        text: L("Старт Сатурна-5 — один из самых громких звуков, которые когда-либо создал человек.",
          "A Saturn V launch was one of the loudest sounds ever made by people."),
      },
    },
    {
      id: 10, title: L("Флажки", "Flags"),
      brief: {
        text: L("Перед стартом с ракеты снимают красные флажки. Флажок наверху — долети до него и возьми.",
          "Before launch, red flags come off the rocket. The flag is up high — fly to it and grab it."),
      },
      drone: { x: 0, y: 0 }, parts: [{ id: "FLAG", x: 3, y: 3 }],
      girders: [[1, 0], [2, 1]],
      commands: ["right", "left", "up", "down", "grab"], insertTiles: false, maxLines: 5, starter: "",
      goal: (ctx) => ctx.drone.holding === "FLAG" ? null
        : G.errors.msg(L("Флажок не снят: дрон должен долететь до него и выполнить grab().", "The flag isn't off yet: the drone must fly to it and run grab().")),
      success: { text: L("Флажок снят. Ракета готова к старту, {kid}.", "Flag removed. The rocket is ready for launch, {kid}.") },
      hints: [
        { text: L("Флажок на три клетки выше и на три правее. Внизу фермы — сначала поднимись.", "The flag is three squares up and three to the right. Girders are below — go up first.") },
        { text: L("up(3), потом right(3), потом grab().", "up(3), then right(3), then grab().") },
        { text: READY, code: "up(3)\nright(3)\ngrab()" },
      ],
      fact: {
        photo: { src: "assets/photos/m10-vab-platforms.jpg", caption: L("Сатурн-5 в здании сборки, среди рабочих площадок", "Saturn V in the assembly building, among the work platforms") },
        title: L("Remove before flight", "Remove before flight"),
        text: L("«Remove before flight» значит «убрать перед полётом». Такие красные ленты закрывают датчики и механизмы, пока ракета на Земле, и перед стартом их снимают.",
          "“Remove before flight” is written on red ribbons that cover sensors and mechanisms while the rocket is on the ground. They all come off before launch."),
      },
    },
    {
      id: 11, title: L("Обратный отсчёт", "Countdown"),
      brief: {
        text: L("Ракета на старте! Нужен отсчёт от 10 до 1. Программа почти готова: в первой строке впиши 10 в жёлтую рамку.",
          "The rocket is on the pad! We need a countdown from 10 to 1. The program is almost ready: on the first line, type 10 in the yellow box."),
        note: L("Числа пишутся без кавычек.", "Numbers go without quotes."),
      },
      // Затравка на главу 2: цикл уже написан, ребёнок вписывает только первое число.
      // В образце по очереди подсвечены три числа range: с чего начать, где стоп, шаг.
      example: { title: L("Знакомься: цикл", "Meet the loop"), code: "for i in range(3, 0, -1):\n    print(i)",
        steps: [
          { before: "for i in range(", add: "3", after: ", 0, -1):", text: L("Первое число — с чего начать отсчёт: 3.", "The first number is where the count starts: 3.") },
          { before: "for i in range(3, ", add: "0", after: ", -1):", text: L("Второе — где стоп: до 0 цикл не дойдёт, последним скажет 1.", "The second is where it stops: the loop won't reach 0, the last number is 1.") },
          { before: "for i in range(3, 0, ", add: "-1", after: "):", text: L("Третье — шаг: каждый раз на 1 меньше.", "The third is the step: one less each time.") },
          { before: "    ", add: "print(i)", after: "", text: L("Внутри цикла — print(i): сказать число. Цикл скажет 3, 2, 1.", "Inside the loop is print(i): say the number. The loop says 3, 2, 1.") },
        ], demoStep: 3 },
      drone: { x: 3, y: 2 }, parts: [], girders: [], allowLaunch: true,
      commands: [], insertTiles: false, maxLines: 5,
      starter: "for i in range(, 0, -1):\n    print(i)\nlaunch()\n",
      cursor: { line: 0, ch: 15 },
      slot: { line: 0, ch: 15 },
      // Число в кавычках — это текст. Подсказываем до запуска.
      codeCheck: (code) => /range\(\s*["']/.test(code)
        ? G.errors.msg(L("Числа пишутся без кавычек: range(10, 0, -1).", "Numbers go without quotes: range(10, 0, -1).")) : null,
      goal: (ctx) => ctx.launched ? null
        : G.errors.msg(L("Отсчёт есть, а старта нет. Не стирай launch() в последней строке.", "There is a countdown but no launch. Don't delete launch() on the last line.")),
      success: { text: L("Есть подъём! Цикл посчитал за тебя — в следующей главе научишься писать такие сам.", "Liftoff! The loop counted for you — in the next chapter you'll learn to write loops yourself.") },
      hints: [
        { text: L("В первой строке в скобках три числа. Первое — с чего начать отсчёт. Его место — в жёлтой рамке.", "The first line has three numbers in the brackets. The first is where the count starts. Its spot is the yellow box.") },
        { text: L("Отсчёт начинается с 10. Впиши 10 перед первой запятой, без кавычек.", "The count starts at 10. Type 10 before the first comma, without quotes."), code: "range(10, 0, -1)" },
        { text: READY, code: "for i in range(10, 0, -1):\n    print(i)\nlaunch()" },
      ],
      fact: {
        photo: { src: "assets/photos/m11-apollo17.jpg", caption: L("«Аполлон-17» ночью на стартовом столе", "Apollo 17 on the pad at night") },
        title: L("13 стартов", "13 launches"),
        text: L("Сатурн-5 стартовал 13 раз, с 1967 по 1973 год. На нём к Луне летали все экипажи «Аполлонов».",
          "Saturn V launched 13 times, from 1967 to 1973. Every Apollo crew that flew to the Moon rode on it."),
      },
    },
  ];

  // Миссия 0 · Проверка систем: онбординг. Каждый пункт — настоящее действие.
  const SYSTEMS_CHECK = {
    id: 0, title: L("Проверка систем", "Systems check"),
    drone: { x: 2, y: 1 }, parts: [], girders: [],
    commands: ["right"], insertTiles: true, maxLines: 5, starter: "",
    goal: () => null,
    // Голос читает ровно то, что написано в выноске (text).
    steps: [
      { key: "bay", label: L("Корпус", "Hangar"),
        text: L("Проверка систем, 4 пункта. Пункт 1 — корпус. Здесь дрон собирает ракету. Детали ставят на площадку ПРИЁМ. Нажми на свой дрон.",
          "Systems check, 4 steps. Step 1 — the hangar. This is where the drone builds the rocket. Parts go on the PAD. Tap your drone."),
        done: L("Дрон на связи.", "Drone online.") },
      { key: "tiles", label: L("Пульт", "Console"),
        text: L("Пункт 2 — пульт. Плитки вписывают команды в программу. Нажми плитку right() — вправо.",
          "Step 2 — the console. Tiles add commands to the program. Press the right() tile."),
        done: L("Команда в программе.", "Command added.") },
      { key: "keys", label: L("Клавиатура", "Keyboard"),
        text: L("Пункт 3 — клавиатура. Нажми Enter — новая строка. Напечатай left() — влево. Скобка: Shift и 9.",
          "Step 3 — the keyboard. Press Enter for a new line. Type left(). The bracket is Shift and 9."),
        textTouch: L("Пункт 3 — клавиатура. Нажми на программу, перейди на новую строку и напечатай left() — влево.",
          "Step 3 — the keyboard. Tap the program, go to a new line and type left()."),
        keys: [["Enter"], ["L"], ["E"], ["F"], ["T"], ["Shift", "9"]],
        done: L("Клавиатура в норме.", "Keyboard OK.") },
      { key: "run", label: L("Пуск", "Run"),
        text: L("Пункт 4 — пуск. Нажми ПУСК: дрон выполнит программу.", "Step 4 — run. Press RUN: the drone will run the program."),
        done: "" },
    ],
    final: L("Все системы — готов. Борт {name}, смена начинается.", "All systems go. {name}, your shift begins."),
  };

  // Плитки-команды. ru — перевод под командой (в английской версии не нужен).
  const TILES = {
    print: { ru: L("напечатать", ""), label: 'print("…")', insert: 'print("")', caret: -2, glyph: "◉" },
    right: { ru: L("вправо", ""), label: "right()", insert: "right()", glyph: "→" },
    left: { ru: L("влево", ""), label: "left()", insert: "left()", glyph: "←" },
    up: { ru: L("вверх", ""), label: "up()", insert: "up()", glyph: "↑" },
    down: { ru: L("вниз", ""), label: "down()", insert: "down()", glyph: "↓" },
    grab: { ru: L("взять", ""), label: "grab()", insert: "grab()", glyph: "⊐" },
    drop: { ru: L("поставить", ""), label: "drop()", insert: "drop()", glyph: "⊔" },
    launch: { ru: L("старт", ""), label: "launch()", insert: "launch()", glyph: "▲" },
  };

  // Словарик: английские слова Python по-русски (в английской версии пустой).
  const WORDS = L({ print: "напечатать", right: "вправо", left: "влево", up: "вверх", down: "вниз", grab: "взять", drop: "поставить", launch: "старт", for: "повторить", range: "столько раз" }, {});

  // Прогресс из версии с 8 миссиями: старый номер → новый.
  const OLD_TO_NEW = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 7, 7: 8, 8: 11 };

  // Карта глав для главного экрана (названия — из docs/PLAN.md). Открыта пока только глава 1.
  // Орбита идёт перед Луной, как в настоящем полёте «Аполлона-11».
  const CHAPTERS = [
    L("Монтажный корпус", "Assembly building"), L("Орбита Земли", "Earth orbit"), L("Луна", "The Moon"),
    L("Марс", "Mars"), L("Европа", "Europa"), L("Пояс астероидов", "Asteroid belt"), L("Кольца Сатурна", "Saturn's rings"),
    L("Чёрная дыра", "Black hole"), L("Червоточина", "Wormhole"), L("Свободный полёт", "Free flight"),
  ].map((title, i) => ({ n: i + 1, title }));

  // Медали главы 1: за миссию (mission) или за нашивку (patch).
  const MEDALS = [
    { id: "radio", mission: 1, title: L("Первая связь", "First contact") },
    { id: "stack", mission: 3, title: L("Сборщик", "Assembler") },
    { id: "debug", mission: 6, title: L("Отладчик", "Debugger") },
    { id: "pilot", mission: 8, title: L("Пилот", "Pilot") },
    { id: "exp1", patch: true, title: L("Экспедиция 1", "Expedition 1") },
  ];

  G.levels = { OLD_TO_NEW, WORDS, MISSIONS, SYSTEMS_CHECK, TILES, ROCKET, PLATFORM, GRID, SCALE_REF, CHAPTERS, MEDALS };
})();
