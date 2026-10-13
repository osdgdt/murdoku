"""Enigmi visivi: labirinto, unisci i puntini, trova le differenze, conta le forme."""
import math
import random
from collections import deque

from reportlab.lib.colors import black, white

from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I, stella

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


# --------------------------------------------------------------------------- unisci i puntini
# Casa con camino e porta, coordinate 0..100 (x destra, y alto). Un unico contorno chiuso.
CASA = [
    (15, 8), (15, 50), (5, 50), (28, 70), (50, 90),   # parete sinistra e tetto a sinistra
    (62, 79), (62, 95), (74, 95), (74, 69),           # camino
    (84, 60), (95, 50),                               # tetto a destra
    (85, 50), (85, 8),                                # parete destra
    (60, 8), (60, 34), (40, 34), (40, 8),             # porta
]


def disegna_puntini(c, box, punti, soluzione):
    x0, y0, w, h = box
    lato = min(w - 40, h - 20)
    s = lato / 100
    ox = x0 + (w - lato) / 2
    oy = y0 + (h - lato) / 2
    P = [(ox + x * s, oy + y * s) for x, y in punti]
    if soluzione:
        c.setStrokeColor(black)
        c.setLineWidth(2.4)
        p = c.beginPath()
        p.moveTo(*P[0])
        for q in P[1:]:
            p.lineTo(*q)
        p.close()
        c.drawPath(p, stroke=1, fill=0)
    cx = sum(q[0] for q in P) / len(P)
    cy = sum(q[1] for q in P) / len(P)
    for i, (px, py) in enumerate(P):
        c.setFillColor(black)
        c.circle(px, py, 3.2, stroke=0, fill=1)
        # numero spostato rispetto al punto, dal lato del vicino meno ingombrato
        prec, succ = P[i - 1], P[(i + 1) % len(P)]
        vx = (px - prec[0]) / (math.dist(P[i], prec) or 1) - (succ[0] - px) / (math.dist(P[i], succ) or 1)
        vy = (py - prec[1]) / (math.dist(P[i], prec) or 1) - (succ[1] - py) / (math.dist(P[i], succ) or 1)
        # direzione verso l'esterno della figura (bisettrice esterna)
        lung = math.hypot(vx, vy)
        if lung < 1e-6:
            vx, vy = px - cx, py - cy
            lung = math.hypot(vx, vy) or 1
        vx, vy = vx / lung, vy / lung
        # se punta verso l'interno, inverti
        if (px - cx) * vx + (py - cy) * vy < 0:
            vx, vy = -vx, -vy
        tx, ty = px + vx * 12, py + vy * 12
        c.setFont(FONT_B, 11)
        c.drawCentredString(tx, ty - 4, str(i + 1))


def puntini_facile(figura):
    return Enigma(
        titolo="Unisci i puntini",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "Con la matita unisci i puntini seguendo l'ordine dei numeri, dall'1 fino all'ultimo, e poi "
            "ritorna all'1 per chiudere la figura. Cosa è comparso?"
        ),
        prompt_risposta="Scrivi cosa hai disegnato (una parola):",
        risposta=figura,
        spiegazione=f"Unendo i {len(CASA)} puntini in ordine e chiudendo la figura compare una casa con il camino e la porta.",
        disegna=lambda c, box, sol: disegna_puntini(c, box, CASA, sol),
    )


# --------------------------------------------------------------------------- trova le differenze
def _nuvola(c, x, y, s=1.0):
    c.setFillColor(white)
    for dx, dy, r in ((-14, 0, 9), (-4, 5, 11), (8, 4, 10), (18, -1, 8)):
        c.circle(x + dx * s, y + dy * s, r * s, stroke=1, fill=1)
    c.setLineWidth(0)
    c.rect(x - 22 * s, y - 8 * s, 48 * s, 8 * s, stroke=0, fill=1)
    c.setLineWidth(1.3)
    c.line(x - 22 * s, y - 8 * s, x + 26 * s, y - 8 * s)


def _fiore(c, x, y, petali):
    c.setLineWidth(1.2)
    c.setStrokeColor(black)
    c.line(x, y, x, y + 16)
    c.setFillColor(white)
    for k in range(petali):
        a = 2 * math.pi * k / petali + math.pi / 2
        c.circle(x + 5 * math.cos(a), y + 21 + 5 * math.sin(a), 3.4, stroke=1, fill=1)
    c.setFillColor(black)
    c.circle(x, y + 21, 2.4, stroke=0, fill=1)


def disegna_scena(c, ox, oy, scala, b):
    """Scena 300x170. b=True: versione B con 7 differenze."""
    c.saveState()
    c.translate(ox, oy)
    c.scale(scala, scala)
    c.setStrokeColor(black)
    c.setLineWidth(1.3)
    c.setFillColor(white)
    c.rect(0, 0, 300, 170, stroke=1, fill=0)
    c.setLineWidth(1.6)
    c.line(0, 30, 300, 30)  # terreno

    # casa
    c.rect(100, 30, 90, 65, stroke=1, fill=0)
    p = c.beginPath()
    p.moveTo(92, 95)
    p.lineTo(145, 135)
    p.lineTo(198, 95)
    p.close()
    c.drawPath(p, stroke=1, fill=0)
    if not b:  # 1) camino
        c.rect(166, 110, 14, 26, stroke=1, fill=0)
    c.rect(135, 30, 20, 38, stroke=1, fill=0)  # porta
    c.circle(150 if not b else 140, 48, 2, stroke=1, fill=1)  # 2) maniglia
    for wx in (108, 162):  # finestre
        c.rect(wx, 60, 20, 20, stroke=1, fill=0)
        c.line(wx + 10, 60, wx + 10, 80)
        if not (b and wx == 108):  # 3) finestra senza traversa
            c.line(wx, 70, wx + 20, 70)

    # sole con raggi
    c.circle(265, 138, 12, stroke=1, fill=0)
    raggi = 8 if not b else 7  # 4) un raggio in meno
    for k in range(raggi):
        a = k * math.pi / 4
        c.line(265 + 17 * math.cos(a), 138 + 17 * math.sin(a), 265 + 26 * math.cos(a), 138 + 26 * math.sin(a))

    # albero con mele
    c.rect(35, 30, 9, 28, stroke=1, fill=0)
    c.circle(39, 76, 22, stroke=1, fill=0)
    mele = [(30, 80), (46, 84), (38, 68)] if not b else [(30, 80), (46, 84)]  # 5) una mela in meno
    for mx, my in mele:
        c.circle(mx, my, 3.4, stroke=1, fill=1)

    # nuvole
    _nuvola(c, 62, 145, 0.9)
    if not b:  # 6) seconda nuvola
        _nuvola(c, 203, 148, 0.75)

    # uccello (uguale in A e B)
    c.setLineWidth(1.5)
    c.arc(100, 150, 112, 160, 0, 180)
    c.arc(112, 150, 124, 160, 0, 180)

    # fiori
    for fx, pet in ((214, 5), (238, 5), (262, 5 if not b else 4)):  # 7) un petalo in meno
        _fiore(c, fx, 32, pet)
    c.restoreState()


DIFFERENZE = [  # (x, y, raggio) nella scena 300x170 (versione B) e descrizione
    ((173, 123, 15), "il camino sul tetto manca nella scena B"),
    ((140, 48, 11), "la maniglia della porta è a sinistra invece che a destra"),
    ((118, 70, 15), "la finestra di sinistra non ha la traversa orizzontale"),
    ((265, 138, 26), "il sole ha 7 raggi invece di 8"),
    ((39, 76, 24), "l'albero ha 2 mele invece di 3"),
    ((203, 148, 19), "la nuvola a destra manca nella scena B"),
    ((262, 53, 13), "un fiore ha 4 petali invece di 5"),
]


def disegna_differenze(c, box, soluzione):
    x0, y0, w, h = box
    scala = min((w - 10) / 300, (h - 50) / 2 / 170)
    lw, lh = 300 * scala, 170 * scala
    ox = x0 + (w - lw) / 2
    yA = y0 + h - 16 - lh
    yB = yA - 28 - lh
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(ox, yA + lh + 3, "DISEGNO A")
    c.drawString(ox, yB + lh + 3, "DISEGNO B  (cerca le differenze qui)")
    disegna_scena(c, ox, yA, scala, False)
    disegna_scena(c, ox, yB, scala, True)
    if soluzione:
        c.setStrokeColor(black)
        c.setLineWidth(2.2)
        for k, ((x, y, r), _) in enumerate(DIFFERENZE):
            c.circle(ox + x * scala, yB + y * scala, r * scala, stroke=1, fill=0)
            c.setFont(FONT_B, 13)
            c.setFillColor(black)
            lx = min(x + r * 0.75, 290)
            ly = max(y - r * 0.95 - 4, 34)
            c.drawString(ox + lx * scala, yB + ly * scala, str(k + 1))


def differenze_medio():
    spieg = "Le 7 differenze (nel disegno B): " + "; ".join(f"{k + 1}) {t}" for k, (_, t) in enumerate(DIFFERENZE)) + "."
    return Enigma(
        titolo="Trova le differenze",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "I due disegni sembrano uguali, ma nel disegno B ci sono 7 differenze rispetto al disegno A. "
            "Cerchiale tutte con la matita. Attenzione ai piccoli dettagli!"
        ),
        prompt_risposta="Quante differenze hai trovato? (Se le trovi tutte devono essere 7.)",
        risposta=str(len(DIFFERENZE)),
        spiegazione=spieg,
        disegna=disegna_differenze,
    )


# --------------------------------------------------------------------------- conta le forme
def quadrati_in_griglia(n):
    return sum(k * k for k in range(1, n + 1))


def triangoli_in_triangolo(n):
    """Triangoli (dritti e rovesciati) in un triangolo suddiviso in n righe con le parallele ai tre lati."""
    su = sum((n - k + 1) * (n - k + 2) // 2 for k in range(1, n + 1))
    giu = sum((n - 2 * k + 1) * (n - 2 * k + 2) // 2 for k in range(1, n // 2 + 1))
    return su + giu


N_QUADRATI, N_TRIANGOLI = 4, 3


def disegna_forme(c, box, soluzione):
    x0, y0, w, h = box
    c.setFillColor(black)
    c.setFont(FONT_B, 14)
    # A) griglia di quadrati
    lato = 200
    gx = x0 + (w / 2 - lato) / 2 + 6
    gy = y0 + h - 70
    c.drawCentredString(gx + lato / 2, gy + 24, "FIGURA A")
    c.setStrokeColor(black)
    c.setLineWidth(2.6)
    cella = lato / N_QUADRATI
    for i in range(N_QUADRATI + 1):
        c.line(gx, gy - i * cella, gx + lato, gy - i * cella)
        c.line(gx + i * cella, gy, gx + i * cella, gy - lato)
    c.setFont(FONT, 12)
    c.drawCentredString(gx + lato / 2, gy - lato - 20, "Quanti QUADRATI vedi?")
    c.setFont(FONT_I, 10.5)
    c.drawCentredString(gx + lato / 2, gy - lato - 34, "(contali tutti: piccoli, medi e grandi)")

    # B) triangolo suddiviso
    lt = 225
    tx = x0 + w / 2 + (w / 2 - lt) / 2 - 4
    ty = gy - lato + 8  # base
    A = (tx + lt / 2, ty + lt * math.sqrt(3) / 2 - 8)
    B = (tx, ty - 8)
    C = (tx + lt, ty - 8)
    # le coordinate baricentriche (i,j,k) con i+j+k=N
    n = N_TRIANGOLI

    def pt(i, j, k):
        return ((i * A[0] + j * B[0] + k * C[0]) / n, (i * A[1] + j * B[1] + k * C[1]) / n)

    c.setFont(FONT_B, 14)
    c.drawCentredString(tx + lt / 2, gy + 24, "FIGURA B")
    c.setLineWidth(2.6)
    p = c.beginPath()
    p.moveTo(*A)
    p.lineTo(*B)
    p.lineTo(*C)
    p.close()
    c.drawPath(p, stroke=1, fill=0)
    for t in range(1, n):
        c.line(*pt(t, n - t, 0), *pt(t, 0, n - t))
        c.line(*pt(n - t, t, 0), *pt(0, t, n - t))
        c.line(*pt(n - t, 0, t), *pt(0, n - t, t))
    c.setFont(FONT, 12)
    c.drawCentredString(tx + lt / 2, ty - 28, "Quanti TRIANGOLI vedi?")
    c.setFont(FONT_I, 10.5)
    c.drawCentredString(tx + lt / 2, ty - 42, "(anche quelli rovesciati!)")

    # riquadri per le risposte
    yb = ty - 120
    for cx, tot, nome in ((gx + lato / 2, quadrati_in_griglia(N_QUADRATI), "quadrati"),
                          (tx + lt / 2, triangoli_in_triangolo(N_TRIANGOLI), "triangoli")):
        c.setLineWidth(1.8)
        c.setFillColor(white)
        c.roundRect(cx - 55, yb - 24, 110, 40, 6, stroke=1, fill=0)
        c.setFillColor(black)
        if soluzione:
            c.setFont(FONT_B, 22)
            c.drawCentredString(cx, yb - 12, str(tot))
        c.setFont(FONT, 10)
        c.drawCentredString(cx, yb - 38, nome)

    c.setFont(FONT_B, 12)
    c.drawCentredString(x0 + w / 2, yb - 80, "Poi somma i due numeri: il totale è la risposta.")


def forme_medio():
    q, t = quadrati_in_griglia(N_QUADRATI), triangoli_in_triangolo(N_TRIANGOLI)
    spieg = (
        f"Quadrati nella griglia 4×4: 16 (1×1) + 9 (2×2) + 4 (3×3) + 1 (4×4) = {q}.\n"
        f"Triangoli nella figura B: {t} in totale "
        f"(10 con la punta in alto: 6 piccoli + 3 medi + 1 grande; 3 con la punta in basso).\n"
        f"Risposta: {q} + {t} = {q + t}."
    )
    return Enigma(
        titolo="Quante forme?",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "Nella figura A conta tutti i quadrati nascosti nella griglia: non solo quelli piccoli, anche "
            "quelli formati da più caselle. Nella figura B conta tutti i triangoli, anche quelli grandi o "
            "capovolti. Poi somma i due risultati."
        ),
        prompt_risposta="Scrivi la somma di quadrati e triangoli:",
        risposta=str(q + t),
        spiegazione=spieg,
        disegna=disegna_forme,
    )


def crea(seed, parola_labirinto, figura_puntini):
    r = lambda k: random.Random(seed * 100 + k)
    e5, d5 = labirinto_facile(r(5), parola_labirinto)
    e6 = puntini_facile(figura_puntini)
    e7 = differenze_medio()
    e8 = forme_medio()
    return [e5, e6, e7, e8], {"labirinto": d5}
