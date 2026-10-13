"""Enigmi visivi: il labirinto con le lettere sul percorso."""
import random
from collections import deque

from reportlab.lib.colors import black, white

from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO_SCURO, FONT_B

CATEGORIA = "Enigmi visivi"


# --------------------------------------------------------------------------- labirinto
def genera_labirinto(w, h, rng):
    """Labirinto perfetto (un solo percorso fra due celle) con DFS. Celle (x, y), y dall'alto."""
    aperti = {(x, y): set() for x in range(w) for y in range(h)}
    visitate = {(0, 0)}
    pila = [(0, 0)]
    while pila:
        x, y = pila[-1]
        vicini = [
            (x + dx, y + dy)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if 0 <= x + dx < w and 0 <= y + dy < h and (x + dx, y + dy) not in visitate
        ]
        if vicini:
            n = rng.choice(vicini)
            aperti[(x, y)].add(n)
            aperti[n].add((x, y))
            visitate.add(n)
            pila.append(n)
        else:
            pila.pop()
    return aperti


def percorso_labirinto(aperti, inizio, fine):
    prec = {inizio: None}
    coda = deque([inizio])
    while coda:
        cur = coda.popleft()
        if cur == fine:
            break
        for nb in aperti[cur]:
            if nb not in prec:
                prec[nb] = cur
                coda.append(nb)
    p, cur = [], fine
    while cur is not None:
        p.append(cur)
        cur = prec[cur]
    return p[::-1]


def crea_labirinto(w, h, parola, n_esche, rng):
    aperti = genera_labirinto(w, h, rng)
    inizio, fine = (0, 0), (w - 1, h - 1)
    percorso = percorso_labirinto(aperti, inizio, fine)
    k = len(parola)
    # lettere distribuite lungo il percorso (escluse partenza e arrivo)
    interni = len(percorso) - 2
    indici = [1 + round((i + 0.5) * interni / k - 0.5) for i in range(k)]
    lettere = {percorso[i]: parola[j] for j, i in enumerate(indici)}
    fuori = [cella for cella in aperti if cella not in percorso]
    rng.shuffle(fuori)
    alfabeto = "ABCDEFGHILMNOPRSTUVZ"
    for cella in fuori[:n_esche]:
        lettere[cella] = rng.choice(alfabeto)
    return {"w": w, "h": h, "aperti": aperti, "percorso": percorso, "lettere": lettere, "parola": parola}


def lettere_sul_percorso(d):
    return "".join(d["lettere"][cella] for cella in d["percorso"] if cella in d["lettere"])


def disegna_labirinto(c, box, d, soluzione):
    x0, y0, w, h = box
    nx, ny = d["w"], d["h"]
    cella = min((w - 10) / nx, (h - 70) / ny)
    gx = x0 + (w - cella * nx) / 2
    gy = y0 + h - 34  # alto del labirinto

    def centro(cx, cy):
        return gx + (cx + 0.5) * cella, gy - (cy + 0.5) * cella

    # percorso giusto (soluzione)
    if soluzione:
        c.setStrokeColor(GRIGIO_SCURO)
        c.setLineWidth(cella * 0.28)
        c.setLineCap(1)
        c.setLineJoin(1)
        p = c.beginPath()
        px, py = centro(*d["percorso"][0])
        p.moveTo(px, py + cella / 2)
        p.lineTo(px, py)
        for cell in d["percorso"][1:]:
            p.lineTo(*centro(*cell))
        ex, ey = centro(*d["percorso"][-1])
        p.lineTo(ex, ey - cella / 2)
        c.drawPath(p, stroke=1, fill=0)
        c.setLineCap(0)

    c.setStrokeColor(black)
    c.setLineWidth(3)
    c.setLineCap(2)
    aperti = d["aperti"]
    # bordi esterni con le aperture di entrata (alto sx) e uscita (basso dx)
    c.line(gx + cella, gy, gx + nx * cella, gy)
    c.line(gx, gy - ny * cella, gx + (nx - 1) * cella, gy - ny * cella)
    c.line(gx, gy, gx, gy - ny * cella)
    c.line(gx + nx * cella, gy, gx + nx * cella, gy - ny * cella)
    c.setLineWidth(2.4)
    for yy in range(ny):
        for xx in range(nx):
            if xx < nx - 1 and (xx + 1, yy) not in aperti[(xx, yy)]:
                c.line(gx + (xx + 1) * cella, gy - yy * cella, gx + (xx + 1) * cella, gy - (yy + 1) * cella)
            if yy < ny - 1 and (xx, yy + 1) not in aperti[(xx, yy)]:
                c.line(gx + xx * cella, gy - (yy + 1) * cella, gx + (xx + 1) * cella, gy - (yy + 1) * cella)
    c.setLineCap(0)

    # lettere
    for (xx, yy), lettera in d["lettere"].items():
        cx, cy = centro(xx, yy)
        c.setFillColor(white)
        c.setStrokeColor(black)
        c.setLineWidth(1.1)
        c.circle(cx, cy, cella * 0.31, stroke=1, fill=1)
        c.setFillColor(black)
        c.setFont(FONT_B, cella * 0.38)
        c.drawCentredString(cx, cy - cella * 0.13, lettera)

    # etichette entrata / uscita
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    ex, _ = centro(0, 0)
    c.drawCentredString(ex, gy + 18, "ENTRATA")
    _tri_giu(c, ex, gy + 5)
    ux, _ = centro(nx - 1, ny - 1)
    _tri_giu(c, ux, gy - ny * cella - 4)
    c.drawCentredString(ux, gy - ny * cella - 22, "USCITA")


def _tri_giu(c, x, y):
    c.setFillColor(black)
    p = c.beginPath()
    p.moveTo(x - 6, y + 8)
    p.lineTo(x + 6, y + 8)
    p.lineTo(x, y - 2)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def labirinto_facile(rng, parola):
    d = crea_labirinto(12, 12, parola, 16, rng)
    return Enigma(
        titolo="Il labirinto",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "Trova la strada dall'ENTRATA all'USCITA senza attraversare i muri. Lungo la strada giusta "
            f"passerai sopra {len(parola)} lettere: leggile nell'ordine in cui le incontri e formeranno "
            "una parola. Attenzione: ci sono anche lettere trappola nei vicoli ciechi!"
        ),
        prompt_risposta="Scrivi la parola formata dalle lettere lungo il percorso giusto:",
        risposta=parola,
        spiegazione="Il labirinto ha un solo percorso possibile (verificato dal programma). La strada è quella in grigio.",
        disegna=lambda c, box, sol: disegna_labirinto(c, box, d, sol),
    ), d


def crea(seed, parola_labirinto):
    """Restituisce l'enigma 5 (labirinto) e i dati grezzi per i test."""
    return labirinto_facile(random.Random(seed * 100 + 5), parola_labirinto)
