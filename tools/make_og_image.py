# Renders the 1200x630 link-preview image (Open Graph) for the landing page.
import math, sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
S = 2                       # supersampling factor for smooth edges
W, H = 1200 * S, 630 * S
BG, TEXT, MUTED, ACCENT = '#14161b', '#eceae4', '#a3a7b0', '#f0a92b'
FONTS = 'C:/Windows/Fonts/'

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

# Orbits: full circles around the Sun in the lower-left corner, planets exactly on them.
cx, cy = 150 * S, 540 * S
orbits = [  # colour, radius, angle (deg, counter-clockwise from +x), planet radius
    ('#2f7fd8', 85, 40, 7),
    ('#c8492c', 150, 62, 6),
    ('#b5713a', 245, 30, 17),
    ('#b89b4b', 335, 55, 15),
    ('#3aa6b0', 415, 22, 10),
    ('#3a5fcd', 490, 44, 10),
]
for color, r, _, _ in orbits:
    r *= S
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=3 * S)
sun_r = 46 * S
d.ellipse([cx - sun_r, cy - sun_r, cx + sun_r, cy + sun_r], fill='#f5b400')
for color, r, deg, pr in orbits:
    t = math.radians(deg)
    x, y = cx + r * S * math.cos(t), cy - r * S * math.sin(t)
    pr *= S
    d.ellipse([x - pr, y - pr, x + pr, y + pr], fill=color)

# Text block on the right.
x0 = 670 * S
max_width = W - x0 - 40 * S
# Largest title size whose longer line still fits next to the orbits.
size = 70
while ImageFont.truetype(FONTS + 'segoeuib.ttf', size * S).getlength('Sluneční soustava') > max_width:
    size -= 1
bold = ImageFont.truetype(FONTS + 'segoeuib.ttf', size * S)
semi = ImageFont.truetype(FONTS + 'seguisb.ttf', 36 * S)
regular = ImageFont.truetype(FONTS + 'segoeui.ttf', 30 * S)
small = ImageFont.truetype(FONTS + 'segoeui.ttf', 24 * S)
d.text((x0, 120 * S), 'Sluneční soustava', font=bold, fill=TEXT)
d.text((x0, (120 + size * 1.2) * S), 'v Sobětuchách', font=bold, fill=TEXT)
d.text((x0, 320 * S), 'Model v měřítku 1 : 1 miliarda', font=semi, fill=ACCENT)
d.text((x0, 380 * S), 'Slunce 1,39 m · Země 150 m od Slunce', font=regular, fill=MUTED)
d.text((x0, 422 * S), 'Neptun 4,5 km daleko', font=regular, fill=MUTED)
d.text((x0, 540 * S), 'Naučná stezka · plánovací mapa', font=small, fill=MUTED)

img = img.resize((1200, 630), Image.LANCZOS)
img.save(out, 'PNG', optimize=True)
print(out, img.size, 'title size', size)
