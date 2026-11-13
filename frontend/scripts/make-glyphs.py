"""Turns the letters of our headline font (TeX Gyre Heros Bold, a free Helvetica look-alike) into plain outlines
(src/glyphs.json), so the hero title and the loading screen can draw them as vector shapes with hand-cut,
roughened edges (src/cutword.js) instead of as page text.

Run it with a Python that has fontTools and brotli:  python3 scripts/make-glyphs.py
"""
import json, math
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
FONT = "public/fonts/texgyreheros-bold.woff2"

f = TTFont(FONT)
cmap = f.getBestCmap()
gs = f.getGlyphSet()
hmtx = f["hmtx"]


def flatten(rec):
    """Recorded pen strokes -> list of closed contours (lists of [x, y]), curves cut into short straight pieces."""
    contours, cur, last = [], [], None
    for op, pts in rec:
        if op == "moveTo":
            cur = [pts[0]]
            last = pts[0]
        elif op == "lineTo":
            cur.append(pts[0])
            last = pts[0]
        elif op == "curveTo":
            p0, (p1, p2, p3) = last, pts
            n = max(4, int(math.dist(p0, p3) / 45) + 3)
            for i in range(1, n + 1):
                t = i / n
                u = 1 - t
                cur.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
            last = p3
        elif op == "qCurveTo":
            raise SystemExit("quadratic curves not expected in a CFF font")
        elif op in ("closePath", "endPath"):
            if len(cur) > 1 and cur[0] == cur[-1]:
                cur.pop()
            if len(cur) > 2:
                contours.append(cur)
            cur = []
    return contours


out = {"upm": f["head"].unitsPerEm, "cap": f["OS/2"].sCapHeight, "glyphs": {}, "kern": {}, "space": hmtx[cmap[32]][0]}
for ch in LETTERS:
    name = cmap[ord(ch)]
    pen = RecordingPen()
    gs[name].draw(pen)
    cs = flatten(pen.value)
    # y points up in fonts; the page's y points down, with the baseline at 0
    out["glyphs"][ch] = {"adv": hmtx[name][0], "c": [[round(v) for p in c for v in (p[0], -p[1])] for c in cs]}


# Pair kerning (GPOS "kern" feature), only for the letters we use
def class_of(cd, g):
    return cd.classDefs.get(g, 0) if cd else 0


names = {ch: cmap[ord(ch)] for ch in LETTERS}
gpos = f["GPOS"].table
for lookup in gpos.LookupList.Lookup:
    for st in lookup.SubTable:
        if st.LookupType == 9:
            st = st.ExtSubTable
        if st.LookupType != 2:
            continue
        cov = st.Coverage.glyphs
        for a, na in names.items():
            if na not in cov:
                continue
            for b, nb in names.items():
                v = 0
                if st.Format == 1:
                    ps = st.PairSet[cov.index(na)]
                    for rec in ps.PairValueRecord:
                        if rec.SecondGlyph == nb and rec.Value1:
                            v = getattr(rec.Value1, "XAdvance", 0) or 0
                else:
                    c1 = class_of(st.ClassDef1, na)
                    c2 = class_of(st.ClassDef2, nb)
                    rec = st.Class1Record[c1].Class2Record[c2]
                    v = (getattr(rec.Value1, "XAdvance", 0) or 0) if rec.Value1 else 0
                if v:
                    out["kern"][a + b] = out["kern"].get(a + b, 0) + v

with open("src/glyphs.json", "w") as fh:
    json.dump(out, fh, separators=(",", ":"))
print("glyphs:", len(out["glyphs"]), "kern pairs:", out["kern"])
