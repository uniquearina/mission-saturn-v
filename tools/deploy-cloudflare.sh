#!/bin/bash
# Выкладывает игру на Cloudflare Pages: https://saturn5-mission.pages.dev
# Вместе с сайтом уходят серверные функции (functions/) — вход по почте и профили детей.
# Запуск из папки проекта: bash tools/deploy-cloudflare.sh
set -e
cd "$(dirname "$0")/.."
rm -rf build/site && mkdir -p build/site
cp -R index.html css js vendor assets build/site/
# Таблицы базы (команда безопасна при повторе: CREATE ... IF NOT EXISTS)
for f in migrations/*.sql; do npx --yes wrangler@4 d1 execute saturn5 --remote --file="$f" --yes || echo "Таблицы не обновлены ($f) — продолжаю"; done
npx --yes wrangler@4 pages deploy build/site --project-name saturn5-mission --branch main --commit-dirty=true
