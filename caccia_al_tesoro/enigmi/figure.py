"""Enigmi con figure: serie di figure (facile) e ombre/specchi (medio).

In entrambi, ogni prova ha 4 opzioni con una lettera sotto: le lettere delle risposte giuste, in ordine,
formano la parola. Le lettere delle opzioni sbagliate sono esche.
"""
import math
import random

from reportlab.lib.colors import black, white

from .alfabeto import ALFABETO, valida_parola
from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I

CATEGORIA = "Enigmi visivi"


# --------------------------------------------------------------------------- disegno degli stati (serie)
# stato = (tipo, valore)
#   ("freccia", gradi)      freccia asimmetrica ruotata
#   ("punti", n)            n puntini
#   ("forma", nome)         cerchio / quadrato / triangolo
#   ("barre", n)            n barre verticali
#   ("angolo", k)           puntino nell'angolo k (0=alto sx, 1=alto dx, 2=basso dx, 3=basso sx)
def _freccia(c, cx, cy, r, gradi):
    c.saveState()
    c.translate(cx, cy)
    c.rotate(gradi)
    p = c.beginPath()
    # freccia a "L" asimmetrica che punta verso l'alto, con la coda a destra
    pts = [(0, r), (-r * 0.7, 0), (-r * 0.25, 0), (-r * 0.25, -r), (r * 0.7, -r), (r * 0.7, -r * 0.6),
           (r * 0.25, -r * 0.6), (r * 0.25, 0), (r * 0.7, 0)]
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.close()
    c.setLineWidth(1.8)
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


def disegna_stato(c, stato, cx, cy, r):
    tipo, v = stato
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(1.8)
    if tipo == "freccia":
        _freccia(c, cx, cy, r * 0.85, v)
    elif tipo == "punti":
        pos = [(-0.5, 0.5), (0.5, 0.5), (0, 0), (-0.5, -0.5), (0.5, -0.5), (0, 0.85), (0, -0.85)]
        # disposizioni fisse: 1..6 puntini
        schemi = {1: [2], 2: [0, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 3, 4, 5, 6]}
        for i in schemi[v]:
            px, py = pos[i]
            c.circle(cx + px * r, cy + py * r, r * 0.17, stroke=0, fill=1)
    elif tipo == "forma":
        if v == "cerchio":
            c.circle(cx, cy, r * 0.75, stroke=1, fill=0)
        elif v == "quadrato":
            c.rect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4, stroke=1, fill=0)
        elif v == "triangolo":
            p = c.beginPath()
            p.moveTo(cx, cy + r * 0.85)
            p.lineTo(cx - r * 0.85, cy - r * 0.6)
            p.lineTo(cx + r * 0.85, cy - r * 0.6)
            p.close()
            c.drawPath(p, stroke=1, fill=0)
        else:  # rombo
            p = c.beginPath()
            p.moveTo(cx, cy + r * 0.9)
            p.lineTo(cx + r * 0.7, cy)
            p.lineTo(cx, cy - r * 0.9)
            p.lineTo(cx - r * 0.7, cy)
            p.close()
            c.drawPath(p, stroke=1, fill=0)
    elif tipo == "barre":
        passo = r * 1.8 / 7
        x_inizio = cx - passo * (v - 1) / 2
        for k in range(v):
            c.line(x_inizio + k * passo, cy - r * 0.7, x_inizio + k * passo, cy + r * 0.7)
    elif tipo == "angolo":
        c.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6, stroke=1, fill=0)
        px = cx + (-0.5 if v in (0, 3) else 0.5) * r * 1.0
        py = cy + (0.5 if v in (0, 1) else -0.5) * r * 1.0
        c.circle(px, py, r * 0.2, stroke=0, fill=1)


def _regole():
    """5 regole: ognuna ha 5 stati consecutivi (4 mostrati + risposta) e 3 stati sbagliati plausibili."""
    return [
        {  # freccia che ruota di 90° in senso orario
            "nome": "ruota",
            "stati": [("freccia", g) for g in (0, -90, -180, -270, 0)],
            "sbagliati": [("freccia", -90), ("freccia", -180), ("freccia", -270)],
        },
        {  # puntini che aumentano
            "nome": "punti",
            "stati": [("punti", n) for n in (1, 2, 3, 4, 5)],
            "sbagliati": [("punti", 4), ("punti", 6), ("punti", 3)],
        },
        {  # forme che si ripetono in ciclo
            "nome": "forme",
            "stati": [("forma", f) for f in ("cerchio", "quadrato", "triangolo", "cerchio", "quadrato")],
            "sbagliati": [("forma", "cerchio"), ("forma", "triangolo"), ("forma", "rombo")],
        },
        {  # barre che aumentano
            "nome": "barre",
            "stati": [("barre", n) for n in (1, 2, 3, 4, 5)],
            "sbagliati": [("barre", 4), ("barre", 6), ("barre", 3)],
        },
        {  # puntino che gira intorno al quadrato
            "nome": "angolo",
            "stati": [("angolo", k) for k in (0, 1, 2, 3, 0)],
            "sbagliati": [("angolo", 1), ("angolo", 2), ("angolo", 3)],
        },
    ]


def crea_serie(parola, rng):
    valida_parola(parola)
    regole = _regole()
    assert len(parola) == len(regole), "la serie di figure richiede una parola di 5 lettere"
    rng.shuffle(regole)
    prove = []
    for lettera, reg in zip(parola, regole):
        giusta = reg["stati"][4]
        opzioni = [giusta] + [s for s in reg["sbagliati"] if s != giusta]
        assert len(set(opzioni)) == 4, reg["nome"]
        lettere_esca = [ch for ch in ALFABETO if ch != lettera]
        rng.shuffle(lettere_esca)
        coppie = [(giusta, lettera)] + [(s, lettere_esca[i]) for i, s in enumerate(opzioni[1:])]
        rng.shuffle(coppie)
        prove.append({"nome": reg["nome"], "mostrati": reg["stati"][:4], "giusta": giusta, "opzioni": coppie})
    return prove


def disegna_serie(c, box, d, soluzione):
    x0, y0, w, h = box
    prove = d["prove"]
    lato = 44
    gap = 5
    passo = min(98, (h - 20) / len(prove))
    # larghezza riga: 4 mostrati + '?' + spazio + 4 opzioni
    tot = 9 * lato + 8 * gap + 26
    x_inizio = x0 + (w - tot) / 2
    for k, prova in enumerate(prove):
        yy = y0 + h - 14 - k * passo - lato
        c.setFillColor(black)
        c.setFont(FONT_B, 12)
        c.drawString(x0, yy + lato / 2 - 4, f"{k + 1}")
        x = x_inizio + 14
        for st in prova["mostrati"]:
            c.setLineWidth(1.4)
            c.setStrokeColor(black)
            c.setFillColor(white)
            c.rect(x, yy, lato, lato, stroke=1, fill=0)
            disegna_stato(c, st, x + lato / 2, yy + lato / 2, lato * 0.38)
            x += lato + gap
        # casella '?'
        c.setFillColor(GRIGIO)
        c.setLineWidth(1.8)
        c.rect(x, yy, lato, lato, stroke=1, fill=1)
        if soluzione:
            disegna_stato(c, prova["giusta"], x + lato / 2, yy + lato / 2, lato * 0.38)
        else:
            c.setFillColor(black)
            c.setFont(FONT_B, 26)
            c.drawCentredString(x + lato / 2, yy + 12, "?")
        x += lato + gap + 26
        for st, lettera in prova["opzioni"]:
            giusta = st == prova["giusta"]
            c.setLineWidth(2.4 if (soluzione and giusta) else 1.4)
            c.setStrokeColor(black)
            c.setFillColor(white)
            c.rect(x, yy, lato, lato, stroke=1, fill=0)
            disegna_stato(c, st, x + lato / 2, yy + lato / 2, lato * 0.38)
            c.setFillColor(black)
            c.setFont(FONT_B if (soluzione and giusta) else FONT, 15)
            c.drawCentredString(x + lato / 2, yy - 16, lettera)
            if soluzione and giusta:
                c.setLineWidth(2.4)
                c.ellipse(x - 3, yy - 22, x + lato + 3, yy + lato + 4, stroke=1, fill=0)
            x += lato + gap
    c.setFont(FONT_I, 10.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, y0 + 2, "Per ogni riga: osserva come cambiano le figure, scegli quella che continua la serie e segna la sua lettera.")


def serie_facile(parola, rng):
    prove = crea_serie(parola, rng)
    d = {"parola": parola, "prove": prove}
    return Enigma(
        titolo="Serie di figure",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "In ogni riga le prime quattro figure seguono una regola. Scopri qual è la figura che deve andare "
            "nella casella col punto interrogativo, scegliendola tra le quattro a destra. Sotto ogni figura "
            "c'è una lettera: scrivi di seguito le lettere delle cinque figure giuste e leggi la parola."
        ),
        prompt_risposta="Scrivi la parola formata dalle 5 lettere giuste:",
        risposta=parola,
        spiegazione="Le figure giuste sono cerchiate; le loro lettere, in ordine dall'alto in basso, formano " + parola + ".",
        disegna=lambda c, box, sol: disegna_serie(c, box, d, sol),
    ), d


# --------------------------------------------------------------------------- ombre e specchi
# una forma è un insieme di celle (riga, colonna) su una griglia 4x4
def normalizza(celle):
    r0 = min(r for r, _ in celle)
    c0 = min(c for _, c in celle)
    return frozenset((r - r0, c - c0) for r, c in celle)


def ruota90(celle):
    return normalizza({(c, -r) for r, c in celle})


def specchia(celle):
    """Immagine allo specchio (asse verticale): destra e sinistra scambiate."""
    return normalizza({(r, -c) for r, c in celle})


def tutte_le_rotazioni(celle):
    out, cur = [], normalizza(celle)
    for _ in range(4):
        out.append(cur)
        cur = ruota90(cur)
    return out


def e_chirale(celle):
    """True se la forma non coincide con la sua immagine speculare, in nessuna rotazione."""
    return normalizza(celle) not in tutte_le_rotazioni(specchia(celle))


def _connessa(celle):
    celle = set(celle)
    start = next(iter(celle))
    visti, pila = {start}, [start]
    while pila:
        r, c = pila.pop()
        for nb in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if nb in celle and nb not in visti:
                visti.add(nb)
                pila.append(nb)
    return len(visti) == len(celle)


def forma_casuale(rng, n_celle=6, lato=4):
    """Forma connessa, non simmetrica (né per rotazione né per specchio) su griglia lato x lato."""
    while True:
        celle = set()
        tutte = [(r, c) for r in range(lato) for c in range(lato)]
        celle = set(rng.sample(tutte, n_celle))
        if not _connessa(celle):
            continue
        f = normalizza(celle)
        if max(r for r, _ in f) >= lato or max(c for _, c in f) >= lato:
            continue
        if not e_chirale(f):
            continue
        # niente simmetria per rotazione: le 4 rotazioni devono essere tutte diverse
        if len(set(tutte_le_rotazioni(f))) != 4:
            continue
        # niente forme larghe 1 cella (troppo banali)
        if max(r for r, _ in f) < 2 or max(c for _, c in f) < 2:
            continue
        return f


def _modifica(forma, rng, lato=4):
    """Sposta una cella: forma simile ma diversa da tutte le rotazioni e riflessioni."""
    for _ in range(200):
        celle = set(forma)
        togli = rng.choice(sorted(celle))
        celle.discard(togli)
        vicini = {(r + dr, c + dc) for r, c in celle for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))} - celle
        nuova = rng.choice(sorted(vicini))
        celle.add(nuova)
        f = normalizza(celle)
        if not _connessa(f) or max(r for r, _ in f) >= lato or max(c for _, c in f) >= lato:
            continue
        famiglia = set(tutte_le_rotazioni(forma)) | set(tutte_le_rotazioni(specchia(forma)))
        if f in famiglia:
            continue
        return f
    raise RuntimeError("modifica non trovata")


def crea_ombre_specchi(parola, rng):
    valida_parola(parola)
    assert len(parola) == 5
    tipi = ["specchio", "ombra", "specchio", "ombra", "specchio"]
    rng.shuffle(tipi)
    prove = []
    for lettera, tipo in zip(parola, tipi):
        forma = forma_casuale(rng)
        if tipo == "specchio":
            giusta = specchia(forma)
            sbagliate = [ruota90(forma), ruota90(ruota90(forma)), _modifica(forma, rng)]
        else:
            giusta = forma  # l'ombra ha lo stesso verso della figura
            sbagliate = [specchia(forma), ruota90(forma), _modifica(forma, rng)]
        opzioni = [giusta] + sbagliate
        assert len(set(opzioni)) == 4
        lettere_esca = [ch for ch in ALFABETO if ch != lettera]
        rng.shuffle(lettere_esca)
        coppie = [(giusta, lettera)] + [(s, lettere_esca[i]) for i, s in enumerate(sbagliate)]
        rng.shuffle(coppie)
        prove.append({"tipo": tipo, "forma": forma, "giusta": giusta, "opzioni": coppie})
    return prove


def _disegna_forma(c, forma, x, y, cella, pieno):
    """Disegna la forma nella casella di 4x4 celle con angolo in basso a sinistra (x, y)."""
    righe = max(r for r, _ in forma) + 1
    cols = max(c_ for _, c_ in forma) + 1
    ox = x + (4 - cols) * cella / 2
    oy = y + (4 - righe) * cella / 2
    c.setLineWidth(1.4)
    c.setStrokeColor(black)
    c.setFillColor(black if pieno else white)
    for r, col in forma:
        c.rect(ox + col * cella, oy + (righe - 1 - r) * cella, cella, cella, stroke=1, fill=1)


def disegna_ombre(c, box, d, soluzione):
    x0, y0, w, h = box
    prove = d["prove"]
    cella = 11
    lato = cella * 4 + 6
    passo = min(98, (h - 20) / len(prove))
    gap = 12
    tot = lato + 70 + 4 * lato + 3 * gap
    x_inizio = x0 + (w - tot) / 2
    for k, prova in enumerate(prove):
        yy = y0 + h - 14 - k * passo - lato
        c.setFillColor(black)
        c.setFont(FONT_B, 12)
        c.drawString(x0, yy + lato / 2 - 4, f"{k + 1}")
        # figura (a sinistra) e specchio / freccia
        c.setLineWidth(1.4)
        c.setStrokeColor(black)
        c.setFillColor(white)
        c.rect(x_inizio, yy, lato, lato, stroke=1, fill=0)
        _disegna_forma(c, prova["forma"], x_inizio + 3, yy + 3, cella, pieno=False)
        mx = x_inizio + lato + 14
        if prova["tipo"] == "specchio":
            c.setLineWidth(3)
            c.line(mx, yy - 4, mx, yy + lato + 4)
            c.setLineWidth(1)
            for t in range(6):
                yt = yy - 2 + t * (lato + 6) / 5
                c.line(mx, yt, mx + 7, yt - 7)
            c.setFont(FONT_B, 10)
            c.setFillColor(black)
            c.drawCentredString(mx + 3, yy - 17, "SPECCHIO")
        else:
            c.setFont(FONT_B, 10)
            c.setFillColor(black)
            c.drawCentredString(mx + 7, yy + lato / 2 + 2, "OMBRA")
            c.setLineWidth(1.4)
            c.line(mx - 6, yy + lato / 2 - 4, mx + 20, yy + lato / 2 - 4)
            p = c.beginPath()
            p.moveTo(mx + 20, yy + lato / 2 - 9)
            p.lineTo(mx + 26, yy + lato / 2 - 4)
            p.lineTo(mx + 20, yy + lato / 2 + 1)
            p.close()
            c.drawPath(p, stroke=0, fill=1)
        x = x_inizio + lato + 70
        for forma, lettera in prova["opzioni"]:
            giusta = forma == prova["giusta"]
            c.setLineWidth(1.4)
            c.setStrokeColor(black)
            c.setFillColor(white)
            c.rect(x, yy, lato, lato, stroke=1, fill=0)
            _disegna_forma(c, forma, x + 3, yy + 3, cella, pieno=(prova["tipo"] == "ombra"))
            c.setFillColor(black)
            c.setFont(FONT_B if (soluzione and giusta) else FONT, 15)
            c.drawCentredString(x + lato / 2, yy - 16, lettera)
            if soluzione and giusta:
                c.setLineWidth(2.4)
                c.ellipse(x - 3, yy - 22, x + lato + 3, yy + lato + 4, stroke=1, fill=0)
            x += lato + gap
    c.setFont(FONT_I, 10.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, y0 + 2, "Specchio: la figura riflessa (destra e sinistra scambiate). Ombra: la stessa figura, tutta nera, nello stesso verso.")


def ombre_medio(parola, rng):
    prove = crea_ombre_specchi(parola, rng)
    d = {"parola": parola, "prove": prove}
    return Enigma(
        titolo="Ombre e specchi",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "In ogni riga trovi una figura a sinistra. Se accanto c'è uno SPECCHIO, cerca tra le quattro figure "
            "a destra quella che si vedrebbe riflessa nello specchio (destra e sinistra si scambiano, ma niente "
            "ruota). Se accanto c'è scritto OMBRA, cerca l'ombra nera della stessa figura, nello stesso verso. "
            "Scrivi di seguito le lettere delle cinque risposte giuste: formano una parola."
        ),
        prompt_risposta="Scrivi la parola formata dalle 5 lettere giuste:",
        risposta=parola,
        spiegazione="Le figure giuste sono cerchiate; le loro lettere, in ordine dall'alto in basso, formano " + parola + ".",
        disegna=lambda c, box, sol: disegna_ombre(c, box, d, sol),
    ), d
