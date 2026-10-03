#!/bin/bash
# Двойной щелчок: запускает игру «Миссия Сатурн-5» в браузере.
# Окно терминала держите открытым, пока идёт игра. Закрыли окно — игра остановится.
cd "$(dirname "$0")"
PORT=8765
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Миссия Сатурн-5 запущена: http://localhost:$PORT"
echo "Чтобы остановить, закройте это окно."
(sleep 1 && open "http://localhost:$PORT/") &
python3 -m http.server $PORT >/dev/null 2>&1
