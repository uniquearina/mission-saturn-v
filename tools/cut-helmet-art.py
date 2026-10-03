"""Вырезает зелёное стекло шлема из шаблонов OpenAI (media-src/helmet/*.png) → прозрачная дырка.
Печатает рамку дырки (x, y, w, h) — её вписать в HOLES в js/helmet.js.

Запуск: python3 tools/cut-helmet-art.py media-src/helmet/avatar-1.png assets/helmet/avatar.webp
"""
import sys
from PIL import Image


def cut(src, dst):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    # Рамка дырки — по самому большому пятну чисто-зелёных пикселей
    # (зелёная лампочка ПИПа — отдельное маленькое пятно, её не трогаем).
    green = {(x, y) for y in range(h) for x in range(w)
             if (lambda p: p[1] > 200 and p[0] < 110 and p[2] < 110)(px[x, y])}
    best, seen = [], set()
    for start in green:
        if start in seen:
            continue
        blob, stack = [], [start]
        seen.add(start)
        while stack:
            x, y = stack.pop()
            blob.append((x, y))
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in green and q not in seen:
                    seen.add(q); stack.append(q)
        if len(blob) > len(best):
            best = blob
    xs, ys = [p[0] for p in best], [p[1] for p in best]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # Внутри рамки (с запасом) — мягкая прозрачность по «зелёности» и чистка зелёной каймы.
    pad = 8
    for y in range(max(0, y0 - pad), min(h, y1 + pad + 1)):
        for x in range(max(0, x0 - pad), min(w, x1 + pad + 1)):
            r, g, b, a = px[x, y]
            k = g - max(r, b)
            if k <= 20:
                continue
            alpha = max(0, min(255, int(255 * (1 - (k - 20) / 80))))
            px[x, y] = (r, min(g, max(r, b) + 10), b, alpha)
    im.save(dst, quality=88, method=6)
    return x0, y0, x1 - x0 + 1, y1 - y0 + 1


if __name__ == "__main__":
    print(cut(sys.argv[1], sys.argv[2]))
