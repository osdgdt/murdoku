#!/usr/bin/env python3
"""Schema che mostra come si ottengono parole da 12 lettere prendendo UNA lettera da ciascuna di 12 frasi (ordine libero).

Uso:  python genera_schema_parole.py [parola ...]      (default: ritrovamento ricompensato ricompensare)
Scrive schema_parole_finali.pdf (una pagina): tabella frase per frase e, sotto, la lettura di ogni parola.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from enigmi import grafica_tavolo as G

W, H = A4
GR = G.gr
FRASI = ["presidente", "poliziotto", "ascensore", "prestiti", "colpevole", "dell'oca", "parcheggio",
         "ricrescita dei capelli", "metabolismo", "altezza", "vita", "eterna giovinezza"]
PAROLE = ["ritrovamento", "ricompensato", "ricompensare"]
QUI = os.path.dirname(os.path.abspath(__file__))


def assegna(parola, frasi=FRASI):
    """Abbinamento lettere -> frasi (una lettera per frase). Restituisce match[frase] = posto nella parola (0-based)."""
    insiemi = [set(ch for ch in f if ch.isalpha()) for f in frasi]
    n = len(frasi)
    if len(parola) != n:
        raise ValueError(f"'{parola}' deve avere {n} lettere")
    match = [-1] * n

    def prova(i, visti):
        for j in range(n):
            if parola[i] in insiemi[j] and j not in visti:
                visti.add(j)
                if match[j] == -1 or prova(match[j], visti):
                    match[j] = i
                    return True
        return False

    for i in range(n):
        if not prova(i, set()):
            raise ValueError(f"'{parola}' non si può formare con una lettera per frase")
    return match


def _scatola(c, x, y, w, h, testo, size, fill=1.0):
    c.setFillColor(GR(fill))
    c.setStrokeColor(GR(0.05))
    c.setLineWidth(1.4)
    c.roundRect(x, y, w, h, 5, stroke=1, fill=1)
    c.setFillColor(black)
    c.setFont(G.FONT_B, size)
    c.drawCentredString(x + w / 2, y + h / 2 - size * 0.34, testo)


def pagina_schema(c, parole, frasi=FRASI):
    n = len(frasi)
    match = {p: assegna(p, frasi) for p in parole}
    G.cornice_pagina(c, W, H)
    G.striscione(c, W / 2, 782, 420, 44, "COME SI TROVANO LE PAROLE", 24)
    c.setFillColor(GR(0.25))
    c.setFont(G.FONT_I, 9.5)
    c.drawCentredString(W / 2, 748, "Da ogni frase si prende UNA lettera: le 12 lettere, rimesse in ordine, formano la parola.")

    # --- tabella frase per frase
    x0, wb = 44, W - 88
    colf, colp = 168, (wb - 168 - 30) / len(parole)
    rh = 21
    ytop = 732
    h_tab = 30 + n * rh + 28
    G.cartiglio(c, x0, ytop - h_tab, wb, h_tab, "FRASE PER FRASE")
    yh = ytop - 38
    c.setFillColor(black)
    c.setFont(G.FONT_B, 9)
    c.drawString(x0 + 18, yh, "FRASE")
    for k, p in enumerate(parole):
        c.drawCentredString(x0 + 18 + colf + k * colp + colp / 2, yh, p.upper())
    for j, f in enumerate(frasi):
        yy = yh - 8 - (j + 1) * rh + 5
        if j % 2 == 0:
            c.setFillColor(GR(0.92))
            c.rect(x0 + 10, yy - 5, wb - 20, rh, stroke=0, fill=1)
        c.setFillColor(black)
        c.setFont(G.FONT_B, 9)
        c.drawString(x0 + 16, yy + 1, f"{j + 1}")
        c.setFont(G.FONT, 10)
        c.drawString(x0 + 32, yy + 1, f)
        for k, p in enumerate(parole):
            i = match[p][j]
            cx = x0 + 18 + colf + k * colp + colp / 2
            _scatola(c, cx - 11, yy - 4, 22, 17, p[i].upper(), 11)
            c.setFillColor(GR(0.35))
            c.setFont(G.FONT, 7.5)
            c.drawString(cx + 14, yy + 3, f"({i + 1}°)")
    # --- lettura di ogni parola
    y = ytop - h_tab - 18
    for p in parole:
        h_blocco = 94
        G.cartiglio(c, x0, y - h_blocco, wb, h_blocco, f"LETTURA · {p.upper()}")
        lato = min(32, (wb - 40) / n - 4)
        passo = (wb - 40) / n
        daf = {match[p][j]: j for j in range(n)}
        for i, ch in enumerate(p):
            xx = x0 + 20 + i * passo + (passo - lato) / 2
            _scatola(c, xx, y - 68, lato, lato * 1.1, ch.upper(), 17, fill=0.93)
            c.setFillColor(GR(0.3))
            c.setFont(G.FONT, 6.8)
            c.drawCentredString(xx + lato / 2, y - 68 + lato * 1.1 + 3, f"{i + 1}°")
            c.setFillColor(black)
            c.setFont(G.FONT_B, 7.5)
            c.drawCentredString(xx + lato / 2, y - 80, f"frase {daf[i] + 1}")
        y -= h_blocco + 10
    c.setFillColor(GR(0.3))
    c.setFont(G.FONT, 7.8)
    c.drawCentredString(W / 2, 36, "Altre scelte sono possibili (la stessa lettera può spesso venire da frasi diverse): questo è uno schema valido.")
    c.showPage()


def scrivi(parole, percorso, frasi=FRASI):
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle("Come si trovano le parole")
    c.setAuthor("Caccia al tesoro")
    pagina_schema(c, parole, frasi)
    c.save()
    return 1


def main():
    parole = [p.lower() for p in sys.argv[1:]] or PAROLE
    f = os.path.join(QUI, "schema_parole_finali.pdf")
    scrivi(parole, f)
    print(f"Schema per: {', '.join(p.upper() for p in parole)}\n  {f}")


if __name__ == "__main__":
    main()
