#!/usr/bin/env python3
"""Draws the Beatrix logo: a flat, cel-shaded take on the Alpha card's burning ring.
Writes public/logo.svg (rounded corners) and public/logo-full.svg (full bleed, for PNG app icons)."""
import math

CX, CY = 256, 236

def burst(n, outer, inner, twist, fill, rot=0.0):
    step = 2 * math.pi / n
    def pt(turns, radius):
        a = rot + turns * step - math.pi / 2
        return f"{CX + radius * math.cos(a):.1f} {CY + radius * math.sin(a):.1f}"
    d = [f"M{pt(-0.5, inner)}"]
    for i in range(n):
        d.append(f"Q{pt(i - 0.28, outer * 0.74 + inner * 0.26)} {pt(i + twist, outer)}")
        d.append(f"Q{pt(i + 0.34, inner * 1.03)} {pt(i + 0.5, inner)}")
    return f'<path d="{" ".join(d)}Z" fill="{fill}"/>'

def glint(x, y, r, fill="#fff"):
    k = r * 0.16
    return (f'<path d="M{x} {y - r}Q{x + k} {y - k} {x + r} {y}Q{x + k} {y + k} {x} {y + r}'
            f'Q{x - k} {y + k} {x - r} {y}Q{x - k} {y - k} {x} {y - r}Z" fill="{fill}"/>')

def svg(rounded):
    clip = '<clipPath id="frame"><rect width="512" height="512" rx="%d"/></clipPath>' % (104 if rounded else 0)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Beatrix">
<defs>{clip}
<clipPath id="band"><path fill-rule="evenodd" d="M{CX - 120} {CY}a120 120 0 1 0 240 0a120 120 0 1 0 -240 0ZM{CX - 76} {CY}a76 76 0 1 0 152 0a76 76 0 1 0 -152 0Z"/></clipPath>
<clipPath id="core"><circle cx="{CX}" cy="{CY}" r="76"/></clipPath></defs>
<g clip-path="url(#frame)">
<rect width="512" height="512" fill="#6d0f2e"/>
{burst(13, 262, 176, 0.22, "#a81a3c", 0.10)}
{burst(11, 224, 158, 0.24, "#e8423a", 0.35)}
{burst(9, 190, 140, 0.26, "#ff8a2b", 0.05)}
{burst(12, 160, 128, 0.20, "#ffc93c", 0.30)}
<ellipse cx="256" cy="640" rx="430" ry="190" fill="#e8423a"/>
<ellipse cx="256" cy="662" rx="430" ry="190" fill="#ff8a2b"/>
<ellipse cx="256" cy="686" rx="430" ry="190" fill="#ffc93c"/>
<circle cx="{CX}" cy="{CY}" r="120" fill="#fff6d6"/>
<g clip-path="url(#band)"><circle cx="{CX - 26}" cy="{CY - 30}" r="128" fill="none" stroke="#ffd27a" stroke-width="60" transform="translate(52 60)"/></g>
<circle cx="{CX}" cy="{CY}" r="76" fill="#b3174f"/>
<g clip-path="url(#core)">
<circle cx="{CX + 30}" cy="{CY + 34}" r="80" fill="#7c0f38"/>
<circle cx="{CX - 6}" cy="{CY - 8}" r="70" fill="#b3174f"/>
<path d="M{CX - 50} {CY - 14}q14 -34 50 -42q-22 16 -30 44Z" fill="#ee5b8c"/>
</g>
<circle cx="{CX}" cy="{CY}" r="120" fill="none" stroke="#6d0f2e" stroke-width="7"/>
<circle cx="{CX}" cy="{CY}" r="76" fill="none" stroke="#6d0f2e" stroke-width="7"/>
{glint(CX - 84, CY - 86, 46)}
{glint(CX + 104, CY + 78, 20)}
<circle cx="{CX - 126}" cy="{CY - 30}" r="6" fill="#fff"/>
</g></svg>
'''

for name, rounded in (("logo.svg", True), ("logo-full.svg", False)):
    open(f"public/{name}", "w").write(svg(rounded))
print("wrote public/logo.svg, public/logo-full.svg")
