#!/usr/bin/env python3
"""Genera i 10 mini enigmi che trasformano un numero in una parola.

Uso:  python genera_mini.py [numero] [parola]      (default: 43 MEEPLE)
Scrive mini_enigmi.pdf (per i giocatori) e mini_enigmi_soluzioni.pdf (con numero, parola e spiegazioni).
Il numero deve essere tra 1 e 99, la parola di 3-7 lettere dell'alfabeto italiano (niente J, K, W, X, Y).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from enigmi.impagina import FONT, FONT_B, FONT_I, GRIGIO, GRIGIO_SCURO, H, MARGINE, W, a_capo, stella
from enigmi.mini_conversioni import crea_mini

QUI = os.path.dirname(os.path.abspath(__file__))
H_BLOCCO = 358
NOMI_LIVELLO = {1: "FACILE", 2: "MEDIO", 3: "DIFFICILE"}


def blocco(c, y_alto, numero_mini, mini, numero, parola, soluzione):
    x, w = MARGINE, W - 2 * MARGINE
    y_basso = y_alto - H_BLOCCO
    # intestazione
    c.setFillColor(black)
    c.roundRect(x, y_alto - 22, 128, 22, 6, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont(FONT_B, 11.5)
    c.drawString(x + 10, y_alto - 15.5, f"MINI ENIGMA N° {numero_mini}")
    c.setFillColor(black)
    c.setFont(FONT_B, 15)
    c.drawString(x + 140, y_alto - 17, mini.titolo)
    nome = NOMI_LIVELLO[mini.livello]
    c.setFont(FONT_B, 10)
    c.drawRightString(x + w, y_alto - 16, nome)
    larg = c.stringWidth(nome, FONT_B, 10)
    for k in range(mini.livello):
        stella(c, x + w - larg - 14 - k * 16, y_alto - 11.5, 6.5, pieno=True)
    # consegna
    y_fine = a_capo(c, mini.consegna, x, y_alto - 24, w, size=10.5, leading=13.5)
    # disegno
    y_dis = y_basso + 62
    mini.disegna(c, (x, y_dis, w, y_fine - 6 - y_dis), soluzione)
    # parola
    c.setFillColor(black)
    c.setFont(FONT_B, 11)
    c.drawString(x, y_basso + 40, "LA PAROLA:")
    lato = 24
    for k in range(len(parola)):
        c.setLineWidth(1.6)
        c.setStrokeColor(black)
        c.setFillColor(white)
        c.rect(x + 82 + k * (lato + 3), y_basso + 32, lato, lato, stroke=1, fill=1)
        if soluzione:
            c.setFillColor(black)
            c.setFont(FONT_B, 16)
            c.drawCentredString(x + 82 + k * (lato + 3) + lato / 2, y_basso + 38, parola[k])
    if soluzione:
        c.setFillColor(GRIGIO_SCURO)
        c.setFont(FONT_I, 9)
        yy = y_basso + 20
        for riga in simpleSplit(mini.spiegazione, FONT_I, 9, w) [:3]:
            c.drawString(x, yy, riga)
            yy -= 10.5
    c.setFillColor(black)


def scrivi(minis, percorso, numero, parola, soluzione):
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle("Mini enigmi di conversione" + (" - Soluzioni" if soluzione else ""))
    pagine = (len(minis) + 1) // 2
    for p in range(pagine):
        c.setFillColor(black)
        c.setFont(FONT_B, 16)
        c.drawString(MARGINE, H - 46, "MINI ENIGMI DI CONVERSIONE: DAL NUMERO ALLA PAROLA")
        c.setFont(FONT, 9.5)
        c.setFillColor(GRIGIO_SCURO)
        if soluzione:
            c.drawString(MARGINE, H - 60, f"SOLUZIONI (riservate all'organizzatore): esempio con il numero {numero} e la parola {parola}.")
        else:
            c.drawString(MARGINE, H - 60, "Il numero è la soluzione dell'enigma principale: ogni mini enigma lo trasforma in una parola.")
        c.setStrokeColor(black)
        c.setLineWidth(1.5)
        c.line(MARGINE, H - 66, W - MARGINE, H - 66)
        y = H - 74
        for k in range(2):
            i = p * 2 + k
            if i >= len(minis):
                break
            blocco(c, y, i + 1, minis[i], numero, parola, soluzione)
            if k == 0 and i + 1 < len(minis):
                c.setDash(3, 3)
                c.setStrokeColor(GRIGIO_SCURO)
                c.setLineWidth(0.8)
                c.line(MARGINE, y - H_BLOCCO - 6, W - MARGINE, y - H_BLOCCO - 6)
                c.setDash()
            y -= H_BLOCCO + 12
        c.setFont(FONT, 9)
        c.setFillColor(GRIGIO_SCURO)
        c.drawCentredString(W / 2, 22, f"{p + 1} / {pagine}")
        c.showPage()
    c.save()


def main():
    numero = int(sys.argv[1]) if len(sys.argv) > 1 else 43
    parola = sys.argv[2].upper() if len(sys.argv) > 2 else "MEEPLE"
    minis = crea_mini(numero, parola)
    f = os.path.join(QUI, "mini_enigmi.pdf")
    s = os.path.join(QUI, "mini_enigmi_soluzioni.pdf")
    scrivi(minis, f, numero, parola, False)
    scrivi(minis, s, numero, parola, True)
    print(f"Numero {numero} -> parola {parola}\n  {f}\n  {s}\n")
    for i, m in enumerate(minis, 1):
        print(f"  {i:2d}. [{NOMI_LIVELLO[m.livello]:<9}] {m.titolo}")


if __name__ == "__main__":
    main()
