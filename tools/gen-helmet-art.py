"""Один раз рисует в OpenAI шаблоны для «фото в шлеме»: скафандр, шлем и ПИП — без ребёнка.
Внутри стекла шлема — ровный зелёный (хромакей); tools/cut-helmet-art.py вырезает его,
и игра кладёт лицо ребёнка под шаблон прямо на устройстве. Фото детей в OpenAI не уходит.

Запуск: python3 tools/gen-helmet-art.py [avatar|ch1 ...] [--n 2]
Ключ — OPENAI_API_KEY из .dev.vars. Исходники — media-src/helmet/<сцена>-<n>.png.
"""
import base64, json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

root = Path(__file__).resolve().parent.parent
key = next(l.split("=", 1)[1].strip() for l in (root / ".dev.vars").read_text().splitlines() if l.startswith("OPENAI_API_KEY="))
out = root / "media-src" / "helmet"
out.mkdir(parents=True, exist_ok=True)

# ПИП — так же, как в промптах портретов (functions/api/portrait.js) и на игровом поле.
PIP = ("PIP, a small robot drone: a compact light-grey boxy body with rounded corners, a dark visor window and a small "
       "glowing green light on the front, one horizontal arm on top with a spinning rotor at each end, and a two-finger "
       "gripper claw underneath. About the size of a football, looks like real 1960s NASA hardware, friendly but not cartoonish.")
GREEN = ("IMPORTANT: there is no person and no face. The whole opening of the helmet, where the head would be, is filled "
         "with flat, uniform, pure chroma-key green (#00FF00): perfectly even color, no shading, no reflections, no glare "
         "over it, a clean round shape.")
NO_TEXT = "No text, no name tags, no real logos, no flags."
PROMPTS = {
    "avatar": ("A realistic 1969 NASA official astronaut portrait photograph, square, head and shoulders, front view, centered. "
               "A white Apollo A7L spacesuit sized for a 7-year-old child, with the blue anodized neck ring and the red and blue "
               "hose connectors on the chest, plain blue studio backdrop, soft studio light, vintage Kodak film colors and grain. "
               "The astronaut wears a clear Apollo bubble helmet seated in the neck ring; the helmet opening is in the upper "
               f"middle of the image, about 45% of the image width. {GREEN} Next to the astronaut hovers {PIP} PIP hovers just "
               f"above the astronaut's shoulder on the right side of the image, fully in frame. {NO_TEXT}"),
    "ch1": ("A realistic vintage 1969 photograph at the Kennedy Space Center launch pad at dawn, square. In the foreground, "
            "waist-up, front view, slightly left of center: a young astronaut, a child of about 7, in a white Apollo A7L "
            "spacesuit with the blue neck ring, wearing a clear bubble helmet; the helmet opening is about 30% of the image "
            f"width. Behind: the huge white Saturn V rocket with black stripes and its red launch tower. {GREEN} Beside the "
            f"astronaut, at head height, hovers {PIP} Florida morning sky, warm film colors and grain. {NO_TEXT}"),
}


def draw(scene, i):
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps({"model": "gpt-image-2", "prompt": PROMPTS[scene], "size": "1024x1024",
                         "quality": "high", "output_format": "png"}).encode(),
        headers={"authorization": f"Bearer {key}", "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        return f"{scene}-{i}: ошибка {e.code} {e.read()[:300]!r}"
    path = out / f"{scene}-{i}.png"
    path.write_bytes(base64.b64decode(d["data"][0]["b64_json"]))
    return f"{scene}-{i}: {path.relative_to(root)}"


args = [a for a in sys.argv[1:] if not a.startswith("--")]
n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 2
scenes = [a for a in args if a in PROMPTS] or list(PROMPTS)
jobs = [(s, i) for s in scenes for i in range(1, n + 1)]
with ThreadPoolExecutor(len(jobs)) as ex:
    for line in ex.map(lambda j: draw(*j), jobs):
        print(line)
