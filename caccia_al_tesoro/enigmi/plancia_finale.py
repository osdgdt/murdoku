"""Due pagine rifinite: la plancia "Serata giochi da tavolo" (pagina 1) e il mini enigma 10 (pagina 2).

Si rispondono 6 domande, la somma è il PUNTEGGIO FINALE; il mini enigma 10 (Pigpen + Cesare) trasforma
quel numero nella parola. Tutto in scala di grigi.
"""
import math
import random

from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

from . import grafica_tavolo as G
from .alfabeto import ALFABETO, N as N_LETTERE, sposta, valida_parola
from .cifrari import _chiave_griglia, _chiave_x, _simbolo_pigpen, _specifiche_pigpen
from .giochi_tavolo import (INTERVALLI, NOME_MEEPLE, NOME_TERRENO, STILI_MEEPLE, TERRENI, celle_isola,
                            costruisci_scena, trova_rosone, verifica_scena)
from .mini_conversioni import somma_cifre

W, H = A4
ORDINE = ["terreno", "meeple", "dadi", "monete", "carte", "triangoli"]
SOMMA_MIN, SOMMA_MAX = 19, 85
AREA_MONETE = (132.0, 100.0, 7.2)
GR = G.gr


# --------------------------------------------------------------------------- dati
def _intervalli():
    return {
        "terreno": list(range(2, 9)), "meeple": list(range(2, 9)), "dadi": list(range(5, 17)),
        "monete": list(range(4, 22)), "carte": list(range(2, 11)),
        "triangoli": [n for n in range(4, 26) if trova_rosone(n) is not None],
    }


def scegli_conteggi(punteggio, rng):
    """Un conteggio per tipo di domanda, nel proprio intervallo, con somma esatta = punteggio."""
    iv = _intervalli()
    minimi = {t: min(v) for t, v in iv.items()}
    massimi = {t: max(v) for t, v in iv.items()}
    if not SOMMA_MIN <= punteggio <= SOMMA_MAX:
        raise ValueError(f"il punteggio finale deve essere tra {SOMMA_MIN} e {SOMMA_MAX}")

    def rec(i, resto):
        if i == len(ORDINE):
            return [] if resto == 0 else None
        t = ORDINE[i]
        sotto_min = sum(minimi[x] for x in ORDINE[i + 1:])
        sotto_max = sum(massimi[x] for x in ORDINE[i + 1:])
        valori = [v for v in iv[t] if sotto_min <= resto - v <= sotto_max]
        rng.shuffle(valori)
        for v in valori:
            r = rec(i + 1, resto - v)
            if r is not None:
                return [v] + r
        return None

    ris = rec(0, punteggio)
    if ris is None:
        raise ValueError(f"nessuna combinazione di conteggi dà {punteggio}")
    return dict(zip(ORDINE, ris))


def crea_plancia_finale(punteggio, parola, seed):
    valida_parola(parola)
    if not 3 <= len(parola) <= 7 or " " in parola:
        raise ValueError("la parola deve avere 3-7 lettere, senza spazi")
    rng = random.Random(seed * 100 + 8)
    conteggi = scegli_conteggi(punteggio, rng)
    scena = costruisci_scena([(t, conteggi[t]) for t in ORDINE], rng, AREA_MONETE)
    risposte = verifica_scena(scena)
    assert risposte == [conteggi[t] for t in ORDINE]
    s = somma_cifre(punteggio)
    return {
        "punteggio": punteggio, "parola": parola, "conteggi": conteggi, "scena": scena,
        "chiave": s, "pigpen": sposta(parola, s),
    }


# --------------------------------------------------------------------------- pezzi di pagina
def _testata(c, tag, livello, titolo):
    """Cornice, etichetta, stelle di difficoltà e striscione con il titolo."""
    G.cornice_pagina(c, W, H)
    G.pillola(c, 44, 796, 128, 20, tag, 10)
    c.setFillColor(black)
    c.setFont(G.FONT_B, 10.5)
    nome = {1: "FACILE", 2: "MEDIO", 3: "DIFFICILE"}[livello]
    c.drawRightString(W - 44, 802, nome)
    larg = c.stringWidth(nome, G.FONT_B, 10.5)
    for k in range(livello):
        _stella(c, W - 44 - larg - 14 - k * 17, 806, 7)
    G.striscione(c, W / 2, 766, 392, 46, titolo, 27)


def _stella(c, cx, cy, r):
    c.setFillColor(black)
    c.setStrokeColor(black)
    c.setLineWidth(0.6)
    c.drawPath(_percorso_stella(c, cx, cy, r), stroke=1, fill=1)


def _percorso_stella(c, cx, cy, r):
    p = c.beginPath()
    pts = G._stella_pts(cx, cy, r)
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.close()
    return p


def _paragrafo(c, testo, x, y_alto, larghezza, size=10.5, leading=13.6, font=G.FONT):
    c.setFillColor(black)
    c.setFont(font, size)
    y = y_alto
    for riga in testo.split("\n"):
        for parte in simpleSplit(riga, font, size, larghezza) or [""]:
            y -= leading
            c.drawString(x, y, parte)
    return y


def _casella(c, x, y, w, h, testo=None, size=14, fill=1.0, raggio=5, spessore=1.5, grassetto=True):
    c.setFillColor(GR(fill))
    c.setStrokeColor(GR(0.05))
    c.setLineWidth(spessore)
    c.roundRect(x, y, w, h, raggio, stroke=1, fill=1)
    if testo is not None:
        c.setFillColor(black)
        c.setFont(G.FONT_B if grassetto else G.FONT, size)
        c.drawCentredString(x + w / 2, y + h / 2 - size * 0.34, str(testo))
    c.setFillColor(black)


# --------------------------------------------------------------------------- pagina 1: la plancia
def _isola(c, scena, cx, cy, r, soluzione):
    """Disegna medaglione, tessere e meeple. Restituisce le posizioni per l'evidenziazione."""
    R = r * 4.33 + 15
    G.medaglione_mare(c, cx, cy, R)
    centri = {}
    for i, (q, rr) in enumerate(celle_isola()):
        x = cx + r * math.sqrt(3) * (q + rr / 2)
        y = cy - r * 1.5 * rr
        centri[(q, rr)] = (x, y)
        G.disegna_tessera(c, x, y, r * 0.97, scena["mappa"][(q, rr)], seme=i)
    per_cella = {}
    for m in scena["meeple"]:
        per_cella.setdefault(m["cella"], []).append(m["stile"])
    pezzi = []
    for cella, stili in per_cella.items():
        x, y = centri[cella]
        spost = [0] if len(stili) == 1 else [-r * 0.34, r * 0.34]
        for dx, st in zip(spost, stili):
            pezzi.append((y, x + dx, st))
    for y, x, st in sorted(pezzi, key=lambda t: -t[0]):
        G.disegna_meeple_bello(c, x, y - r * 0.44, r * 0.92, st)
    meeple_pos = [(x, y - r * 0.44 + r * 0.46, st) for y, x, st in pezzi]
    return {"centri": centri, "meeple": meeple_pos}


def _legenda(c, x, y, w, h):
    G.cartiglio(c, x, y, w, h, "LEGENDA")
    nomi = [NOME_TERRENO[t].capitalize() for t in TERRENI]
    passo = (w - 24) / 5
    for i, t in enumerate(TERRENI):
        cx = x + 12 + (i + 0.5) * passo
        G.disegna_tessera(c, cx, y + h - 30, 10.5, t, seme=i)
        c.setFillColor(black)
        c.setFont(G.FONT, 6.8)
        c.drawCentredString(cx, y + h - 49, nomi[i])
    passo = (w - 20) / 4
    for i, st in enumerate(STILI_MEEPLE):
        sx = x + 10 + i * passo
        G.disegna_meeple_bello(c, sx + 8, y + 8, 18, st)
        c.setFillColor(black)
        c.setFont(G.FONT, 6.4)
        c.drawString(sx + 19, y + 13, NOME_MEEPLE[st].capitalize())


def _scheda(c, scena, x, y, w, h, soluzione):
    G.cartiglio(c, x, y, w, h, "LA SCHEDA DEL PUNTEGGIO")
    n = len(scena["domande"])
    riga_h = (h - 28) / n
    for i, d in enumerate(scena["domande"]):
        yr = y + h - 24 - (i + 1) * riga_h
        if i:
            c.setStrokeColor(GR(0.7))
            c.setLineWidth(0.5)
            c.setDash(2, 2)
            c.line(x + 12, yr + riga_h, x + w - 12, yr + riga_h)
            c.setDash()
        cy = yr + riga_h / 2
        G.icona_tipo(c, d["tipo"], x + 24, cy, 11.5, terreno=scena["terreno_chiesto"] or "foresta",
                     stile=scena["stile_chiesto"] or "nero")
        c.setFillColor(black)
        c.setFont(G.FONT_B, 8)
        c.drawString(x + 40, cy + 4, f"{i + 1}")
        righe = simpleSplit(d["testo"], G.FONT, 8.2, w - 40 - 58 - 12)
        c.setFont(G.FONT, 8.2)
        base = cy + (len(righe) - 1) * 4.6 - 3
        for k, riga in enumerate(righe[:2]):
            c.drawString(x + 49, base - k * 9.2, riga)
        _casella(c, x + w - 54, cy - 11, 42, 22, d["n"] if soluzione else None, size=13, spessore=1.4)


def _vassoio(c, scena, x, y, w, h, soluzione):
    G.panno(c, x, y, w, h)
    # separatori
    larghezze = [84, 150, 176]
    xs = [x + 6]
    for lw in larghezze:
        xs.append(xs[-1] + lw)
    c.setStrokeColor(white)
    c.setStrokeAlpha(0.8)
    c.setLineWidth(1.0)
    c.setDash(3, 3)
    for xx in xs[1:]:
        c.line(xx, y + 10, xx, y + h - 10)
    c.setDash()
    c.setStrokeAlpha(1)
    etichette = ["DADI", "MONETE", "CARTE", "ROSONE"]
    xs.append(xs[-1] + 90)
    for xx, nome in zip(xs, etichette):
        G.pillola(c, xx + 6, y + h - 9, c.stringWidth(nome, G.FONT_B, 8) + 16, 15, nome, 8)
    # dadi
    angoli = [-11, 9, -4]
    pos = [(xs[0] + 24, y + h - 48), (xs[0] + 58, y + h - 62), (xs[0] + 36, y + h - 98)]
    for (dx, dy), v, a in zip(pos, scena["dadi"], angoli):
        G.disegna_dado_bello(c, dx, dy, 31, v, a)
    if soluzione:
        c.setFillColor(black)
        c.setFont(G.FONT_B, 8)
        c.drawCentredString(xs[0] + 42, y + 8, " + ".join(map(str, scena["dadi"])) + f" = {sum(scena['dadi'])}")
    # monete
    ox, oy = xs[1] + 8, y + 8
    for i, (px, py) in enumerate(scena["monete"]):
        G.disegna_moneta_bella(c, ox + px, oy + py, AREA_MONETE[2])
        if soluzione:
            G.badge_numero(c, ox + px + 5.5, oy + py + 6, i + 1, r=5.6)
    # carte
    cw, ch = 23, 32
    stelle = 0
    carte_pos = []
    n_carte = len(scena["carte"])
    per_riga = (n_carte + 1) // 2
    x_c0 = xs[2] + 14 + (7 - per_riga) * 12.1
    for i, simb in enumerate(scena["carte"]):
        r, col = divmod(i, per_riga)
        cx = x_c0 + 8 + col * 24.2 + (r % 2) * 6
        cy = y + h - 46 - r * 40
        G.disegna_carta_bella(c, cx, cy, cw, ch, ((i * 29) % 13) - 6, simb)
        if simb == "stella":
            stelle += 1
            carte_pos.append((cx, cy, stelle))
    # rosone
    G.disegna_rosone_bello(c, xs[3] + 41, y + h / 2 - 6, 33, scena["rosone"])
    if soluzione:
        c.setFillColor(black)
        c.setFont(G.FONT_B, 8)
        c.drawCentredString(xs[3] + 41, y + 8, f"{[d['n'] for d in scena['domande'] if d['tipo'] == 'triangoli'][0]} triangoli")
    return {"carte": carte_pos}


def _evidenzia(c, scena, isola, r, vassoio):
    """Pagina delle soluzioni: cerchia gli elementi contati, con un numero d'ordine."""
    k = 0
    for cella, (x, y) in isola["centri"].items():
        if scena["mappa"][cella] == scena["terreno_chiesto"]:
            k += 1
            G.anello_numerato(c, x, y, r * 0.93, k)
    k = 0
    for x, y, st in isola["meeple"]:
        if st == scena["stile_chiesto"]:
            k += 1
            G.anello_numerato(c, x, y, r * 0.62, k)
    for cx, cy, n in vassoio["carte"]:
        G.anello_numerato(c, cx, cy, 19, n)


def _fascia_punteggio(c, d, x, y, w, h, soluzione):
    c.setFillColor(GR(0.5))
    c.setFillAlpha(0.25)
    c.roundRect(x + 2.5, y - 3, w, h, 14, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(GR(0.1))
    c.setStrokeColor(black)
    c.setLineWidth(1.5)
    c.roundRect(x, y, w, h, 14, stroke=1, fill=1)
    c.setStrokeColor(white)
    c.setStrokeAlpha(0.6)
    c.setLineWidth(0.8)
    c.roundRect(x + 4, y + 4, w - 8, h - 8, 11, stroke=1, fill=0)
    c.setStrokeAlpha(1)
    c.setFillColor(white)
    c.setFont(G.TITOLO_FONT, 19)
    c.drawString(x + 20, y + h - 30, "PUNTEGGIO FINALE")
    c.setFont(G.FONT, 9)
    for k, riga in enumerate(("Somma le sei risposte della scheda:", "il totale è il tuo punteggio.", "Ti serve per il mini enigma 10!")):
        c.drawString(x + 20, y + h - 47 - k * 11.5, riga)
    # sei caselle + '=' + grande
    bx = x + 196
    by = y + h / 2 - 12
    for i, t in enumerate(ORDINE):
        _casella(c, bx + i * 38, by, 28, 24, d["conteggi"][t] if soluzione else None, size=11, spessore=1.2)
        c.setFillColor(white)
        c.setFont(G.FONT_B, 13)
        c.drawCentredString(bx + i * 38 + 33, by + 6.5, "+" if i < 5 else "=")
    _casella(c, bx + 6 * 38 + 4, y + h / 2 - 24, 52, 48, d["punteggio"] if soluzione else None, size=24, raggio=8, spessore=2.2)


def pagina_plancia(c, d, soluzione=False):
    scena = d["scena"]
    c.setTitle("Serata giochi da tavolo")
    _testata(c, "ENIGMA N° 8", 2, "SERATA GIOCHI DA TAVOLO")
    # consegna
    G.cartiglio(c, 44, 662, W - 88, 66)
    _paragrafo(c, "La partita è rimasta a metà! Conta i pezzi sulla plancia e rispondi alle sei domande della scheda: "
                  "scrivi ogni risultato nella sua casella. Poi SOMMA le sei risposte: il totale è il tuo PUNTEGGIO FINALE, "
                  "il numero da portare al mini enigma 10 per scoprire la parola segreta."
               if not soluzione else
               "SOLUZIONE (riservata all'organizzatore). Gli elementi contati sono cerchiati e numerati; sotto ai dadi, "
               "alle monete e al rosone trovi il conteggio. La somma delle sei risposte è il punteggio finale.",
               58, 726, W - 116, size=10.2, leading=13.4)
    r = 31.0
    cx, cy = 44 + r * 4.33 + 17, 650 - (r * 4.33 + 15) - 2
    isola = _isola(c, scena, cx, cy, r, soluzione)
    xr = cx + r * 4.33 + 15 + 12
    wr = W - 44 - xr
    y_isola_alto = cy + r * 4.33 + 15
    _legenda(c, xr, y_isola_alto - 78, wr, 78)
    _scheda(c, scena, xr, cy - (r * 4.33 + 15), wr, (y_isola_alto - 78) - 10 - (cy - (r * 4.33 + 15)), soluzione)
    y_vass = cy - (r * 4.33 + 15) - 14 - 138
    vass = _vassoio(c, scena, 44, y_vass, W - 88, 138, soluzione)
    if soluzione:
        _evidenzia(c, scena, isola, r, vass)
    _fascia_punteggio(c, d, 44, y_vass - 14 - 92, W - 88, 92, soluzione)
    c.setFillColor(GR(0.35))
    c.setFont(G.FONT_I, 8.5)
    c.drawCentredString(W / 2, 40, "Segui la freccia: il punteggio finale ti aspetta nel mini enigma 10  >>")
    c.showPage()


# --------------------------------------------------------------------------- pagina 2: mini enigma 10
def _striscia_alfabeto(c, x, y, w, evid=None, grigi=None):
    cw = w / N_LETTERE
    for i, ch in enumerate(ALFABETO):
        nero = evid is not None and i == evid
        c.setFillColor(black if nero else GR(0.62 if (grigi is not None and i == grigi) else (0.92 if i % 2 == 0 else 0.8)))
        c.setStrokeColor(GR(0.05))
        c.setLineWidth(1.0)
        c.rect(x + i * cw, y, cw, 28, stroke=1, fill=1)
        c.setFillColor(white if nero else black)
        c.setFont(G.FONT_B, 12)
        c.drawCentredString(x + (i + 0.5) * cw, y + 13, ch)
        c.setFillColor(white if nero else GR(0.3))
        c.setFont(G.FONT, 6.5)
        c.drawCentredString(x + (i + 0.5) * cw, y + 4, str(i + 1))
    c.setFillColor(black)


def _freccia_arco(c, x1, x2, y, alt, testo):
    """Arco con punta di freccia da x1 a x2, SOTTO la striscia (y = bordo basso della striscia)."""
    c.setStrokeColor(black)
    c.setLineWidth(1.8)
    p = c.beginPath()
    p.moveTo(x1, y)
    p.curveTo(x1, y - alt, x2, y - alt, x2, y - 4)
    c.drawPath(p, stroke=1, fill=0)
    c.setFillColor(black)
    q = c.beginPath()
    q.moveTo(x2, y)
    q.lineTo(x2 - 4.5, y - 8)
    q.lineTo(x2 + 4.5, y - 8)
    q.close()
    c.drawPath(q, stroke=0, fill=1)
    pill_w = c.stringWidth(testo, G.FONT_B, 9) + 12
    G.pillola(c, (x1 + x2) / 2 - pill_w / 2, y - alt * 0.75 - 7, pill_w, 14, testo, 9)


def pagina_mini10(c, d, soluzione=False):
    parola, pig, s = d["parola"], d["pigpen"], d["chiave"]
    n = len(parola)
    spec = _specifiche_pigpen()
    c.setTitle("Il codice del tesoro")
    _testata(c, "MINI ENIGMA N° 10", 3, "IL CODICE DEL TESORO")
    G.cartiglio(c, 44, 646, W - 88, 82)
    _paragrafo(c, "Due cifrari in uno. PASSO 1: somma le cifre del tuo punteggio finale: è la CHIAVE. PASSO 2: traduci "
                  "ogni simbolo con la chiave Pigpen (attenzione ai puntini!). PASSO 3: le lettere che ottieni sono "
                  "state spostate AVANTI di CHIAVE posti nell'alfabeto: torna INDIETRO di tanti posti, lettera per "
                  "lettera, e leggi la parola." if not soluzione else
               f"SOLUZIONE (riservata all'organizzatore). Punteggio {d['punteggio']}: le cifre sommano {s}. I simboli dicono "
               f"{pig}; tornando indietro di {s} posti nell'alfabeto si legge {parola}.",
               58, 724, W - 116, size=10.2, leading=13.4)

    # PASSO 1
    y1 = 556
    G.cartiglio(c, 44, y1, W - 88, 80, "PASSO 1 · LA CHIAVE")
    ds = [int(ch) for ch in str(d["punteggio"])]
    x = 64
    c.setFillColor(black)
    c.setFont(G.FONT_B, 10)
    c.drawString(x, y1 + 30, "Il tuo punteggio finale")
    _casella(c, x + 124, y1 + 18, 64, 38, d["punteggio"] if soluzione else None, size=22, raggio=7, spessore=2)
    c.setFont(G.FONT_B, 10)
    c.drawString(x + 206, y1 + 30, "le sue cifre")
    for k in range(2):
        _casella(c, x + 276 + k * 50, y1 + 22, 34, 30, ds[k] if (soluzione and k < len(ds)) else None, size=17)
        if k == 0:
            c.setFont(G.FONT_B, 16)
            c.drawCentredString(x + 276 + 42, y1 + 31, "+")
    c.setFont(G.FONT_B, 16)
    c.drawCentredString(x + 276 + 100 + 10, y1 + 31, "=")
    c.setFont(G.FONT_B, 10)
    c.drawString(x + 400, y1 + 40, "CHIAVE")
    _casella(c, x + 400, y1 + 14, 54, 22, s if soluzione else None, size=16, raggio=7, spessore=2.2, fill=0.85)

    # PASSO 2
    y2 = 332
    G.cartiglio(c, 44, y2, W - 88, 214, "PASSO 2 · TRADUCI I SIMBOLI")
    lato = 64
    gx = 64
    gy = y2 + 214 - 36 - lato
    G.panno(c, gx - 10, gy - 10, 3 * lato + 2 * 20 + 20, lato + 20, raggio=8)
    _chiave_griglia(c, gx, gy, lato, False, ALFABETO[:9])
    _chiave_griglia(c, gx + lato + 20, gy, lato, True, ALFABETO[9:18])
    _chiave_x(c, gx + 2 * (lato + 20), gy, lato, {"su": ALFABETO[18], "sinistra": ALFABETO[19], "destra": ALFABETO[20]})
    c.setFillColor(black)
    c.setFont(G.FONT_I, 9)
    for k, riga in enumerate(("Il simbolo di ogni lettera", "è formato dalle linee del", "suo 'recinto' nella chiave", "(e dal puntino, se c'è).")):
        c.drawString(gx + 3 * lato + 60, gy + lato - 14 - k * 12, riga)
    # gettoni con i simboli
    passo = min(66, (W - 88 - 40) / n)
    x_inizio = W / 2 - (n - 1) * passo / 2
    yt = y2 + 72
    for i, ch in enumerate(pig):
        xx = x_inizio + i * passo
        G.gettone_esagonale(c, xx, yt, 25)
        _simbolo_pigpen(c, spec[ch], xx, yt, 27)
        _casella(c, xx - 15, y2 + 12, 30, 30, ch if soluzione else None, size=17, spessore=1.5)
    c.setFillColor(black)
    c.setFont(G.FONT_B, 8)
    c.drawString(60, y2 + 20, "LETTERA")
    c.drawString(60, y2 + 10, "PIGPEN")

    # PASSO 3
    y3 = 144
    G.cartiglio(c, 44, y3, W - 88, 178, "PASSO 3 · TORNA INDIETRO")
    sx = 59
    sw = W - 118
    ys = y3 + 120
    cw = sw / N_LETTERE
    # esempio con chiave 3: F -> C
    _striscia_alfabeto(c, sx, ys, sw, evid=ALFABETO.index("F"), grigi=ALFABETO.index("C"))
    _freccia_arco(c, sx + (ALFABETO.index("F") + 0.5) * cw, sx + (ALFABETO.index("C") + 0.5) * cw, ys, 30, "- 3")
    c.setFillColor(black)
    c.setFont(G.FONT_I, 9)
    c.drawString(sx + 150, ys - 20, "Esempio con chiave 3: la F torna indietro di 3 posti e diventa C.")
    c.drawString(sx + 150, ys - 31, "Dopo la A si ricomincia dalla Z.")
    # righe di lavoro
    c.setFont(G.FONT_B, 8)
    c.drawString(60, y3 + 38, "LETTERA")
    c.drawString(60, y3 + 28, "VERA")
    for i in range(n):
        xx = x_inizio + i * passo
        _casella(c, xx - 17, y3 + 16, 34, 38, parola[i] if soluzione else None, size=21, raggio=6, spessore=1.8, fill=0.85)
    # LA PAROLA
    yp = 62
    G.cartiglio(c, 44, yp, W - 88, 70, fill=0.92)
    c.setFillColor(black)
    c.setFont(G.TITOLO_FONT, 19)
    c.drawString(62, yp + 28, "LA PAROLA")
    lat = 36
    gap = 7
    x0 = W - 62 - n * (lat + gap) + gap
    x0 = max(x0, 200)
    for i in range(n):
        _casella(c, x0 + i * (lat + gap), yp + 17, lat, lat, parola[i] if soluzione else None, size=22, raggio=6, spessore=2.0)
    c.showPage()
