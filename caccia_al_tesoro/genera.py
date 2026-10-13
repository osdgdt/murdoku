#!/usr/bin/env python3
"""Genera il fascicolo degli enigmi e il PDF delle soluzioni.

Uso:  python genera.py            (scrive fascicolo.pdf e soluzioni.pdf in questa cartella)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

import config
from enigmi import logica, visivi, deduzione
from enigmi.impagina import copertina, pagina_enigma

QUI = os.path.dirname(os.path.abspath(__file__))


def crea_enigmi():
    el, _ = logica.crea(config.SEED)
    ev, _ = visivi.crea(config.SEED, config.PAROLA_LABIRINTO, config.FIGURA_PUNTINI)
    ed, _ = deduzione.crea(config.SEED, config.NOMI)
    return el + ev + ed


def scrivi(enigmi, percorso, soluzioni):
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle(config.TITOLO + (" - Soluzioni" if soluzioni else ""))
    c.setAuthor("Caccia al tesoro")
    copertina(c, config.TITOLO, config.SOTTOTITOLO, soluzioni=soluzioni)
    for i, e in enumerate(enigmi, 1):
        pagina_enigma(c, i, len(enigmi), e, soluzione=soluzioni)
    c.save()


def main():
    enigmi = crea_enigmi()
    f = os.path.join(QUI, "fascicolo.pdf")
    s = os.path.join(QUI, "soluzioni.pdf")
    scrivi(enigmi, f, False)
    scrivi(enigmi, s, True)
    print(f"Creati: {f}\n        {s}")
    for i, e in enumerate(enigmi, 1):
        print(f"  {i:2d}. [{'facile' if e.livello == 1 else 'medio '}] {e.titolo:<26} -> {e.risposta}")


if __name__ == "__main__":
    main()
