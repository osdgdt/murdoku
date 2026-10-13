"""Cifrari: messaggio a simboli (facile), cifrario di Cesare (facile), Pigpen (medio)."""
import math

from reportlab.lib.colors import black, white

from .alfabeto import ALFABETO, N, sposta, valida_parola
from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I, stella

CATEGORIA = "Cifrari e codici"


def _caselle_vuote(c, x, y, n, lato, gap=6):
    for k in range(n):
        c.setLineWidth(1.4)
        c.setStrokeColor(black)
        c.setFillColor(white)
        c.rect(x + k * (lato + gap), y, lato, lato, stroke=1, fill=0)


# --------------------------------------------------------------------------- 1) messaggio a simboli
FORME = ["cerchio", "quadrato", "triangolo", "rombo", "pentagono", "stella", "croce"]
VARIANTI = ["vuoto", "pieno", "punto"]


def _poligono(c, punti, pieno):
    p = c.beginPath()
    p.moveTo(*punti[0])
    for q in punti[1:]:
        p.lineTo(*q)
    p.close()
    c.drawPath(p, stroke=1, fill=1 if pieno else 0)


def disegna_simbolo(c, forma, variante, cx, cy, r):
    pieno = variante == "pieno"
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(1.8)
    if forma == "cerchio":
        c.circle(cx, cy, r, stroke=1, fill=1 if pieno else 0)
    elif forma == "quadrato":
        c.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, stroke=1, fill=1 if pieno else 0)
    elif forma == "triangolo":
        _poligono(c, [(cx, cy + r * 1.05), (cx - r * 1.05, cy - r * 0.8), (cx + r * 1.05, cy - r * 0.8)], pieno)
    elif forma == "rombo":
        _poligono(c, [(cx, cy + r * 1.15), (cx + r * 0.85, cy), (cx, cy - r * 1.15), (cx - r * 0.85, cy)], pieno)
    elif forma == "pentagono":
        _poligono(c, [(cx + r * math.cos(math.pi / 2 + k * 2 * math.pi / 5),
                       cy + r * math.sin(math.pi / 2 + k * 2 * math.pi / 5)) for k in range(5)], pieno)
    elif forma == "stella":
        stella(c, cx, cy, r * 1.2, pieno=pieno, spessore=1.8)
    else:  # croce
        a, b = r * 0.35, r * 1.0
        _poligono(c, [(cx - a, cy + b), (cx + a, cy + b), (cx + a, cy + a), (cx + b, cy + a), (cx + b, cy - a),
                      (cx + a, cy - a), (cx + a, cy - b), (cx - a, cy - b), (cx - a, cy - a), (cx - b, cy - a),
                      (cx - b, cy + a), (cx - a, cy + a)], pieno)
    if variante == "punto":
        c.setFillColor(black)
        c.circle(cx, cy, max(1.8, r * 0.17), stroke=0, fill=1)


def assegna_simboli(rng):
    coppie = [(f, v) for v in VARIANTI for f in FORME]  # 21 simboli distinti
    rng.shuffle(coppie)
    return {lettera: coppie[i] for i, lettera in enumerate(ALFABETO)}


def disegna_simboli(c, box, d, soluzione):
    x0, y0, w, h = box
    mappa = d["mappa"]
    # tabella 7 colonne x 3 righe, ordinata per simbolo (non per lettera)
    inv = {v: k for k, v in mappa.items()}
    cw, ch = 66, 60
    gx = x0 + (w - cw * 7) / 2
    gy = y0 + h - 14
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, gy, "TABELLA DEI SIMBOLI")
    gy -= 12
    for i, var in enumerate(VARIANTI):
        for j, forma in enumerate(FORME):
            x = gx + j * cw
            y = gy - (i + 1) * ch
            c.setStrokeColor(black)
            c.setLineWidth(1)
            c.setFillColor(white)
            c.rect(x, y, cw, ch, stroke=1, fill=0)
            disegna_simbolo(c, forma, var, x + cw / 2, y + ch - 20, 12)
            c.setFillColor(black)
            c.setFont(FONT_B, 17)
            c.drawCentredString(x + cw / 2, y + 7, inv[(forma, var)])
    # messaggio
    msg = d["messaggio"]
    lato = 50
    gap = 10
    tot = len(msg) * lato + (len(msg) - 1) * gap
    mx = x0 + (w - tot) / 2
    my = gy - 3 * ch - 112
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, my + lato + 24, "IL MESSAGGIO SEGRETO")
    for k, (forma, var) in enumerate(msg):
        x = mx + k * (lato + gap)
        c.setStrokeColor(black)
        c.setLineWidth(1.8)
        c.setFillColor(white)
        c.roundRect(x, my, lato, lato, 6, stroke=1, fill=0)
        disegna_simbolo(c, forma, var, x + lato / 2, my + lato / 2, 15)
        # casellina dove scrivere la lettera
        c.setLineWidth(1.4)
        c.setFillColor(white)
        c.rect(x + lato / 2 - 14, my - 34, 28, 28, stroke=1, fill=0)
        if soluzione:
            c.setFillColor(black)
            c.setFont(FONT_B, 19)
            c.drawCentredString(x + lato / 2, my - 27 + 4, d["parola"][k])


def simboli_facile(parola, rng):
    valida_parola(parola)
    mappa = assegna_simboli(rng)
    messaggio = [mappa[ch] for ch in parola]
    d = {"mappa": mappa, "messaggio": messaggio, "parola": parola}
    return Enigma(
        titolo="Messaggio a simboli",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "Un messaggio segreto è scritto con dei simboli al posto delle lettere. Sotto ogni simbolo "
            "della tabella c'è la lettera che rappresenta. Cerca ogni simbolo del messaggio nella tabella, "
            "scrivi la lettera nella casellina sotto e leggi la parola."
        ),
        prompt_risposta="Scrivi la parola nascosta nel messaggio:",
        risposta=parola,
        spiegazione="Ogni simbolo del messaggio si traduce con la lettera indicata nella tabella; la parola è " + parola + ".",
        disegna=lambda c, box, sol: disegna_simboli(c, box, d, sol),
    ), d


def decodifica_simboli(d):
    inv = {v: k for k, v in d["mappa"].items()}
    return "".join(inv[s] for s in d["messaggio"])


# --------------------------------------------------------------------------- 9) cifrario di Cesare
def disegna_cesare(c, box, d, soluzione):
    x0, y0, w, h = box
    cella = (w - 70) / N
    gx = x0 + 70
    y = y0 + h - 40
    shift = d["shift"]
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, y + 22, "LA CHIAVE")
    for riga, (nome, fn) in enumerate((("Lettera\ncifrata", lambda i: ALFABETO[i]),
                                       ("Lettera\nvera", lambda i: ALFABETO[(i - shift) % N]))):
        yy = y - riga * (cella + 8) - cella
        c.setFont(FONT_B, 8.5)
        for k, parte in enumerate(nome.split("\n")):
            c.drawString(x0, yy + cella - 10 - k * 9, parte)
        for i in range(N):
            c.setStrokeColor(black)
            c.setLineWidth(1.2)
            c.setFillColor(GRIGIO if riga == 1 else white)
            c.rect(gx + i * cella, yy, cella, cella, stroke=1, fill=1)
            c.setFillColor(black)
            c.setFont(FONT_B, cella * 0.55)
            c.drawCentredString(gx + (i + 0.5) * cella, yy + cella * 0.25, fn(i))
    ym = y - 2 * (cella + 8) - 30
    c.setFont(FONT_I, 11)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, ym, d["esempio"])
    # messaggio cifrato
    msg = d["cifrato"]
    lato = 46
    gap = 10
    tot = len(msg) * lato + (len(msg) - 1) * gap
    mx = x0 + (w - tot) / 2
    my = ym - 86
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, my + lato + 22, "IL MESSAGGIO CIFRATO")
    for k, ch in enumerate(msg):
        x = mx + k * (lato + gap)
        c.setLineWidth(1.8)
        c.setStrokeColor(black)
        c.setFillColor(white)
        c.roundRect(x, my, lato, lato, 6, stroke=1, fill=0)
        c.setFillColor(black)
        c.setFont(FONT_B, 28)
        c.drawCentredString(x + lato / 2, my + 13, ch)
        c.setLineWidth(1.4)
        c.rect(x + lato / 2 - 13, my - 32, 26, 26, stroke=1, fill=0)
        if soluzione:
            c.setFont(FONT_B, 19)
            c.drawCentredString(x + lato / 2, my - 25 + 4, d["parola"][k])


def cesare_facile(parola, shift=3):
    valida_parola(parola)
    cifrato = sposta(parola, shift)
    es_chiaro = "CASA"
    es_cifrato = sposta(es_chiaro, shift)
    d = {
        "shift": shift,
        "parola": parola,
        "cifrato": cifrato,
        "esempio": f"Esempio: con questa chiave la parola {es_cifrato} diventa {es_chiaro}.",
    }
    return Enigma(
        titolo="Il cifrario di Cesare",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            f"Giulio Cesare scriveva i messaggi segreti spostando ogni lettera di {shift} posti avanti "
            "nell'alfabeto. Qui sotto la chiave ti dice, sotto ogni lettera cifrata, qual è la lettera vera. "
            "Traduci il messaggio lettera per lettera e scopri la parola."
        ),
        prompt_risposta="Scrivi la parola nascosta nel messaggio:",
        risposta=parola,
        spiegazione=f"Ogni lettera del messaggio {cifrato} va spostata di {shift} posti indietro: si ottiene {parola}.",
        disegna=lambda c, box, sol: disegna_cesare(c, box, d, sol),
    ), d


def decodifica_cesare(d):
    return sposta(d["cifrato"], -d["shift"])


# --------------------------------------------------------------------------- 4) Pigpen
def _specifiche_pigpen():
    """21 lettere dell'alfabeto -> simbolo. Due griglie # (senza e con puntino) e una X (3 spicchi)."""
    spec = {}
    for i, lettera in enumerate(ALFABETO):
        if i < 9:
            spec[lettera] = ("griglia", i // 3, i % 3, False)
        elif i < 18:
            spec[lettera] = ("griglia", (i - 9) // 3, (i - 9) % 3, True)
        else:
            spec[lettera] = ("x", ("su", "sinistra", "destra")[i - 18], False)
    return spec


def _simbolo_pigpen(c, spec, cx, cy, lato):
    h = lato / 2
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(2.4)
    c.setLineCap(1)
    if spec[0] == "griglia":
        _, r, col, dot = spec
        if r > 0:
            c.line(cx - h, cy + h, cx + h, cy + h)
        if r < 2:
            c.line(cx - h, cy - h, cx + h, cy - h)
        if col > 0:
            c.line(cx - h, cy - h, cx - h, cy + h)
        if col < 2:
            c.line(cx + h, cy - h, cx + h, cy + h)
        if dot:
            c.circle(cx, cy, lato * 0.07, stroke=0, fill=1)
    else:
        _, lato_x, _ = spec
        p = c.beginPath()
        if lato_x == "su":
            p.moveTo(cx - h, cy + h); p.lineTo(cx, cy); p.lineTo(cx + h, cy + h)
        elif lato_x == "sinistra":
            p.moveTo(cx - h, cy + h); p.lineTo(cx, cy); p.lineTo(cx - h, cy - h)
        elif lato_x == "destra":
            p.moveTo(cx + h, cy + h); p.lineTo(cx, cy); p.lineTo(cx + h, cy - h)
        else:
            p.moveTo(cx - h, cy - h); p.lineTo(cx, cy); p.lineTo(cx + h, cy - h)
        c.setLineJoin(1)
        c.drawPath(p, stroke=1, fill=0)
    c.setLineCap(0)


def _chiave_griglia(c, x, y, lato, dot, lettere):
    s = lato / 3
    c.setStrokeColor(black)
    c.setLineWidth(2.2)
    for k in (1, 2):
        c.line(x + k * s, y, x + k * s, y + lato)
        c.line(x, y + k * s, x + lato, y + k * s)
    for i, lettera in enumerate(lettere):
        r, col = i // 3, i % 3
        cx = x + (col + 0.5) * s
        cy = y + lato - (r + 0.5) * s
        c.setFillColor(black)
        c.setFont(FONT_B, 14)
        if dot:
            c.circle(cx, cy + s * 0.2, 2.6, stroke=0, fill=1)
            c.drawCentredString(cx, cy - s * 0.3, lettera)
        else:
            c.drawCentredString(cx, cy - 5, lettera)


def _chiave_x(c, x, y, lato, lettere):
    c.setStrokeColor(black)
    c.setLineWidth(2.2)
    c.line(x, y, x + lato, y + lato)
    c.line(x, y + lato, x + lato, y)
    pos = {"su": (0.5, 0.80), "sinistra": (0.18, 0.5), "destra": (0.82, 0.5), "giu": (0.5, 0.17)}
    c.setFillColor(black)
    c.setFont(FONT_B, 14)
    for nome, lettera in lettere.items():
        px, py = pos[nome]
        c.drawCentredString(x + px * lato, y + py * lato - 5, lettera)


def disegna_pigpen(c, box, d, soluzione):
    x0, y0, w, h = box
    spec = d["spec"]
    lato = 104
    gap = (w - 4 * lato) / 3
    y = y0 + h - 40 - lato
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, y + lato + 16, "LA CHIAVE")
    _chiave_griglia(c, x0, y, lato, False, ALFABETO[:9])
    _chiave_griglia(c, x0 + (lato + gap), y, lato, True, ALFABETO[9:18])
    _chiave_x(c, x0 + 2 * (lato + gap), y, lato, {"su": ALFABETO[18], "sinistra": ALFABETO[19], "destra": ALFABETO[20]})
    c.setFont(FONT_I, 10.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0 + 3 * (lato + gap) - 4, y + lato - 12, "Il simbolo di ogni")
    c.drawString(x0 + 3 * (lato + gap) - 4, y + lato - 25, "lettera è formato dalle")
    c.drawString(x0 + 3 * (lato + gap) - 4, y + lato - 38, "linee che la circondano")
    c.drawString(x0 + 3 * (lato + gap) - 4, y + lato - 51, "(e dal puntino, se c'è).")
    # esempio
    ey = y - 52
    c.setFillColor(black)
    c.setFont(FONT_B, 11)
    c.drawString(x0, ey + 6, "Esempio:")
    for k, ch in enumerate(d["esempio"]):
        _simbolo_pigpen(c, spec[ch], x0 + 90 + k * 46, ey + 12, 26)
    c.setFont(FONT_B, 13)
    c.drawString(x0 + 90 + len(d["esempio"]) * 46 + 4, ey + 8, "=  " + d["esempio"])
    # messaggio
    msg = d["parola"]
    lato_s = 52
    gap_s = 12
    tot = len(msg) * lato_s + (len(msg) - 1) * gap_s
    mx = x0 + (w - tot) / 2
    my = ey - 114
    c.setFont(FONT_B, 12)
    c.drawString(x0, my + lato_s + 26, "IL MESSAGGIO CIFRATO")
    for k, ch in enumerate(msg):
        x = mx + k * (lato_s + gap_s)
        c.setLineWidth(1.4)
        c.setStrokeColor(GRIGIO_SCURO)
        c.setFillColor(white)
        c.roundRect(x - 4, my - 4, lato_s + 8, lato_s + 8, 5, stroke=1, fill=0)
        _simbolo_pigpen(c, spec[ch], x + lato_s / 2, my + lato_s / 2, lato_s * 0.55)
        c.setStrokeColor(black)
        c.setLineWidth(1.4)
        c.rect(x + lato_s / 2 - 14, my - 42, 28, 28, stroke=1, fill=0)
        if soluzione:
            c.setFillColor(black)
            c.setFont(FONT_B, 19)
            c.drawCentredString(x + lato_s / 2, my - 35 + 4, ch)


def pigpen_medio(parola, esempio="CASA"):
    valida_parola(parola)
    spec = _specifiche_pigpen()
    d = {"spec": spec, "parola": parola, "esempio": esempio}
    return Enigma(
        titolo="Il cifrario Pigpen",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "I pirati e i massoni usavano questo cifrario: ogni lettera è sostituita dalle linee del "
            "'recinto' in cui si trova nella chiave. Confronta ogni simbolo del messaggio con la chiave "
            "(attenzione ai puntini!), scrivi la lettera nella casellina e leggi la parola."
        ),
        prompt_risposta="Scrivi la parola nascosta nel messaggio:",
        risposta=parola,
        spiegazione="Ogni simbolo corrisponde alla lettera della chiave con le stesse linee (e lo stesso puntino).",
        disegna=lambda c, box, sol: disegna_pigpen(c, box, d, sol),
    ), d


def decodifica_pigpen(d, simboli_messaggio):
    inv = {v: k for k, v in d["spec"].items()}
    return "".join(inv[s] for s in simboli_messaggio)
