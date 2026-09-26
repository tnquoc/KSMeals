"""Draw the KSMeals app icon, adaptive icon layers, splash mark and favicon with Pillow.

Flat, geometric artwork drawn at 4x and downsampled for smooth edges.

Usage:
  uv run python scripts/make_icons.py preview        # scratch/icon_preview.png with all variants
  uv run python scripts/make_icons.py build <variant> # write app/assets/images/*
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "assets" / "images"

S = 4096  # working resolution
GREEN_TOP = (46, 158, 104)
GREEN_BOTTOM = (27, 107, 67)
BRAND_GREEN = "#1F7A4D"
WHITE = (255, 255, 255, 255)
RICE = (255, 247, 230, 255)
LEAF = (190, 240, 205, 255)
LEAF_VEIN = (46, 158, 104, 255)
ORANGE = (255, 181, 71, 255)


def gradient(size: int) -> Image.Image:
    img = Image.new("RGBA", (1, size))
    for y in range(size):
        t = y / (size - 1)
        img.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(GREEN_TOP, GREEN_BOTTOM)) + (255,))
    return img.resize((size, size))


def box(cx, cy, w, h):
    return [(cx - w / 2) * S, (cy - h / 2) * S, (cx + w / 2) * S, (cy + h / 2) * S]


def leaf(layer: Image.Image, cx: float, cy: float, length: float, angle: float, color, vein):
    """A vesica-shaped leaf: intersection of two circles, rotated."""
    size = int(length * S * 1.6)
    m = Image.new("L", (size, size), 0)
    r = length * S * 0.62
    c = size / 2
    off = length * S * 0.36
    a = Image.new("L", (size, size), 0)
    ImageDraw.Draw(a).ellipse([c - r, c - off - r, c + r, c - off + r], fill=255)
    b = Image.new("L", (size, size), 0)
    ImageDraw.Draw(b).ellipse([c - r, c + off - r, c + r, c + off + r], fill=255)
    m = ImageChops.multiply(a, b)
    shape = Image.new("RGBA", (size, size), color)
    shape.putalpha(m)
    d = ImageDraw.Draw(shape)
    d.line([(c - length * S * 0.42, c), (c + length * S * 0.42, c)], fill=vein, width=int(S * 0.012))
    shape = shape.rotate(angle, resample=Image.BICUBIC, expand=False)
    layer.alpha_composite(shape, (int(cx * S - size / 2), int(cy * S - size / 2)))


def heart(d: ImageDraw.ImageDraw, cx: float, cy: float, w: float, color):
    r = w * S / 4
    x, y = cx * S, cy * S
    d.ellipse([x - 2 * r, y - r * 1.1, x, y + r * 0.9], fill=color)
    d.ellipse([x, y - r * 1.1, x + 2 * r, y + r * 0.9], fill=color)
    d.polygon([(x - 1.93 * r, y + 0.25 * r), (x + 1.93 * r, y + 0.25 * r), (x, y + 2.3 * r)], fill=color)


def shield_check(d: ImageDraw.ImageDraw, cx: float, cy: float, w: float, color, mark):
    x, y, u = cx * S, cy * S, w * S
    d.polygon([(x - u / 2, y - u * 0.5), (x + u / 2, y - u * 0.5), (x + u / 2, y + u * 0.05),
               (x, y + u * 0.6), (x - u / 2, y + u * 0.05)], fill=color)
    d.rounded_rectangle([x - u / 2, y - u * 0.62, x + u / 2, y - u * 0.3], radius=u * 0.12, fill=color)
    d.line([(x - u * 0.22, y + u * 0.02), (x - u * 0.04, y + u * 0.2), (x + u * 0.25, y - u * 0.18)],
           fill=mark, width=int(u * 0.12), joint="curve")


def steam(d: ImageDraw.ImageDraw, cx: float, top: float, bottom: float, amp: float, width: float, color):
    """A wavy wisp of steam: a thick sine curve with round ends, drawn as overlapping dots."""
    import math
    steps = 240
    r = width * S / 2
    for i in range(steps + 1):
        t = i / steps
        y = bottom + (top - bottom) * t
        x = cx + amp * math.sin(t * 2 * math.pi)
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=color)


def mark(variant: str, color=None) -> Image.Image:
    """The artwork on a transparent square (bowl of rice with a leaf, plus a variant accent)."""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bowl = color or WHITE
    rice = color or RICE
    # rice mound, then bowl body, rim and foot
    d.pieslice(box(0.5, 0.60, 0.50, 0.34), 180, 360, fill=rice)
    d.pieslice(box(0.5, 0.56, 0.64, 0.50), 0, 180, fill=bowl)
    d.rounded_rectangle(box(0.5, 0.565, 0.68, 0.045), radius=0.022 * S, fill=bowl)
    d.rounded_rectangle(box(0.5, 0.825, 0.22, 0.04), radius=0.02 * S, fill=bowl)
    leaf(layer, 0.60, 0.33, 0.22, 35, color or LEAF, (0, 0, 0, 0) if color else LEAF_VEIN)
    if variant == "heart":
        heart(d, 0.5, 0.645, 0.13, color or ORANGE)
    elif variant == "steam":
        for x in (0.40, 0.5):
            d.arc(box(x, 0.30, 0.06, 0.14), 90, 270, fill=bowl, width=int(0.018 * S))
    elif variant == "shield":
        shield_check(d, 0.72, 0.72, 0.20, color or ORANGE, (0, 0, 0, 0) if color else WHITE)
    elif variant == "shield_steam":
        wisp = color or (255, 255, 255, 215)
        steam(d, 0.40, 0.17, 0.39, 0.025, 0.028, wisp)
        steam(d, 0.49, 0.13, 0.37, -0.025, 0.028, wisp)
        if color:
            # Single-colour icon: cut a transparent gap so the shield stays separate from the bowl.
            shield_check(d, 0.72, 0.72, 0.26, (0, 0, 0, 0), (0, 0, 0, 0))
        shield_check(d, 0.72, 0.72, 0.20, color or ORANGE, (0, 0, 0, 0) if color else WHITE)
    return layer


def icon(variant: str, size: int = 1024) -> Image.Image:
    img = gradient(S)
    img.alpha_composite(mark(variant))
    return img.resize((size, size), Image.LANCZOS).convert("RGB")


def padded(art: Image.Image, scale: float, size: int = 1024) -> Image.Image:
    """Shrink artwork into the middle of a transparent canvas (Android adaptive safe zone, splash)."""
    small = art.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((S - small.width) // 2, (S - small.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def preview():
    variants = sys.argv[2:] or ["heart", "steam", "shield"]
    tile, gap = 360, 40
    sheet = Image.new("RGB", (len(variants) * (tile + gap) + gap, tile + 2 * gap + 120), (246, 247, 249))
    d = ImageDraw.Draw(sheet)
    for i, v in enumerate(variants):
        img = icon(v, tile)
        m = Image.new("L", (tile, tile), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, tile, tile], radius=tile * 0.22, fill=255)  # iOS-like mask
        x = gap + i * (tile + gap)
        sheet.paste(img, (x, gap), m)
        small = icon(v, 60)
        sheet.paste(small, (x + tile // 2 - 30, gap + tile + 20))
        d.text((x + 10, gap + tile + 90), v, fill=(28, 36, 48))
    out = ROOT / "scratch" / "icon_preview.png"
    out.parent.mkdir(exist_ok=True)
    sheet.save(out)
    print(out)


def build(variant: str):
    icon(variant).save(OUT / "icon.png")
    art = mark(variant)
    # Android adaptive: keep the art inside the central safe zone (~66%)
    padded(art, 0.72).save(OUT / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), BRAND_GREEN).save(OUT / "android-icon-background.png")
    padded(mark(variant, color=WHITE), 0.72).save(OUT / "android-icon-monochrome.png")
    padded(art, 1.0).save(OUT / "splash-icon.png")
    icon(variant, 48).save(OUT / "favicon.png")
    icon(variant, 128).save(OUT / "logo.png")  # in-app header and web tab bar
    # Web app (GitHub Pages): home-screen icons and the manifest's icons
    public = ROOT / "app" / "public"
    icon(variant, 180).save(public / "apple-touch-icon.png")
    icon(variant, 192).save(public / "icon-192.png")
    icon(variant, 512).save(public / "icon-512.png")
    maskable = Image.new("RGBA", (1024, 1024), BRAND_GREEN)
    maskable.alpha_composite(padded(art, 0.72))  # same safe zone as the Android adaptive icon
    maskable.resize((512, 512), Image.LANCZOS).convert("RGB").save(public / "icon-maskable-512.png")
    print("wrote", ", ".join(p.name for p in sorted(OUT.glob("*.png"))))


if __name__ == "__main__":
    {"preview": lambda: preview(), "build": lambda: build(sys.argv[2])}[sys.argv[1]]()
