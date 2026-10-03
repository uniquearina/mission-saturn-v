# Автотесты (Playwright + Google Chrome)

Подготовка (один раз): `cd tests && npm init -y && npm i playwright-core@1.56`
Сервер без функций (обычная игра): `cd .. && python3 -m http.server 8765`
Сервер с функциями (вход, фото): `bash tools/deploy-cloudflare.sh` собирает build/site; локально: `npx wrangler@4 pages dev build/site --port 8788` (нужен .dev.vars с DEV_ECHO=1, OWNER_EMAIL и OPENAI_API_KEY).

Запуск: `S=$(pwd) node e2e.cjs` — переменная S = папка для скриншотов.
- e2e.cjs — вся глава 1 по-русски (localhost:8765), e2e-en.cjs — по-английски
- mobile.cjs — эмуляция iPhone, lock.cjs — замок проверки систем
- login2.cjs — вход владельца по почте и профили (localhost:8788), portrait.cjs — ИИ-портрет для семьи (настоящий запрос в OpenAI, 8788)
- family.cjs — список доверенных почт, приглашения, чужая почта, «Убрать», фото в шлеме без запросов к серверу (8788)
