"""Enigma 8, 'Serata giochi da tavolo': si contano i pezzi di una partita rimasta a metà.

Una plancia (isola di 19 esagoni con terreni, meeple, dadi, monete, carte, un rosone di triangoli) e fino a
6 domande, una per lettera della parola. I conteggi sono costruiti su misura sull'alfabeto A=1, B=2...
(21 lettere). Sei metodi per passare dai numeri alla parola, da confrontare:
  tabella_a1         tabella A=1, B=2...
  tracciato          tracciato del punteggio: 21 caselle numerate con una lettera ciascuna
  griglia_esagonale  una riga di esagoni di lettere per domanda, la colonna è il risultato
  carte              per ogni domanda tre carte «numero = lettera»
  classifica         somma dei risultati -> parola in una classifica
  personaggi         il numero indica un personaggio; si usa la sua iniziale
"""
import itertools
import math
import random
from fractions import Fraction
from functools import lru_cache

from reportlab.lib.colors import black, white
from reportlab.lib.utils import simpleSplit

from .alfabeto import ALFABETO, valida_parola
from .base import Enigma, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I, stella

CATEGORIA = "Enigmi visivi - giochi da tavolo"
METODI = ["tabella_a1", "tracciato", "griglia_esagonale", "carte", "classifica", "personaggi"]
TITOLI_METODI = {
    "tabella_a1": "tabella A=1",
    "tracciato": "tracciato del punteggio",
    "griglia_esagonale": "griglia esagonale di lettere",
    "carte": "carte numero=lettera",
    "classifica": "classifica del punteggio",
    "personaggi": "mazzo dei personaggi",
}

TERRENI = ["foresta", "campi", "colline", "mare", "montagna"]
NOME_TERRENO = {"foresta": "FORESTA", "campi": "CAMPI", "colline": "COLLINE", "mare": "MARE", "montagna": "MONTAGNA"}
STILI_MEEPLE = ["nero", "bianco", "rigato", "puntinato"]
NOME_MEEPLE = {"nero": "NERI", "bianco": "BIANCHI", "rigato": "RIGATI", "puntinato": "PUNTINATI"}
SIMBOLI_CARTE = ["stella", "cerchio", "quadrato", "triangolo"]

PAROLE_ESCA = ["PEDINA", "TURNO", "DADO", "CARTA", "REGOLE", "PUNTI", "TABELLA", "MOSSA", "SFIDA", "BANCO"]
PERSONAGGI = {  # iniziale -> nomi (tutti diversi)
    "A": ["Arciere", "Alchimista"], "B": ["Bardo", "Barbaro"], "C": ["Cavaliere", "Chierico"],
    "D": ["Drago", "Druido"], "E": ["Elfo", "Eremita"], "F": ["Fata", "Fabbro"], "G": ["Gnomo", "Goblin"],
    "L": ["Lanciere", "Lupo"], "M": ["Mago", "Mercante"], "N": ["Nano", "Ninfa"], "O": ["Orco", "Oste"],
    "P": ["Paladino", "Pirata"], "R": ["Re", "Regina"], "S": ["Stregone", "Samurai"],
    "T": ["Troll", "Tritone"], "U": ["Unicorno", "Usignolo"], "V": ["Vampiro", "Vichingo"],
    "Z": ["Zombie", "Zingaro"], "H": ["Hobbit"], "I": ["Imperatore", "Idra"], "Q": ["Quercia"],
}


# --------------------------------------------------------------------------- rosone di triangoli
# Esagono di lato 1 nel reticolo triangolare (coordinate intere (a, b): x = a + b/2, y = b * sqrt(3)/2).
_D = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
_O = (0, 0)


def segmenti_rosone(maschera_raggi, maschera_diagonali):
    """Bordo dell'esagono + raggi (centro-vertice) + diagonali corte (vertice-vertice+2) scelti da 2 maschere a 6 bit."""
    segs = [(_D[k], _D[(k + 1) % 6]) for k in range(6)]
    segs += [(_O, _D[k]) for k in range(6) if maschera_raggi >> k & 1]
    segs += [(_D[k], _D[(k + 2) % 6]) for k in range(6) if maschera_diagonali >> k & 1]
    return segs


def _intersezione(s, t):
    (x1, y1), (x2, y2) = s
    (x3, y3), (x4, y4) = t
    d1 = (x2 - x1, y2 - y1)
    d2 = (x4 - x3, y4 - y3)
    den = d1[0] * d2[1] - d1[1] * d2[0]
    if den == 0:
        return None
    tt = Fraction((x3 - x1) * d2[1] - (y3 - y1) * d2[0], den)
    uu = Fraction((x3 - x1) * d1[1] - (y3 - y1) * d1[0], den)
    if 0 <= tt <= 1 and 0 <= uu <= 1:
        return (x1 + tt * d1[0], y1 + tt * d1[1])
    return None


def _su_segmento(p, s):
    (x1, y1), (x2, y2) = s
    if (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) != 0:
        return False
    return min(x1, x2) <= p[0] <= max(x1, x2) and min(y1, y2) <= p[1] <= max(y1, y2)


def _orientamento(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _unisci_allineati(segmenti):
    """Fonde i segmenti sulla stessa retta che si toccano o si sovrappongono (per il controllo indipendente)."""
    segs = [tuple(sorted(s)) for s in segmenti]
    cambiato = True
    while cambiato:
        cambiato = False
        for i, j in itertools.combinations(range(len(segs)), 2):
            a, b = segs[i], segs[j]
            if _orientamento(a[0], a[1], b[0]) == 0 and _orientamento(a[0], a[1], b[1]) == 0:
                if max(a[0], b[0]) <= min(a[1], b[1]):  # si toccano o si sovrappongono (ordine lessicografico)
                    nuovo = (min(a[0], b[0]), max(a[1], b[1]))
                    segs = [s for k, s in enumerate(segs) if k not in (i, j)] + [nuovo]
                    cambiato = True
                    break
    return segs


def conta_triangoli(segmenti):
    """Triangoli del disegno: terne di punti (estremi e incroci) a due a due uniti da un tratto, non allineati.

    I tratti allineati che si toccano (es. due raggi opposti) sono un'unica retta: un lato può passare dal centro."""
    segmenti = _unisci_allineati(segmenti)
    punti = set()
    for s in segmenti:
        punti |= {(Fraction(s[0][0]), Fraction(s[0][1])), (Fraction(s[1][0]), Fraction(s[1][1]))}
    for s, t in itertools.combinations(segmenti, 2):
        p = _intersezione(s, t)
        if p:
            punti.add((Fraction(p[0]), Fraction(p[1])))
    punti = sorted(punti)
    su = {p: frozenset(i for i, s in enumerate(segmenti) if _su_segmento(p, s)) for p in punti}
    n = 0
    for a, b, c in itertools.combinations(punti, 3):
        if su[a] & su[b] and su[a] & su[c] and su[b] & su[c] and _orientamento(a, b, c) != 0:
            n += 1
    return n


def conta_triangoli_per_rette(segmenti):
    """Secondo metodo, indipendente: terne di tratti massimali che si incontrano a due a due in tre punti non allineati."""
    segs = _unisci_allineati(segmenti)
    n = 0
    for s, t, u in itertools.combinations(segs, 3):
        a, b, c = _intersezione(s, t), _intersezione(s, u), _intersezione(t, u)
        if a and b and c and _orientamento(a, b, c) != 0:
            n += 1
    return n


def _simmetrica(m_r, m_d):
    return any(((m_r << r | m_r >> (6 - r)) & 63) == m_r and ((m_d << r | m_d >> (6 - r)) & 63) == m_d
               for r in (1, 2, 3))


@lru_cache(maxsize=None)
def trova_rosone(n):
    """Maschere (raggi, diagonali) di un rosone con esattamente n triangoli; preferisce disegni simmetrici e semplici."""
    candidati = sorted(
        ((0 if _simmetrica(a, b) else 1, len(segmenti_rosone(a, b)), a, b) for a in range(64) for b in range(64)))
    for _, _, a, b in candidati:
        if conta_triangoli(segmenti_rosone(a, b)) == n:
            return (a, b)
    return None


# --------------------------------------------------------------------------- scena: assegnazione e dati
INTERVALLI = {
    "dadi": range(3, 19),
    "monete": range(1, 22),
    "carte": range(1, 11),
    "terreno": range(1, 9),
    "meeple": range(1, 9),
}
TIPI = ["dadi", "monete", "carte", "terreno", "meeple", "triangoli"]


def tipo_ammesso(tipo, n):
    if tipo == "triangoli":
        return trova_rosone(n) is not None
    return n in INTERVALLI[tipo]


def assegna_tipi(conteggi, rng):
    """Un tipo di domanda diverso per ogni conteggio, compatibile con il numero. Errore chiaro se impossibile."""
    ordine = list(TIPI)
    rng.shuffle(ordine)

    def rec(i, usati):
        if i == len(conteggi):
            return []
        for t in ordine:
            if t not in usati and tipo_ammesso(t, conteggi[i]):
                resto = rec(i + 1, usati | {t})
                if resto is not None:
                    return [t] + resto
        return None

    risultato = rec(0, frozenset())
    if risultato is None:
        raise ValueError(f"Nessun abbinamento domande/pezzi possibile per i conteggi {conteggi}")
    return risultato


def celle_isola():
    """19 esagoni a punta in alto (coordinate assiali, raggio 2), ordinati dall'alto in basso."""
    return sorted(((q, r) for q in range(-2, 3) for r in range(-2, 3) if abs(q + r) <= 2), key=lambda qr: (qr[1], qr[0]))


def _dadi_con_somma(somma, rng):
    while True:
        v = [rng.randint(1, 6) for _ in range(3)]
        if sum(v) == somma:
            return v


def _monete(n, larg, alt, raggio, rng):
    """n posizioni distanziate dentro un rettangolo larg x alt."""
    for _ in range(500):
        pos = []
        for _ in range(n):
            for _ in range(2000):
                p = (rng.uniform(raggio + 2, larg - raggio - 2), rng.uniform(raggio + 2, alt - raggio - 2))
                if all(math.dist(p, q) >= 2 * raggio + 2.5 for q in pos):
                    pos.append(p)
                    break
            else:
                break
        if len(pos) == n:
            return pos
    raise RuntimeError("monete non sistemabili")


MONETE_AREA = (130, 70, 6.2)  # larghezza, altezza, raggio della moneta


def crea_scena(conteggi, rng):
    tipi = assegna_tipi(conteggi, rng)
    quesiti = dict(zip(tipi, conteggi))  # tipo -> numero atteso
    # terreni
    celle = celle_isola()
    terreno_chiesto = rng.choice(TERRENI) if "terreno" in quesiti else None
    n_t = quesiti.get("terreno", rng.randint(2, 6))
    altri_t = [t for t in TERRENI if t != terreno_chiesto] if terreno_chiesto else list(TERRENI)
    resto = [altri_t[i % len(altri_t)] for i in range(len(celle) - n_t)]
    rng.shuffle(resto)
    terreni = ([terreno_chiesto] * n_t if terreno_chiesto else [rng.choice(TERRENI) for _ in range(n_t)]) + resto
    rng.shuffle(terreni)
    mappa = {c: t for c, t in zip(celle, terreni)}
    # meeple
    stile_chiesto = rng.choice(STILI_MEEPLE) if "meeple" in quesiti else None
    n_per_stile = {s: rng.randint(1, 4) for s in STILI_MEEPLE}
    if stile_chiesto:
        n_per_stile[stile_chiesto] = quesiti["meeple"]
    meeple = []
    lista = [st for st in STILI_MEEPLE for _ in range(n_per_stile[st])]
    rng.shuffle(lista)
    per_cella = {c: 0 for c in celle}
    for st in lista:
        liberi = [c for c in celle if per_cella[c] < 2]
        minimo = min(per_cella[c] for c in liberi)
        cella = rng.choice([c for c in liberi if per_cella[c] == minimo])
        per_cella[cella] += 1
        meeple.append({"cella": cella, "stile": st})
    # dadi, monete, carte
    somma = quesiti.get("dadi", rng.randint(6, 15))
    dadi = _dadi_con_somma(somma, rng)
    n_monete = quesiti.get("monete", rng.randint(8, 16))
    monete = _monete(n_monete, MONETE_AREA[0], MONETE_AREA[1], MONETE_AREA[2], rng)
    k = quesiti.get("carte", rng.randint(2, 6))
    n_carte = min(14, max(k + 3, 8))
    carte = ["stella"] * k + [rng.choice(SIMBOLI_CARTE[1:]) for _ in range(n_carte - k)]
    rng.shuffle(carte)
    # rosone
    n_tri = quesiti.get("triangoli", 12)
    mr, md = trova_rosone(n_tri)
    domande = []
    for tipo, n in zip(tipi, conteggi):
        if tipo == "dadi":
            testo = "Quanti puntini ci sono in tutto sui tre dadi?"
        elif tipo == "monete":
            testo = "Quante monete ci sono?"
        elif tipo == "carte":
            testo = "Quante carte hanno la STELLA?"
        elif tipo == "terreno":
            testo = f"Quante tessere di {NOME_TERRENO[terreno_chiesto]}?"
        elif tipo == "meeple":
            testo = f"Quanti meeple {NOME_MEEPLE[stile_chiesto]}?"
        else:
            testo = "Quanti triangoli ci sono nel rosone?"
        domande.append({"tipo": tipo, "testo": testo, "n": n})
    return {
        "mappa": mappa, "meeple": meeple, "dadi": dadi, "monete": monete, "carte": carte,
        "rosone": (mr, md), "domande": domande, "terreno_chiesto": terreno_chiesto, "stile_chiesto": stile_chiesto,
    }


def verifica_scena(scena):
    """Ricalcola dai dati disegnati ogni risposta. Usato dai test (e come controllo prima di stampare)."""
    risposte = []
    for d in scena["domande"]:
        t = d["tipo"]
        if t == "dadi":
            n = sum(scena["dadi"])
        elif t == "monete":
            n = len(scena["monete"])
        elif t == "carte":
            n = sum(1 for c in scena["carte"] if c == "stella")
        elif t == "terreno":
            n = sum(1 for v in scena["mappa"].values() if v == scena["terreno_chiesto"])
        elif t == "meeple":
            n = sum(1 for m in scena["meeple"] if m["stile"] == scena["stile_chiesto"])
        else:
            n = conta_triangoli(segmenti_rosone(*scena["rosone"]))
        risposte.append(n)
    return risposte


# --------------------------------------------------------------------------- disegno: pezzi
def _punti_esagono(cx, cy, r):
    return [(cx + r * math.cos(math.radians(30 + 60 * k)), cy + r * math.sin(math.radians(30 + 60 * k))) for k in range(6)]


def _percorso(c, punti):
    p = c.beginPath()
    p.moveTo(*punti[0])
    for q in punti[1:]:
        p.lineTo(*q)
    p.close()
    return p


def disegna_trama_terreno(c, terreno, cx, cy, r):
    c.saveState()
    c.clipPath(_percorso(c, _punti_esagono(cx, cy, r)), stroke=0, fill=0)
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(0.9)
    if terreno == "foresta":
        for dx, dy in ((-0.38, -0.2), (0.38, -0.2), (0, 0.32), (-0.05, -0.58)):
            x, y, s = cx + dx * r, cy + dy * r, 0.27 * r
            c.line(x, y - s, x, y - s * 1.5)
            p = c.beginPath()
            p.moveTo(x, y + s)
            p.lineTo(x - s * 0.8, y - s)
            p.lineTo(x + s * 0.8, y - s)
            p.close()
            c.setFillColor(black)
            c.drawPath(p, stroke=1, fill=1)
    elif terreno == "campi":
        c.setLineWidth(1.1)
        k = -4
        while k <= 4:
            c.line(cx - r, cy + k * r * 0.2, cx + r, cy + k * r * 0.2)
            k += 1
    elif terreno == "colline":
        c.setLineWidth(1.3)
        for dx, dy in ((-0.45, 0.35), (0.45, 0.35), (0, -0.05), (-0.45, -0.45), (0.45, -0.45)):
            x, y, w = cx + dx * r, cy + dy * r, 0.34 * r
            c.arc(x - w, y - w, x + w, y + w, 0, 180)
    elif terreno == "mare":
        c.setLineWidth(1.1)
        for dy in (-0.6, -0.25, 0.1, 0.45, 0.8):
            pts = [(cx - r + i * r * 0.2, cy + dy * r + 0.1 * r * math.sin(i * math.pi / 1.0 * 1.0 + dy * 6)) for i in range(11)]
            p = c.beginPath()
            p.moveTo(*pts[0])
            for q in pts[1:]:
                p.lineTo(*q)
            c.drawPath(p, stroke=1, fill=0)
    else:  # montagna
        for dx, dy, s, pieno in ((-0.3, -0.35, 0.62, False), (0.38, -0.35, 0.42, True), (0.0, 0.18, 0.4, False)):
            x, y = cx + dx * r, cy + dy * r
            p = c.beginPath()
            p.moveTo(x, y + s * r)
            p.lineTo(x - s * r * 0.85, y - s * r * 0.55)
            p.lineTo(x + s * r * 0.85, y - s * r * 0.55)
            p.close()
            c.setFillColor(black if pieno else white)
            c.drawPath(p, stroke=1, fill=1)
    c.restoreState()


def disegna_esagono(c, cx, cy, r, terreno=None, spessore=1.8):
    c.setStrokeColor(black)
    c.setFillColor(white)
    c.setLineWidth(spessore)
    p = _percorso(c, _punti_esagono(cx, cy, r))
    c.drawPath(p, stroke=0, fill=1)
    if terreno:
        disegna_trama_terreno(c, terreno, cx, cy, r)
    c.setStrokeColor(black)
    c.setLineWidth(spessore)
    c.drawPath(p, stroke=1, fill=0)


_MEEPLE_CORPO = [(-0.40, 0.00), (-0.10, 0.00), (0.00, 0.14), (0.10, 0.00), (0.40, 0.00), (0.22, 0.46), (0.50, 0.52),
                 (0.50, 0.66), (0.20, 0.70), (0.20, 0.74), (-0.20, 0.74), (-0.20, 0.70), (-0.50, 0.66),
                 (-0.50, 0.52), (-0.22, 0.46)]


def disegna_meeple(c, cx, base, h, stile):
    """Meeple alto h con la base in (cx, base); lo stile sostituisce il colore (stampa in bianco e nero)."""
    corpo = [(cx + x * h, base + y * h) for x, y in _MEEPLE_CORPO]
    testa = (cx, base + 0.88 * h, 0.15 * h)
    for parte in ("corpo", "testa"):
        c.saveState()
        if parte == "corpo":
            path = _percorso(c, corpo)
        else:
            path = c.beginPath()
            path.circle(testa[0], testa[1], testa[2])
        c.setLineWidth(1.0)
        c.setStrokeColor(black)
        c.setFillColor(black if stile == "nero" else white)
        c.drawPath(path, stroke=0, fill=1)
        if stile in ("rigato", "puntinato"):
            c.clipPath(path, stroke=0, fill=0)
            c.setFillColor(black)
            if stile == "rigato":
                c.setLineWidth(1.1)
                k = -1.0
                while k < 1.2:
                    c.line(cx - h * 0.5, base + k * h * 0.3, cx + h * 0.5, base + (k + 1.2) * h * 0.3)
                    k += 0.45
            else:
                y = base + 0.05 * h
                while y < base + 1.05 * h:
                    x = cx - 0.5 * h
                    while x < cx + 0.55 * h:
                        c.circle(x, y, 0.045 * h, stroke=0, fill=1)
                        x += 0.2 * h
                    y += 0.2 * h
        c.restoreState()
        c.setStrokeColor(black)
        c.setLineWidth(1.0)
        c.drawPath(path, stroke=1, fill=0)


def disegna_dado(c, x, y, lato, valore):
    c.setStrokeColor(black)
    c.setFillColor(white)
    c.setLineWidth(1.6)
    c.roundRect(x, y, lato, lato, lato * 0.18, stroke=1, fill=1)
    g = lato * 0.26
    posizioni = {1: [(0, 0)], 2: [(-1, 1), (1, -1)], 3: [(-1, 1), (0, 0), (1, -1)],
                 4: [(-1, 1), (1, 1), (-1, -1), (1, -1)], 5: [(-1, 1), (1, 1), (0, 0), (-1, -1), (1, -1)],
                 6: [(-1, 1), (1, 1), (-1, 0), (1, 0), (-1, -1), (1, -1)]}
    c.setFillColor(black)
    for px, py in posizioni[valore]:
        c.circle(x + lato / 2 + px * g, y + lato / 2 + py * g, lato * 0.075, stroke=0, fill=1)


def disegna_moneta(c, cx, cy, r):
    c.setStrokeColor(black)
    c.setFillColor(white)
    c.setLineWidth(1.4)
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setLineWidth(0.8)
    c.circle(cx, cy, r * 0.68, stroke=1, fill=0)


def disegna_carta(c, x, y, w, h, simbolo):
    c.setStrokeColor(black)
    c.setFillColor(white)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 3, stroke=1, fill=1)
    cx, cy, r = x + w / 2, y + h / 2, w * 0.28
    c.setFillColor(black)
    c.setLineWidth(1.0)
    if simbolo == "stella":
        stella(c, cx, cy, r * 1.35, pieno=True, spessore=0.8)
    elif simbolo == "cerchio":
        c.circle(cx, cy, r, stroke=1, fill=0)
    elif simbolo == "quadrato":
        c.rect(cx - r, cy - r, 2 * r, 2 * r, stroke=1, fill=0)
    else:
        p = c.beginPath()
        p.moveTo(cx, cy + r * 1.1)
        p.lineTo(cx - r * 1.1, cy - r * 0.8)
        p.lineTo(cx + r * 1.1, cy - r * 0.8)
        p.close()
        c.drawPath(p, stroke=1, fill=0)


def disegna_rosone(c, cx, cy, u, maschere):
    segs = segmenti_rosone(*maschere)

    def cart(p):
        return cx + (p[0] + p[1] / 2) * u, cy + p[1] * math.sqrt(3) / 2 * u

    c.setStrokeColor(black)
    c.setLineCap(1)
    for k, (a, b) in enumerate(segs):
        c.setLineWidth(2.4 if k < 6 else 1.7)
        c.line(*cart(a), *cart(b))
    c.setLineCap(0)


# --------------------------------------------------------------------------- disegno: plancia
RAGGIO_ESAGONO = 21.0
ALTEZZA_RIGA_A = 186  # isola + legenda + domande
ALTEZZA_VASSOIO = 96
ALTEZZA_PLANCIA = ALTEZZA_RIGA_A + 4 + ALTEZZA_VASSOIO


def _etichetta(c, x, y, testo, size=9):
    c.setFillColor(black)
    c.setFont(FONT_B, size)
    c.drawString(x, y, testo)


def disegna_plancia(c, box, d, soluzione):
    x0, y0, w, h = box
    scena = d["scena"]
    r = RAGGIO_ESAGONO
    y_alto = y0 + h - 4
    # isola
    cx0 = x0 + 5 * r * math.sqrt(3) / 2 + 2
    cy0 = y_alto - 4 * r
    centri = {}
    for (q, rr) in celle_isola():
        cx = cx0 + r * math.sqrt(3) * (q + rr / 2)
        cy = cy0 - r * 1.5 * rr
        centri[(q, rr)] = (cx, cy)
        disegna_esagono(c, cx, cy, r, scena["mappa"][(q, rr)])
    per_cella = {}
    for m in scena["meeple"]:
        per_cella.setdefault(m["cella"], []).append(m["stile"])
    for cella, stili in per_cella.items():
        cx, cy = centri[cella]
        spost = [0] if len(stili) == 1 else [-9, 9]
        for dx, stile in zip(spost, stili):
            disegna_meeple(c, cx + dx, cy - r * 0.42, r * 0.8, stile)
    # colonna destra: legenda + domande
    xr = x0 + 5 * r * math.sqrt(3) + 12
    wr = x0 + w - xr
    _etichetta(c, xr, y_alto - 9, "LEGENDA", 10)
    yl = y_alto - 27
    for i, t in enumerate(TERRENI):
        xx = xr + i * (wr / 5)
        disegna_esagono(c, xx + 8, yl + 3, 8, t, spessore=1.0)
        c.setFillColor(black)
        c.setFont(FONT, 7.6)
        c.drawString(xx + 19, yl, NOME_TERRENO[t].capitalize())
    yl = y_alto - 49
    for i, st in enumerate(STILI_MEEPLE):
        xx = xr + i * (wr / 4)
        disegna_meeple(c, xx + 8, yl - 5, 16, st)
        c.setFillColor(black)
        c.setFont(FONT, 7.6)
        c.drawString(xx + 19, yl, NOME_MEEPLE[st].capitalize())
    # domande
    yq = y_alto - 90
    _etichetta(c, xr, yq + 16, "LE DOMANDE", 10)
    for k, dom in enumerate(scena["domande"]):
        y = yq - k * 17
        c.setFillColor(black)
        c.setFont(FONT_B, 9)
        c.drawString(xr, y, f"{k + 1}")
        c.setFont(FONT, 8.6)
        c.drawString(xr + 12, y, dom["testo"])
        c.setLineWidth(1.3)
        c.setStrokeColor(black)
        c.setFillColor(white)
        c.rect(xr + wr - 29, y - 4, 29, 13, stroke=1, fill=1)
        if soluzione:
            c.setFillColor(black)
            c.setFont(FONT_B, 10)
            c.drawCentredString(xr + wr - 14.5, y - 1.5, str(dom["n"]))
    # vassoio dei pezzi
    yv = y_alto - ALTEZZA_RIGA_A - 4
    x = x0
    _etichetta(c, x, yv - 8, "DADI")
    for i, v in enumerate(scena["dadi"]):
        disegna_dado(c, x + 2 + 31 * (i % 2), yv - 42 - 33 * (i // 2), 27, v)
    x += 74
    _etichetta(c, x, yv - 8, "MONETE")
    w_m, h_m, r_m = MONETE_AREA
    c.setLineWidth(1)
    c.setStrokeColor(GRIGIO_SCURO)
    c.roundRect(x, yv - 14 - h_m - 2, w_m + 2, h_m + 4, 6, stroke=1, fill=0)
    for (px, py) in scena["monete"]:
        disegna_moneta(c, x + 1 + px, yv - 14 - h_m + py, r_m)
    x += w_m + 12
    _etichetta(c, x, yv - 8, "CARTE")
    cw, ch = 21, 28
    for i, simb in enumerate(scena["carte"]):
        disegna_carta(c, x + (i % 7) * (cw + 3), yv - 14 - ch - (i // 7) * (ch + 4), cw, ch, simb)
    x += 7 * (cw + 3) + 8
    _etichetta(c, x, yv - 8, "ROSONE")
    disegna_rosone(c, x + 38, yv - 54, 34, scena["rosone"])


# --------------------------------------------------------------------------- disegno: blocchi di conversione
def _casella(c, x, y, w, h, testo=None, size=14, fill=None, grassetto=True, raggio=0):
    c.setLineWidth(1.4)
    c.setStrokeColor(black)
    c.setFillColor(fill if fill is not None else white)
    if raggio:
        c.roundRect(x, y, w, h, raggio, stroke=1, fill=1)
    else:
        c.rect(x, y, w, h, stroke=1, fill=1)
    if testo is not None:
        c.setFillColor(black)
        c.setFont(FONT_B if grassetto else FONT, size)
        c.drawCentredString(x + w / 2, y + h / 2 - size * 0.33, str(testo))
    c.setFillColor(black)


def _titolo_blocco(c, x, y, testo):
    c.setFillColor(black)
    c.setFont(FONT_B, 10.5)
    c.drawString(x, y, testo)


def blocco_tabella_a1(c, box, d, soluzione):
    x0, y0, w, h = box
    _titolo_blocco(c, x0, y0 + h - 10, "LA TABELLA")
    cw, ch = 43, 38
    gx = x0 + (w - 11 * cw) / 2
    for riga, (a, b) in enumerate(((0, 11), (11, 21))):
        for i in range(a, b):
            x = gx + (i - a) * cw
            y = y0 + h - 18 - (riga + 1) * ch
            _casella(c, x, y, cw, ch, fill=GRIGIO if riga == 0 else None)
            c.setFillColor(black)
            c.setFont(FONT_B, 16)
            c.drawCentredString(x + cw / 2, y + 19, ALFABETO[i])
            c.setFont(FONT, 11)
            c.drawCentredString(x + cw / 2, y + 5, str(i + 1))
    yb = y0 + h - 18 - 2 * ch - 38
    n = len(d["parola"])
    lato, gap = 28, 12
    passo = lato + gap + 44
    tot = n * passo - gap
    xb = x0 + (w - tot) / 2
    c.setFont(FONT, 9.5)
    c.setFillColor(black)
    for k in range(n):
        xx = xb + k * passo
        c.drawString(xx, yb + 9, f"{k + 1})")
        _casella(c, xx + 13, yb, lato, 24, d["conteggi"][k] if soluzione else None, size=12)
        c.setFont(FONT_B, 12)
        c.drawString(xx + 13 + lato + 3, yb + 8, "→")
        _casella(c, xx + 13 + lato + 15, yb, 24, 24, d["parola"][k] if soluzione else None, size=14)
        c.setFont(FONT, 9.5)


def blocco_tracciato(c, box, d, soluzione):
    x0, y0, w, h = box
    _titolo_blocco(c, x0, y0 + h - 10, "IL TRACCIATO DEL PUNTEGGIO")
    cw, ch = 66, 36
    col = 7
    gx = x0 + (w - col * cw) / 2
    gy = y0 + h - 22
    lettere = d["tracciato"]
    for n in range(1, 22):
        riga, pos = divmod(n - 1, col)
        colonna = pos if riga % 2 == 0 else col - 1 - pos  # serpentina
        x = gx + colonna * cw
        y = gy - (riga + 1) * (ch + 6)
        evidenziata = soluzione and n in d["conteggi"]
        _casella(c, x, y, cw - 6, ch, fill=GRIGIO if evidenziata else None, raggio=7)
        c.setFillColor(black)
        c.setFont(FONT, 9)
        c.drawString(x + 5, y + ch - 12, str(n))
        c.setFont(FONT_B, 18)
        c.drawCentredString(x + (cw - 6) / 2 + 4, y + 8, lettere[n])
    # istruzioni sotto il tracciato
    c.setFont(FONT_I, 9.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, y0 + h - 22 - 3 * (ch + 6) - 14,
                 "Si parte dalla casella 1 e si va avanti a serpentina: la riga di sotto si legge al contrario.")
    # caselle risposta
    n = len(d["parola"])
    yb = y0 + h - 22 - 3 * (ch + 6) - 40
    c.setFont(FONT, 9.5)
    c.setFillColor(black)
    c.drawString(x0, yb + 8, "Risultato → lettera:")
    for k in range(n):
        xx = x0 + 110 + k * 60
        _casella(c, xx, yb, 24, 22, d["conteggi"][k] if soluzione else None, size=11)
        c.setFont(FONT_B, 11)
        c.drawString(xx + 26, yb + 7, "→")
        _casella(c, xx + 36, yb, 20, 22, d["parola"][k] if soluzione else None, size=13)


def blocco_griglia_esagonale(c, box, d, soluzione):
    x0, y0, w, h = box
    n = len(d["parola"])
    _titolo_blocco(c, x0, y0 + h - 10, "LA GRIGLIA ESAGONALE")
    cella = (w - 40) / 21.5
    r = cella / math.sqrt(3)
    gx = x0 + 38
    gy = y0 + h - 38
    c.setFont(FONT_B, 8)
    c.setFillColor(black)
    for col in range(21):
        c.drawCentredString(gx + (col + 0.5) * cella, gy + 10, str(col + 1))
    for riga in range(n):
        cy = gy - r - riga * 1.5 * r - 4
        c.setFont(FONT_B, 9)
        c.setFillColor(black)
        c.drawString(x0, cy - 3, f"Dom. {riga + 1}")
        for col in range(21):
            cx = gx + (col + 0.5) * cella + (cella / 2 if riga % 2 else 0)
            giusta = soluzione and col + 1 == d["conteggi"][riga]
            c.setStrokeColor(black)
            c.setLineWidth(1.0)
            c.setFillColor(GRIGIO if giusta else white)
            c.drawPath(_percorso(c, _punti_esagono(cx, cy, r)), stroke=1, fill=1)
            c.setFillColor(black)
            c.setFont(FONT_B, 8.5)
            c.drawCentredString(cx, cy - 3, d["griglia"][riga][col])
    c.setFont(FONT_I, 9.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, gy - r - n * 1.5 * r - 14,
                 "Ogni domanda ha la sua riga di esagoni. Il risultato dice quante caselle contare da sinistra: leggi la lettera.")
    yb = gy - r - n * 1.5 * r - 40
    c.setFont(FONT, 9.5)
    c.setFillColor(black)
    c.drawString(x0, yb + 8, "Risultato → lettera:")
    for k in range(n):
        xx = x0 + 110 + k * 60
        _casella(c, xx, yb, 24, 22, d["conteggi"][k] if soluzione else None, size=11)
        c.setFont(FONT_B, 11)
        c.drawString(xx + 26, yb + 7, "→")
        _casella(c, xx + 36, yb, 20, 22, d["parola"][k] if soluzione else None, size=13)


def blocco_carte(c, box, d, soluzione):
    x0, y0, w, h = box
    _titolo_blocco(c, x0, y0 + h - 10, "LE CARTE DELLE RISPOSTE")
    n = len(d["parola"])
    righe = (n + 1) // 2
    cw, ch = 70, 34
    for k, opzioni in enumerate(d["carte"]):
        colonna, riga = divmod(k, righe)
        xx = x0 + colonna * (w / 2)
        yy = y0 + h - 24 - (riga + 1) * (ch + 14)
        c.setFillColor(black)
        c.setFont(FONT_B, 11)
        c.drawString(xx, yy + ch / 2 - 4, f"{k + 1}")
        for j, (num, lettera) in enumerate(opzioni):
            giusta = soluzione and num == d["conteggi"][k]
            _casella(c, xx + 16 + j * (cw + 8), yy, cw, ch, f"{num} = {lettera}", size=15,
                     fill=GRIGIO if giusta else None, raggio=5)
    yb = y0 + h - 24 - righe * (ch + 14) - 30
    c.setFont(FONT_I, 9.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, yb + 6, "Per ogni domanda cerchia la carta con il tuo risultato: le sei lettere, in ordine, formano la parola.")


def blocco_classifica(c, box, d, soluzione):
    x0, y0, w, h = box
    _titolo_blocco(c, x0, y0 + h - 10, "LA CLASSIFICA DEL PUNTEGGIO")
    c.setFont(FONT, 10.5)
    c.setFillColor(black)
    c.drawString(x0, y0 + h - 30, "Somma le risposte alle domande:")
    n = len(d["parola"])
    for k in range(n):
        c.setFont(FONT_B, 10)
        c.drawString(x0 + 190 + k * 42, y0 + h - 30, f"{k + 1}")
        _casella(c, x0 + 200 + k * 42, y0 + h - 36, 24, 18, d["conteggi"][k] if soluzione else None, size=10)
    c.setFont(FONT_B, 11)
    c.drawString(x0 + 200 + n * 42 + 2, y0 + h - 30, "=")
    _casella(c, x0 + 214 + n * 42, y0 + h - 38, 38, 22, sum(d["conteggi"]) if soluzione else None, size=12)
    cw1, cw2, rh = 96, 190, 18
    tx = x0 + (w - cw1 - cw2) / 2
    ty = y0 + h - 48
    _casella(c, tx, ty - rh, cw1, rh, "PUNTI", size=10, fill=GRIGIO)
    _casella(c, tx + cw1, ty - rh, cw2, rh, "GIOCATORE VINCENTE: PAROLA", size=9.5, fill=GRIGIO)
    for k, (tot, parola) in enumerate(d["classifica"]):
        yy = ty - (k + 2) * rh
        giusta = soluzione and tot == sum(d["conteggi"])
        _casella(c, tx, yy, cw1, rh, tot, size=12, fill=GRIGIO if giusta else None)
        _casella(c, tx + cw1, yy, cw2, rh, parola, size=12, fill=GRIGIO if giusta else None)


def blocco_personaggi(c, box, d, soluzione):
    x0, y0, w, h = box
    _titolo_blocco(c, x0, y0 + h - 10, "IL MAZZO DEI PERSONAGGI")
    cw, ch = (w - 12) / 3, 19
    for n, nome in d["personaggi"].items():
        col, riga = divmod(n - 1, 7)
        x = x0 + col * (cw + 6)
        y = y0 + h - 18 - (riga + 1) * (ch + 2)
        evid = soluzione and n in d["conteggi"]
        _casella(c, x, y, cw, ch, fill=GRIGIO if evid else None, raggio=4)
        c.setFillColor(black)
        c.setFont(FONT_B, 11)
        c.drawString(x + 7, y + 5, str(n))
        c.setFont(FONT, 11)
        c.drawString(x + 30, y + 5, nome)
    yb = y0 + h - 18 - 7 * (ch + 2) - 20
    c.setFont(FONT_I, 9.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, yb + 8, "Per ogni risultato cerca il personaggio con quel numero e scrivi l'INIZIALE del suo nome.")
    n = len(d["parola"])
    c.setFont(FONT, 9.5)
    c.setFillColor(black)
    for k in range(n):
        xx = x0 + 6 + k * 72
        c.drawString(xx, yb - 12, f"{k + 1})")
        _casella(c, xx + 12, yb - 17, 22, 20, d["conteggi"][k] if soluzione else None, size=10)
        c.setFont(FONT_B, 10)
        c.drawString(xx + 36, yb - 12, "→")
        _casella(c, xx + 46, yb - 17, 20, 20, d["parola"][k] if soluzione else None, size=12)
        c.setFont(FONT, 9.5)


BLOCCHI = {
    "tabella_a1": blocco_tabella_a1,
    "tracciato": blocco_tracciato,
    "griglia_esagonale": blocco_griglia_esagonale,
    "carte": blocco_carte,
    "classifica": blocco_classifica,
    "personaggi": blocco_personaggi,
}


def disegna_pagina(c, box, d, soluzione):
    x0, y0, w, h = box
    h_pl = ALTEZZA_PLANCIA
    disegna_plancia(c, (x0, y0 + h - h_pl, w, h_pl), d, soluzione)
    BLOCCHI[d["metodo"]](c, (x0, y0, w, h - h_pl - 10), d, soluzione)


# --------------------------------------------------------------------------- dati dei metodi
def dati_tracciato(conteggi, parola, rng):
    lettere = {}
    for n, ch in zip(conteggi, parola):
        assert lettere.setdefault(n, ch) == ch
    for n in range(1, 22):
        if n not in lettere:
            lettere[n] = rng.choice([ch for ch in ALFABETO if ch not in set(parola) or rng.random() < 0.3])
    return lettere


def dati_griglia(conteggi, parola, rng):
    griglia = [[rng.choice(ALFABETO) for _ in range(21)] for _ in parola]
    for riga, (n, ch) in enumerate(zip(conteggi, parola)):
        griglia[riga][n - 1] = ch
    return griglia


def dati_carte(conteggi, parola, rng):
    carte = []
    for n, ch in zip(conteggi, parola):
        numeri = [x for x in (n - 2, n - 1, n + 1, n + 2) if 1 <= x <= 21]
        rng.shuffle(numeri)
        lettere = [x for x in ALFABETO if x != ch]
        rng.shuffle(lettere)
        opzioni = [(n, ch), (numeri[0], lettere[0]), (numeri[1], lettere[1])]
        opzioni.sort()
        carte.append(opzioni)
    return carte


def dati_classifica(conteggi, parola, rng):
    somma = sum(conteggi)
    scarti = [-9, -5, -3, -1, 1, 2, 4, 7]
    rng.shuffle(scarti)
    totali = [somma] + [somma + s for s in scarti[:6]]
    esche = [p for p in PAROLE_ESCA if p != parola]
    rng.shuffle(esche)
    righe = [(somma, parola)] + list(zip(totali[1:], esche))
    righe.sort()
    return righe


def dati_personaggi(conteggi, parola, rng):
    """21 personaggi numerati in ordine mescolato; quelli dei numeri chiesti hanno l'iniziale giusta."""
    nomi = {}
    usati = set()
    for n, ch in zip(conteggi, parola):
        if n in nomi:
            assert nomi[n][0] == ch
            continue
        scelte = [x for x in PERSONAGGI[ch] if x not in usati]
        nome = rng.choice(scelte)
        nomi[n] = nome
        usati.add(nome)
    liberi = [x for nn in PERSONAGGI.values() for x in nn if x not in usati]
    rng.shuffle(liberi)
    for n in range(1, 22):
        if n not in nomi:
            nomi[n] = liberi.pop()
    return dict(sorted(nomi.items()))


CONSEGNA = (
    "La partita è rimasta a metà! Conta i pezzi sulla plancia e scrivi ogni risultato nella casella della sua "
    "domanda. {metodo}"
)
ISTRUZIONI = {
    "tabella_a1": "Poi trasforma i numeri in lettere con la tabella A=1, B=2... e leggi la parola.",
    "tracciato": "Poi, sul tracciato del punteggio, la casella con il tuo numero ha la tua lettera: leggile in ordine.",
    "griglia_esagonale": "Poi, nella griglia esagonale, la riga è la domanda e il risultato è la colonna: leggi le lettere.",
    "carte": "Poi, per ogni domanda, scegli la carta con il tuo numero: leggi le lettere in ordine.",
    "classifica": "Poi somma tutti i risultati e cerca il totale in classifica: accanto c'è la parola.",
    "personaggi": "Poi cerca nel mazzo il personaggio con quel numero: la sua iniziale è la lettera.",
}
SPIEGAZIONI = {
    "tabella_a1": "Con A=1, B=2... i numeri {conteggi} diventano le lettere {lettere}: {parola}.",
    "tracciato": "Sul tracciato le caselle {conteggi} contengono le lettere {lettere}: {parola}.",
    "griglia_esagonale": "Nella griglia, riga per riga, il risultato indica la colonna: lettere {lettere} = {parola}.",
    "carte": "Le carte giuste sono {coppie}: le lettere formano {parola}.",
    "classifica": "La somma è {somma} e in classifica a {somma} punti sta la parola {parola}.",
    "personaggi": "I personaggi con questi numeri sono {coppie}: le iniziali formano {parola}.",
}


def enigma_plancia(metodo, parola, seed):
    valida_parola(parola)
    if not 3 <= len(parola) <= 6 or " " in parola:
        raise ValueError("la plancia regge parole di 3-6 lettere (senza spazi)")
    if metodo not in METODI:
        raise ValueError(f"metodo sconosciuto: {metodo}")
    rng = random.Random(seed * 100 + 8)
    conteggi = [ALFABETO.index(ch) + 1 for ch in parola]
    scena = crea_scena(conteggi, rng)
    assert verifica_scena(scena) == conteggi
    d = {"metodo": metodo, "parola": parola, "conteggi": conteggi, "scena": scena}
    r2 = random.Random(seed * 100 + 9)
    coppie = ""
    if metodo == "tracciato":
        d["tracciato"] = dati_tracciato(conteggi, parola, r2)
    elif metodo == "griglia_esagonale":
        d["griglia"] = dati_griglia(conteggi, parola, r2)
    elif metodo == "carte":
        d["carte"] = dati_carte(conteggi, parola, r2)
    elif metodo == "classifica":
        d["classifica"] = dati_classifica(conteggi, parola, r2)
    elif metodo == "personaggi":
        d["personaggi"] = dati_personaggi(conteggi, parola, r2)
        coppie = ", ".join(f"{n} = {d['personaggi'][n]}" for n in conteggi)
    if metodo == "carte":
        coppie = ", ".join(f"{n} = {ch}" for n, ch in zip(conteggi, parola))
    spieg = (
        "Risposte alle sei domande, in ordine: " + ", ".join(map(str, conteggi)) + ". "
        + SPIEGAZIONI[metodo].format(conteggi=", ".join(map(str, conteggi)), lettere=", ".join(parola),
                                     parola=parola, somma=sum(conteggi), coppie=coppie)
    )
    return Enigma(
        titolo="Serata giochi da tavolo",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=CONSEGNA.format(metodo=ISTRUZIONI[metodo]),
        prompt_risposta="Scrivi la parola che hai trovato:",
        risposta=parola,
        spiegazione=spieg,
        disegna=lambda c, box, sol: disegna_pagina(c, box, d, sol),
    ), d
