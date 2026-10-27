"""Construye hojas de contacto de páginas renderizadas para revisión visual interna."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

folder = Path(sys.argv[1])
prefix = sys.argv[2]
start, stop = int(sys.argv[3]), int(sys.argv[4])
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 28)
for first in range(start, stop + 1, 8):
    page_numbers = range(first, min(first + 8, stop + 1))
    canvas = Image.new("RGB", (1840, 1240), "white")
    draw = ImageDraw.Draw(canvas)
    for slot, number in enumerate(page_numbers):
        filename = folder / f"{prefix}-{number}.png"
        if not filename.exists():
            filename = folder / f"{prefix}-{number:02d}.png"
        page = Image.open(filename)
        page.thumbnail((440, 570))
        x, y = (slot % 4) * 460, (slot // 4) * 620
        canvas.paste(page, (x, y + 42))
        draw.text((x + 8, y + 6), str(number), font=font, fill="black")
    canvas.save(folder / f"{prefix}-contact-{first}-{min(first+7,stop)}.png")
