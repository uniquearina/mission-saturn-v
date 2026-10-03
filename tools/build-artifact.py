"""Собирает страницу для публикации на claude.ai: index.html без <html>/<head>/<body>.
Остальные файлы (css, js, vendor) публикуются рядом как есть.
Запуск: python3 tools/build-artifact.py
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")
body = src.split("<body>", 1)[1].rsplit("</body>", 1)[0].strip() + "\n"
out = root / "dist" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(body, encoding="utf-8")
print(f"{out.relative_to(root)}: {len(body)} байт")
