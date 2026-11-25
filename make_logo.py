#!/usr/bin/env python3
"""Draws the Beatrix logo: a flat letter B. One stem in, two bowls out, the lower one bigger
("Ask once. Get more."). Writes public/logo.svg (rounded corners) and public/logo-full.svg
(full bleed, for the PNG app icons)."""

def glint(x, y, r, fill):
    k = r * 0.16
    return (f'<path d="M{x} {y - r}Q{x + k} {y - k} {x + r} {y}Q{x + k} {y + k} {x} {y + r}'
            f'Q{x - k} {y + k} {x - r} {y}Q{x - k} {y - k} {x} {y - r}Z" fill="{fill}"/>')

def svg(rounded):
    rx = 112 if rounded else 0
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Beatrix">
<defs><clipPath id="frame"><rect width="512" height="512" rx="{rx}"/></clipPath></defs>
<g clip-path="url(#frame)">
<rect width="512" height="512" fill="#241b4d"/>
<circle cx="256" cy="262" r="214" fill="#2e2363"/>
<circle cx="420" cy="452" r="150" fill="#3a2d7a"/>
<path d="M206 244h52a64 64 0 0 1 0 128h-52" fill="none" stroke="#ff6b4a" stroke-width="56"/>
<path d="M206 140h40a52 52 0 0 1 0 104h-40" fill="none" stroke="#ffb81c" stroke-width="56"/>
<rect x="150" y="112" width="56" height="288" rx="28" fill="#fff3d6"/>
<rect x="150" y="300" width="56" height="100" rx="28" fill="#f3dcae"/>
<rect x="150" y="112" width="56" height="230" rx="28" fill="#fff3d6"/>
{glint(382, 132, 46, "#fff3d6")}
{glint(112, 418, 20, "#ffb81c")}
<circle cx="424" cy="196" r="7" fill="#fff3d6"/>
</g></svg>
'''

for name, rounded in (("logo.svg", True), ("logo-full.svg", False)):
    open(f"public/{name}", "w").write(svg(rounded))
print("wrote public/logo.svg, public/logo-full.svg")
