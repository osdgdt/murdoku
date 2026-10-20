"""Libreria grafica "tabellone da scatola" in scala di grigi (pensata per la stampa in bianco e nero).

Pezzi con ombra e spessore, terreni illustrati, cornici, striscioni e cartigli. Solo font standard dei PDF.
"""
import math
import random

from reportlab.lib.colors import Color, black, white
from reportlab.lib.utils import simpleSplit

from .giochi_tavolo import _MEEPLE_CORPO, _percorso, _punti_esagono, segmenti_rosone

TITOLO_FONT = "Times-Bold"
FONT = "Helvetica"
FONT_B = "Helvetica-Bold"
FONT_I = "Helvetica-Oblique"


def gr(v):
    """Grigio da 0 (nero) a 1 (bianco)."""
    return Color(v, v, v)


GRIGIO_TERRENO = {"mare": 0.46, "foresta": 0.60, "montagna": 0.76, "colline": 0.80, "campi": 0.94}


# --------------------------------------------------------------------------- utilità
def _ombra(c, disegna, dx=2.2, dy=-2.8, alpha=0.28):
    """Disegna una sagoma nera semitrasparente spostata (ombra proiettata). `disegna()` riempie la sagoma."""
    c.saveState()
    c.translate(dx, dy)
    c.setFillColor(black)
    c.setStrokeColor(black)
    c.setFillAlpha(alpha)
    c.setStrokeAlpha(0)
    disegna()
    c.restoreState()


def _poligono(c, punti, fill=True, stroke=True):
    c.drawPath(_percorso(c, punti), stroke=1 if stroke else 0, fill=1 if fill else 0)


def _stella_pts(cx, cy, r, interno=0.42):
    pts = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * interno
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts


# --------------------------------------------------------------------------- cornici e titoli
def _esagono_ornamento(c, cx, cy, r):
    c.setLineWidth(1.4)
    c.setStrokeColor(gr(0.08))
    c.setFillColor(white)
    _poligono(c, _punti_esagono(cx, cy, r))
    c.setFillColor(gr(0.2))
    _poligono(c, _punti_esagono(cx, cy, r * 0.5))


def cornice_pagina(c, W, H, m=15):
    """Bordo doppio con angoli a esagono e losanghe a metà dei lati."""
    c.setStrokeColor(gr(0.08))
    c.setFillColor(white)
    c.setLineWidth(3.2)
    c.roundRect(m, m, W - 2 * m, H - 2 * m, 12, stroke=1, fill=0)
    c.setLineWidth(0.9)
    c.roundRect(m + 6, m + 6, W - 2 * m - 12, H - 2 * m - 12, 8, stroke=1, fill=0)
    for x, y in ((m + 6, m + 6), (W - m - 6, m + 6), (m + 6, H - m - 6), (W - m - 6, H - m - 6)):
        _esagono_ornamento(c, x, y, 10)
    c.setFillColor(gr(0.15))
    for x, y in ((W / 2, m + 6), (W / 2, H - m - 6), (m + 6, H / 2), (W - m - 6, H / 2)):
        _poligono(c, [(x, y + 5), (x + 7, y), (x, y - 5), (x - 7, y)])


def striscione(c, cx, cy, w, h, testo, size=26):
    """Striscione con le code a coda di rondine; testo bianco in Times Bold."""
    x0, y0 = cx - w / 2, cy - h / 2
    c.setLineJoin(1)
    c.setLineWidth(1.2)
    c.setStrokeColor(gr(0.05))
    # code (dietro), un po' più in basso
    c.setFillColor(gr(0.38))
    for lato in (-1, 1):
        xe = cx + lato * (w / 2 + 34)
        xi = cx + lato * (w / 2 - 16)
        _poligono(c, [(xi, y0 - 9), (xe, y0 - 9), (xe - lato * 14, y0 + h / 2 - 9), (xe, y0 + h - 9), (xi, y0 + h - 9)])
    # pieghe
    c.setFillColor(gr(0.15))
    for lato in (-1, 1):
        xi = cx + lato * (w / 2 - 16)
        xb = cx + lato * (w / 2)
        _poligono(c, [(xi, y0 - 9), (xb, y0), (xi, y0)])
    # nastro principale con ombra
    _ombra(c, lambda: c.rect(x0, y0, w, h, stroke=0, fill=1), 0, -3, 0.25)
    c.setFillColor(gr(0.13))
    c.rect(x0, y0, w, h, stroke=1, fill=1)
    c.setStrokeColor(white)
    c.setStrokeAlpha(0.55)
    c.setLineWidth(0.8)
    c.rect(x0 + 3, y0 + 3, w - 6, h - 6, stroke=1, fill=0)
    c.setStrokeAlpha(1)
    # testo
    c.setFillColor(white)
    while c.stringWidth(testo, TITOLO_FONT, size) > w - 24 and size > 10:
        size -= 1
    c.setFont(TITOLO_FONT, size)
    c.drawCentredString(cx, cy - size * 0.33, testo)


def cartiglio(c, x, y, w, h, titolo=None, fill=0.97, ombra=True, raggio=9):
    """Riquadro tipo pergamena con doppio bordo. (x, y) = angolo in basso a sinistra."""
    if ombra:
        _ombra(c, lambda: c.roundRect(x, y, w, h, raggio, stroke=0, fill=1), 2.2, -2.6, 0.22)
    c.setFillColor(gr(fill))
    c.setStrokeColor(gr(0.08))
    c.setLineWidth(1.7)
    c.roundRect(x, y, w, h, raggio, stroke=1, fill=1)
    c.setLineWidth(0.6)
    c.setStrokeColor(gr(0.5))
    c.roundRect(x + 3.2, y + 3.2, w - 6.4, h - 6.4, raggio - 3, stroke=1, fill=0)
    if titolo:
        pillola(c, x + 12, y + h - 8, c.stringWidth(titolo, FONT_B, 8.5) + 20, 16, titolo, 8.5)


def pillola(c, x, y, w, h, testo, size=9, fill=0.08, colore_testo=white):
    c.setFillColor(gr(fill))
    c.setStrokeColor(gr(0.0))
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, h / 2, stroke=1, fill=1)
    c.setFillColor(colore_testo)
    c.setFont(FONT_B, size)
    c.drawCentredString(x + w / 2, y + h / 2 - size * 0.33, testo)


# --------------------------------------------------------------------------- terreni
def _pino(c, x, y, s):
    c.setLineJoin(1)
    c.setFillColor(gr(0.12))
    c.rect(x - s * 0.09, y - s * 1.05, s * 0.18, s * 0.45, stroke=0, fill=1)
    for k in range(3):
        base = y - s * 0.65 + k * s * 0.5
        mezza = s * (0.95 - 0.22 * k)
        apice = base + s * 0.95
        pts = [(x - mezza, base), (x + mezza, base), (x, apice)]
        c.setFillColor(gr(0.20))
        c.setStrokeColor(gr(0.04))
        c.setLineWidth(0.7)
        _poligono(c, pts)
        c.setFillColor(gr(0.42))
        c.setStrokeAlpha(0)
        _poligono(c, [(x - mezza, base), (x, base), (x, apice)], stroke=False)
        c.setStrokeAlpha(1)


def _arte_foresta(c, cx, cy, r, rng):
    pos = [(-0.46, 0.18), (0.44, 0.2), (0.0, 0.5), (-0.2, -0.22), (0.38, -0.3), (-0.56, -0.42), (0.02, -0.55)]
    for dx, dy in sorted(pos, key=lambda p: -p[1]):
        _pino(c, cx + dx * r, cy + dy * r, r * (0.27 + 0.03 * ((dx * 7) % 2)))


def _arte_campi(c, cx, cy, r, rng):
    c.saveState()
    c.translate(cx, cy)
    c.rotate(24)
    for i in range(-5, 6):
        y = i * r * 0.26
        c.setFillColor(gr(0.78 if i % 2 else 0.9))
        c.setStrokeAlpha(0)
        c.rect(-r * 1.2, y, r * 2.4, r * 0.13, stroke=0, fill=1)
        c.setStrokeAlpha(1)
        c.setStrokeColor(gr(0.25))
        c.setLineWidth(0.7)
        x = -r * 1.1
        while x < r * 1.1:  # spighe: tacche a V lungo il solco
            c.line(x, y + r * 0.065, x + r * 0.05, y + r * 0.15)
            c.line(x, y + r * 0.065, x - r * 0.05, y + r * 0.15)
            x += r * 0.17
    c.restoreState()


def _collina(c, x, y, rad, tono):
    p = c.beginPath()
    p.moveTo(x - rad, y)
    p.arcTo(x - rad, y - rad, x + rad, y + rad, 180, -180)
    p.close()
    c.setFillColor(gr(tono))
    c.setStrokeColor(gr(0.12))
    c.setLineWidth(0.9)
    c.drawPath(p, stroke=1, fill=1)
    c.setStrokeColor(gr(0.15))
    c.setLineWidth(0.7)
    for dx in (-0.45, 0.0, 0.45):  # ciuffi d'erba
        tx, ty = x + dx * rad, y + rad * (0.62 if dx == 0 else 0.4)
        c.line(tx, ty, tx, ty + rad * 0.16)
        c.line(tx, ty, tx - rad * 0.1, ty + rad * 0.13)
        c.line(tx, ty, tx + rad * 0.1, ty + rad * 0.13)


def _arte_colline(c, cx, cy, r, rng):
    _collina(c, cx + 0.34 * r, cy - 0.08 * r, 0.58 * r, 0.70)
    _collina(c, cx - 0.30 * r, cy - 0.36 * r, 0.62 * r, 0.60)
    _collina(c, cx + 0.42 * r, cy - 0.58 * r, 0.46 * r, 0.52)


def _arte_mare(c, cx, cy, r, rng):
    c.setStrokeColor(white)
    c.setLineWidth(1.15)
    for riga in range(7):
        y = cy + (riga - 3) * r * 0.30
        off = (riga % 2) * r * 0.22
        c.setStrokeAlpha(0.95 if riga % 2 else 0.6)
        pts = [(cx - r * 1.1 + i * r * 0.11, y + r * 0.07 * math.sin((i * r * 0.11 + off) / (r * 0.16)))
               for i in range(24)]
        p = c.beginPath()
        p.moveTo(*pts[0])
        for q in pts[1:]:
            p.lineTo(*q)
        c.drawPath(p, stroke=1, fill=0)
    c.setStrokeAlpha(1)


def _vetta(c, x, y, alt, larg):
    pts = [(x - larg, y), (x + larg, y), (x, y + alt)]
    c.setLineJoin(1)
    c.setFillColor(gr(0.34))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(0.9)
    _poligono(c, pts)
    c.setFillColor(gr(0.14))  # versante in ombra
    c.setStrokeAlpha(0)
    _poligono(c, [(x, y), (x + larg, y), (x, y + alt)], stroke=False)
    c.setStrokeAlpha(1)
    # cima innevata
    h_n = alt * 0.38
    meta = larg * (h_n / alt)
    cima = [(x - meta, y + alt - h_n), (x - meta * 0.35, y + alt - h_n * 0.72), (x + meta * 0.1, y + alt - h_n),
            (x + meta * 0.5, y + alt - h_n * 0.72), (x + meta, y + alt - h_n), (x, y + alt)]
    c.setFillColor(white)
    c.setStrokeColor(gr(0.08))
    c.setLineWidth(0.7)
    _poligono(c, cima)


def _arte_montagna(c, cx, cy, r, rng):
    _vetta(c, cx - 0.42 * r, cy - 0.45 * r, 0.85 * r, 0.42 * r)
    _vetta(c, cx + 0.48 * r, cy - 0.5 * r, 0.7 * r, 0.38 * r)
    _vetta(c, cx + 0.02 * r, cy - 0.2 * r, 1.0 * r, 0.55 * r)


_ARTE = {"foresta": _arte_foresta, "campi": _arte_campi, "colline": _arte_colline, "mare": _arte_mare,
         "montagna": _arte_montagna}


def disegna_tessera(c, cx, cy, r, terreno, seme=0):
    """Tessera esagonale con ombra, spessore, illustrazione del terreno e bisello."""
    _ombra(c, lambda: _poligono(c, _punti_esagono(cx, cy - 2, r), stroke=False), 2.4, -3.0, 0.30)
    c.setLineJoin(1)
    c.setFillColor(gr(0.16))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.2)
    _poligono(c, _punti_esagono(cx, cy - 3.2, r))
    c.setFillColor(gr(GRIGIO_TERRENO[terreno]))
    c.setStrokeColor(gr(0.06))
    c.setLineWidth(1.5)
    _poligono(c, _punti_esagono(cx, cy, r))
    c.saveState()
    c.clipPath(_percorso(c, _punti_esagono(cx, cy, r * 0.9)), stroke=0, fill=0)
    _ARTE[terreno](c, cx, cy, r, random.Random(seme))
    c.restoreState()
    c.saveState()
    c.setStrokeColor(white)
    c.setStrokeAlpha(0.9)
    c.setLineWidth(1.0)
    c.drawPath(_percorso(c, _punti_esagono(cx, cy, r * 0.9)), stroke=1, fill=0)
    c.restoreState()


def medaglione_mare(c, cx, cy, R):
    """Mare intorno all'isola: medaglione rotondo con onde e doppio anello."""
    _ombra(c, lambda: c.circle(cx, cy, R, stroke=0, fill=1), 3, -4, 0.22)
    c.setFillColor(gr(0.55))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(2.4)
    c.circle(cx, cy, R, stroke=1, fill=1)
    c.saveState()
    p = c.beginPath()
    p.circle(cx, cy, R - 2)
    c.clipPath(p, stroke=0, fill=0)
    c.setStrokeColor(white)
    c.setLineWidth(1.0)
    for riga in range(-9, 10):
        y = cy + riga * 15
        c.setStrokeAlpha(0.8 if riga % 2 else 0.45)
        pts = [(cx - R + i * 8, y + 3 * math.sin((i * 8 + riga * 11) / 9)) for i in range(int(2 * R / 8) + 2)]
        q = c.beginPath()
        q.moveTo(*pts[0])
        for pt in pts[1:]:
            q.lineTo(*pt)
        c.drawPath(q, stroke=1, fill=0)
    c.restoreState()
    c.setStrokeColor(white)
    c.setLineWidth(1.0)
    c.circle(cx, cy, R - 5, stroke=1, fill=0)
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(0.8)
    c.circle(cx, cy, R - 8.5, stroke=1, fill=0)


# --------------------------------------------------------------------------- meeple
def _corpo_meeple(cx, base, h):
    return [(cx + x * h, base + y * h) for x, y in _MEEPLE_CORPO], (cx, base + 0.88 * h, 0.15 * h)


def disegna_meeple_bello(c, cx, base, h, stile, ombra=True):
    corpo, testa = _corpo_meeple(cx, base, h)

    def sagoma():
        c.drawPath(_percorso(c, corpo), stroke=0, fill=1)
        c.circle(testa[0], testa[1], testa[2], stroke=0, fill=1)

    if ombra:
        _ombra(c, sagoma, h * 0.07, -h * 0.07, 0.38)
    c.setLineJoin(1)
    # alone bianco: il meeple nero resta leggibile anche sui terreni scuri
    c.saveState()
    c.setStrokeColor(white)
    c.setStrokeAlpha(0.9)
    c.setLineWidth(max(1.6, h * 0.1))
    c.drawPath(_percorso(c, corpo), stroke=1, fill=0)
    c.circle(testa[0], testa[1], testa[2], stroke=1, fill=0)
    c.restoreState()
    for parte in ("corpo", "testa"):
        c.saveState()
        if parte == "corpo":
            path = _percorso(c, corpo)
        else:
            path = c.beginPath()
            path.circle(testa[0], testa[1], testa[2])
        c.setFillColor(gr(0.07) if stile == "nero" else white)
        c.drawPath(path, stroke=0, fill=1)
        if stile in ("rigato", "puntinato"):
            c.clipPath(path, stroke=0, fill=0)
            c.setFillColor(gr(0.08))
            c.setStrokeColor(gr(0.08))
            if stile == "rigato":
                c.setLineWidth(max(1.0, h * 0.055))
                k = -1.0
                while k < 1.2:
                    c.line(cx - h * 0.5, base + k * h * 0.3, cx + h * 0.5, base + (k + 1.2) * h * 0.3)
                    k += 0.42
            else:
                y = base + 0.05 * h
                while y < base + 1.05 * h:
                    x = cx - 0.5 * h
                    while x < cx + 0.55 * h:
                        c.circle(x, y, 0.05 * h, stroke=0, fill=1)
                        x += 0.19 * h
                    y += 0.19 * h
        c.restoreState()
        c.setStrokeColor(gr(0.04))
        c.setLineWidth(1.05)
        c.drawPath(path, stroke=1, fill=0)
    if stile == "nero":  # riflesso
        c.setStrokeColor(white)
        c.setStrokeAlpha(0.55)
        c.setLineWidth(0.9)
        c.arc(testa[0] - testa[2] * 0.6, testa[1] - testa[2] * 0.6, testa[0] + testa[2] * 0.6, testa[1] + testa[2] * 0.6, 100, 70)
        c.setStrokeAlpha(1)


# --------------------------------------------------------------------------- dadi, monete, carte
_PIP = {1: [(0, 0)], 2: [(-1, 1), (1, -1)], 3: [(-1, 1), (0, 0), (1, -1)], 4: [(-1, 1), (1, 1), (-1, -1), (1, -1)],
        5: [(-1, 1), (1, 1), (0, 0), (-1, -1), (1, -1)], 6: [(-1, 1), (1, 1), (-1, 0), (1, 0), (-1, -1), (1, -1)]}


def disegna_dado_bello(c, cx, cy, lato, valore, angolo=0):
    c.saveState()
    c.translate(cx, cy)
    c.rotate(angolo)
    h = lato / 2
    rr = lato * 0.2
    _ombra(c, lambda: c.roundRect(-h, -h, lato, lato, rr, stroke=0, fill=1), lato * 0.09, -lato * 0.11, 0.32)
    c.setFillColor(gr(0.80))  # spessore
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.3)
    c.roundRect(-h, -h - lato * 0.06, lato, lato, rr, stroke=1, fill=1)
    c.setFillColor(white)
    c.roundRect(-h, -h, lato, lato, rr, stroke=1, fill=1)
    c.setStrokeColor(gr(0.78))
    c.setLineWidth(0.8)
    c.roundRect(-h + 2.2, -h + 2.2, lato - 4.4, lato - 4.4, rr * 0.7, stroke=1, fill=0)
    g = lato * 0.26
    for px, py in _PIP[valore]:
        c.setFillColor(gr(0.05))
        c.circle(px * g, py * g, lato * 0.085, stroke=0, fill=1)
        c.setFillColor(white)
        c.circle(px * g - lato * 0.025, py * g + lato * 0.025, lato * 0.022, stroke=0, fill=1)
    c.restoreState()


def disegna_moneta_bella(c, cx, cy, r):
    _ombra(c, lambda: c.circle(cx, cy, r, stroke=0, fill=1), r * 0.22, -r * 0.28, 0.34)
    c.setFillColor(gr(0.62))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.2)
    c.circle(cx, cy - r * 0.12, r, stroke=1, fill=1)  # spessore
    c.setFillColor(gr(0.90))
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setStrokeColor(gr(0.35))
    c.setLineWidth(0.7)
    for k in range(28):  # bordo zigrinato
        a = 2 * math.pi * k / 28
        c.line(cx + r * 0.84 * math.cos(a), cy + r * 0.84 * math.sin(a), cx + r * 0.97 * math.cos(a), cy + r * 0.97 * math.sin(a))
    c.setStrokeColor(gr(0.3))
    c.setLineWidth(0.8)
    c.circle(cx, cy, r * 0.72, stroke=1, fill=0)
    # stella in rilievo
    c.setFillColor(white)
    c.setStrokeAlpha(0)
    _poligono(c, _stella_pts(cx - r * 0.07, cy + r * 0.07, r * 0.5), stroke=False)
    c.setFillColor(gr(0.42))
    _poligono(c, _stella_pts(cx, cy, r * 0.5), stroke=False)
    c.setStrokeAlpha(1)


def _simbolo_carta(c, simbolo, x, y, r):
    c.setFillColor(gr(0.06))
    c.setStrokeColor(gr(0.06))
    c.setLineWidth(max(0.8, r * 0.16))
    c.setLineJoin(1)
    if simbolo == "stella":
        c.setLineWidth(0.5)
        _poligono(c, _stella_pts(x, y, r * 1.3))
    elif simbolo == "cerchio":
        c.circle(x, y, r * 0.95, stroke=1, fill=0)
    elif simbolo == "quadrato":
        c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, stroke=1, fill=0)
    else:
        _poligono(c, [(x, y + r * 1.05), (x - r * 1.0, y - r * 0.75), (x + r * 1.0, y - r * 0.75)], fill=False)


def disegna_carta_bella(c, cx, cy, w, h, angolo, simbolo):
    c.saveState()
    c.translate(cx, cy)
    c.rotate(angolo)
    _ombra(c, lambda: c.roundRect(-w / 2, -h / 2, w, h, 3.5, stroke=0, fill=1), 1.8, -2.2, 0.32)
    c.setFillColor(white)
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.2)
    c.roundRect(-w / 2, -h / 2, w, h, 3.5, stroke=1, fill=1)
    c.setStrokeColor(gr(0.6))
    c.setLineWidth(0.5)
    c.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 2.5, stroke=1, fill=0)
    _simbolo_carta(c, simbolo, 0, 0, w * 0.26)
    # indici agli angoli
    for sx, sy, rot in ((-1, 1, 0), (1, -1, 180)):
        c.saveState()
        c.translate(sx * (w / 2 - 5.2), sy * (h / 2 - 5.8))
        c.rotate(rot)
        _simbolo_carta(c, simbolo, 0, 0, w * 0.1)
        c.restoreState()
    c.restoreState()


# --------------------------------------------------------------------------- rosone
def disegna_rosone_bello(c, cx, cy, u, maschere):
    """Vetrata a esagono: i triangoli restano tracciati in linea, senza riempimenti che confondano il conteggio."""
    R = u * 1.28
    pts = [(cx + R * math.cos(math.radians(60 * k)), cy + R * math.sin(math.radians(60 * k))) for k in range(6)]
    _ombra(c, lambda: _poligono(c, pts, stroke=False), 2.2, -2.8, 0.25)
    c.setLineJoin(1)
    c.setFillColor(gr(0.90))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.8)
    _poligono(c, pts)
    c.setFillColor(white)
    c.setLineWidth(0.8)
    pts2 = [(cx + R * 0.93 * math.cos(math.radians(60 * k)), cy + R * 0.93 * math.sin(math.radians(60 * k))) for k in range(6)]
    _poligono(c, pts2)
    # figura
    segs = segmenti_rosone(*maschere)

    def cart(p):
        return cx + (p[0] + p[1] / 2) * u * 0.92, cy + p[1] * math.sqrt(3) / 2 * u * 0.92

    c.setStrokeColor(gr(0.05))
    c.setLineCap(1)
    for k, (a, b) in enumerate(segs):
        c.setLineWidth(2.5 if k < 6 else 1.8)
        c.line(*cart(a), *cart(b))
    c.setLineCap(0)


# --------------------------------------------------------------------------- icone e gettoni
def gettone_esagonale(c, cx, cy, r, ombra=True):
    """Gettone da gioco esagonale (punta in alto) con bisello."""
    pts = [(cx + r * math.cos(math.radians(90 + 60 * k)), cy + r * math.sin(math.radians(90 + 60 * k))) for k in range(6)]
    if ombra:
        _ombra(c, lambda: _poligono(c, [(x, y - 1) for x, y in pts], stroke=False), 1.8, -2.4, 0.28)
    c.setLineJoin(1)
    c.setFillColor(gr(0.78))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.2)
    _poligono(c, [(x, y - 2.4) for x, y in pts])
    c.setFillColor(white)
    c.setLineWidth(1.5)
    _poligono(c, pts)
    c.setStrokeColor(gr(0.6))
    c.setLineWidth(0.6)
    _poligono(c, [(cx + (x - cx) * 0.88, cy + (y - cy) * 0.88) for x, y in pts], fill=False)


def icona_tipo(c, tipo, cx, cy, r, terreno="foresta", stile="nero"):
    """Icona dentro un cerchio: meeple, dado, moneta, carta, tessera (terreno), triangolo."""
    _ombra(c, lambda: c.circle(cx, cy, r, stroke=0, fill=1), 1.4, -1.8, 0.28)
    c.setFillColor(white)
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.5)
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setStrokeColor(gr(0.6))
    c.setLineWidth(0.5)
    c.circle(cx, cy, r - 2.2, stroke=1, fill=0)
    if tipo == "meeple":
        disegna_meeple_bello(c, cx, cy - r * 0.55, r * 1.1, stile, ombra=False)
    elif tipo == "dadi":
        disegna_dado_bello(c, cx, cy, r * 1.05, 5, 0)
    elif tipo == "monete":
        disegna_moneta_bella(c, cx, cy, r * 0.6)
    elif tipo == "carte":
        disegna_carta_bella(c, cx, cy, r * 0.95, r * 1.3, 0, "stella")
    elif tipo == "terreno":
        disegna_tessera(c, cx, cy + 1.2, r * 0.68, terreno)
    else:  # triangoli
        c.setStrokeColor(gr(0.05))
        c.setLineWidth(1.3)
        c.setLineJoin(1)
        pts = [(cx, cy + r * 0.62), (cx - r * 0.6, cy - r * 0.42), (cx + r * 0.6, cy - r * 0.42)]
        _poligono(c, pts, fill=False)
        c.line(cx, cy + r * 0.62, cx, cy - r * 0.42)
        c.line(cx - r * 0.3, cy + r * 0.1, cx + r * 0.3, cy + r * 0.1)


def panno(c, x, y, w, h, raggio=10):
    """Panno da tavolo (trama fine di righe incrociate) con cornice arrotondata e bordo interno."""
    _ombra(c, lambda: c.roundRect(x, y, w, h, raggio, stroke=0, fill=1), 2.4, -3.0, 0.22)
    c.setFillColor(gr(0.80))
    c.setStrokeColor(gr(0.05))
    c.setLineWidth(1.8)
    c.roundRect(x, y, w, h, raggio, stroke=1, fill=1)
    c.saveState()
    p = c.beginPath()
    p.roundRect(x + 2, y + 2, w - 4, h - 4, raggio - 2)
    c.clipPath(p, stroke=0, fill=0)
    c.setStrokeColor(gr(0.70))
    c.setLineWidth(0.45)
    k = -h
    while k < w:
        c.line(x + k, y, x + k + h, y + h)
        c.line(x + k, y + h, x + k + h, y)
        k += 6
    c.restoreState()
    c.setStrokeColor(white)
    c.setStrokeAlpha(0.8)
    c.setLineWidth(0.9)
    c.roundRect(x + 4, y + 4, w - 8, h - 8, raggio - 4, stroke=1, fill=0)
    c.setStrokeAlpha(1)


def badge_numero(c, x, y, numero, r=6.2):
    c.setFillColor(gr(0.0))
    c.setStrokeColor(white)
    c.setLineWidth(0.9)
    c.circle(x, y, r, stroke=1, fill=1)
    c.setFillColor(white)
    c.setFont(FONT_B, 7.2 if numero < 10 else 6.2)
    c.drawCentredString(x, y - 2.5, str(numero))


def anello_numerato(c, cx, cy, r, numero):
    """Cerchio di evidenziazione con un numero d'ordine (pagina delle soluzioni)."""
    c.setStrokeColor(gr(0.0))
    c.setLineWidth(2.0)
    c.setDash(4, 2.5)
    c.circle(cx, cy, r, stroke=1, fill=0)
    c.setDash()
    bx, by = cx + r * 0.72, cy + r * 0.72
    c.setFillColor(gr(0.0))
    c.circle(bx, by, 6.6, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont(FONT_B, 8)
    c.drawCentredString(bx, by - 2.8, str(numero))
