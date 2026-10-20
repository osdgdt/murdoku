"""Pagina singola del labirinto (versione facile) con la parola nascosta sul percorso e un riquadro «REPERTO» sotto.

Senza numero d'enigma e senza difficoltà. Pagina dei giocatori e pagina con la soluzione (percorso in grigio, lettere e
parola scritte); il riquadro del reperto c'è in entrambe.
"""
import random

from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

from . import grafica_tavolo as G
from .alfabeto import valida_parola
from .visivi import crea_labirinto, disegna_labirinto, lettere_sul_percorso

W, H = A4
GR = G.gr
X, WB = 44, W - 88
LATO_MAX = 34


def crea_pagina_labirinto(parola, seme, w=12, h=12, esche=16):
    """Dati della pagina: labirinto 12x12 con le lettere della parola (spazi esclusi) lungo l'unica strada."""
    valida_parola(parola)
    lettere = parola.replace(" ", "")
    if not 3 <= len(lettere) <= 14:
        raise ValueError("la parola (spazi esclusi) deve avere da 3 a 14 lettere")
    rng = random.Random(seme * 100 + 5)
    d = crea_labirinto(w, h, lettere, esche, rng)
    assert len(d["percorso"]) - 2 >= len(lettere), "il percorso è troppo corto per la parola"
    assert lettere_sul_percorso(d) == lettere
    d["parola_con_spazi"] = parola
    return d


def _paragrafo(c, testo, x, y_alto, larghezza, size=10.2, leading=13.4, font=G.FONT):
    c.setFillColor(black)
    c.setFont(font, size)
    y = y_alto
    for riga in simpleSplit(testo, font, size, larghezza):
        c.drawString(x, y - size, riga)
        y -= leading
    return y_alto - y


def _riquadro_parola(c, y_alto, parola, soluzione):
    """'LA PAROLA' con una casellina per lettera, i gruppi separati dagli spazi della frase."""
    h = 64
    y = y_alto - h
    G.cartiglio(c, X, y, WB, h, "LA PAROLA", fill=0.93)
    gruppi = parola.split(" ")
    n = sum(len(g) for g in gruppi)
    gap_g = 22
    lat = min(LATO_MAX, (WB - 40 - (len(gruppi) - 1) * gap_g - (n - len(gruppi)) * 4) / n)
    tot = n * lat + (n - len(gruppi)) * 4 + (len(gruppi) - 1) * gap_g
    x = X + (WB - tot) / 2
    for gi, g in enumerate(gruppi):
        for ch in g:
            c.setFillColor(white)
            c.setStrokeColor(black)
            c.setLineWidth(1.9)
            c.roundRect(x, y + 12, lat, lat * 1.1, 5, stroke=1, fill=1)
            if soluzione:
                c.setFillColor(black)
                c.setFont(G.FONT_B, lat * 0.62)
                c.drawCentredString(x + lat / 2, y + 12 + lat * 0.33, ch)
            x += lat + 4
        x += gap_g - 4
    return h


def _lente(c, cx, cy, r):
    c.setStrokeColor(GR(0.08))
    c.setLineWidth(3.2)
    c.setLineCap(1)
    c.line(cx + r * 0.72, cy - r * 0.72, cx + r * 1.7, cy - r * 1.7)
    c.setLineCap(0)
    c.setFillColor(white)
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setStrokeColor(GR(0.5))
    c.setLineWidth(1.0)
    c.arc(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7, 100, 60)


def _riquadro_reperto(c, y_alto, reperto):
    h = 62
    y = y_alto - h
    G.cartiglio(c, X, y, WB, h, "REPERTO")
    _lente(c, X + 46, y + 25, 12)
    c.setFillColor(GR(0.25))
    c.setFont(G.FONT_I, 12)
    c.drawString(X + 86, y + 22, "Il reperto è:")
    size = 28
    while c.stringWidth(reperto, G.TITOLO_FONT, size) > WB - 86 - 120 - 20 and size > 12:
        size -= 1
    c.setFillColor(black)
    c.setFont(G.TITOLO_FONT, size)
    c.drawString(X + 86 + 92, y + 20, reperto.upper())
    return h


def pagina_labirinto(c, d, reperto, soluzione=False):
    G.cornice_pagina(c, W, H)
    G.striscione(c, W / 2, 780, 320, 44, "IL LABIRINTO", 26)
    parola = d["parola_con_spazi"]
    n = len(d["parola"])
    if soluzione:
        testo = (f"SOLUZIONE (riservata all'organizzatore). La strada giusta è in grigio: le {n} lettere che incontri, "
                 f"nell'ordine, sono {d['parola']} e si leggono {parola}.")
    else:
        testo = (f"Trova la strada dall'ENTRATA all'USCITA senza attraversare i muri. Lungo la strada giusta passerai sopra "
                 f"{n} lettere: leggile nell'ordine in cui le incontri e formeranno {'una frase' if ' ' in parola else 'una parola'}. "
                 "Attenzione: ci sono anche lettere trappola nei vicoli ciechi!")
    alto = 738
    usato = _paragrafo(c, testo, X + 6, alto, WB - 12)
    y = alto - usato - 8
    h_par, h_rep, gap = 64, 62, 12
    h_lab = y - 58 - h_par - h_rep - 2 * gap
    G.cartiglio(c, X, y - h_lab, WB, h_lab, fill=0.985)
    disegna_labirinto(c, (X + 6, y - h_lab, WB - 12, h_lab), d, soluzione)
    y -= h_lab + gap
    y -= _riquadro_parola(c, y, parola, soluzione) + gap
    _riquadro_reperto(c, y, reperto)
    c.showPage()


def scrivi_labirinto(d, reperto, percorso, soluzione):
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle("Il labirinto" + (" - Soluzione" if soluzione else ""))
    c.setAuthor("Caccia al tesoro")
    pagina_labirinto(c, d, reperto, soluzione)
    c.save()
    return 1
