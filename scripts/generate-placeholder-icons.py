"""Génère des icônes PWA placeholder neutres (à remplacer une fois l'identité
visuelle validée). Usage: python3 scripts/generate-placeholder-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG = (17, 24, 39)  # gray-900, neutre en attendant la charte graphique
FG = (255, 255, 255)


def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Zone de sécurité pour les icônes maskable (cercle central ~80%)
    letter_scale = 0.42 if maskable else 0.55
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            int(size * letter_scale),
        )
    except OSError:
        font = ImageFont.load_default()

    text = "B"
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]),
        text,
        fill=FG,
        font=font,
    )
    return img


draw_icon(192, maskable=False).save(OUT_DIR / "icon-192.png")
draw_icon(512, maskable=False).save(OUT_DIR / "icon-512.png")
draw_icon(512, maskable=True).save(OUT_DIR / "icon-maskable-512.png")

print(f"Icônes générées dans {OUT_DIR}")
