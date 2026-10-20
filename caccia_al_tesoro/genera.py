#!/usr/bin/env python3
"""Genera il fascicolo degli enigmi, il PDF delle soluzioni e le varianti dell'enigma 8 (giochi da tavolo).

Uso:  python genera.py   (scrive fascicolo.pdf, soluzioni.pdf e varianti_enigma8.pdf in questa cartella)
"""
import dataclasses
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

import config
from enigmi import cifrari, deduzione, figure, giochi_tavolo, parole, visivi
from enigmi.impagina import copertina, pagina_enigma

QUI = os.path.dirname(os.path.abspath(__file__))
TOTALE_ENIGMI = 12


def _rng(k):
    return random.Random(config.SEED * 100 + k)


def crea_enigmi(metodo_forme=None, dati=None):
    """I 12 enigmi nell'ordine del fascicolo. Se `dati` è un dict, ci mette i dati grezzi per i test."""
    s = config.SOLUZIONI
    metodo_forme = metodo_forme or config.METODO_ENIGMA_8
    dati = dati if dati is not None else {}
    e1, dati["simboli"] = cifrari.simboli_facile(s["simboli"], _rng(1))
    e2, dati["scala"] = parole.scala_facile()
    e3, dati["mastermind"] = parole.mastermind_medio(s["mastermind"], _rng(3))
    e4, dati["pigpen"] = cifrari.pigpen_medio(s["pigpen"])
    e5, dati["labirinto"] = visivi.crea(config.SEED, config.PAROLA_LABIRINTO)
    e6, dati["serie"] = figure.serie_facile(s["serie"], _rng(6))
    e7, dati["ombre"] = figure.ombre_medio(s["ombre"], _rng(7))
    e8, dati["forme"] = giochi_tavolo.enigma_plancia(metodo_forme, s["forme"], config.SEED)
    e9, dati["cesare"] = cifrari.cesare_facile(s["cesare"])
    (e10, e11), dd = deduzione.crea(config.SEED, config.NOMI)
    dati.update(dd)
    e12, dati["pixel"] = parole.pixel_medio(s["pixel"])
    return [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12]


def scrivi(enigmi, percorso, soluzioni):
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle(config.TITOLO + (" - Soluzioni" if soluzioni else ""))
    c.setAuthor("Caccia al tesoro")
    copertina(c, config.TITOLO, config.SOTTOTITOLO, soluzioni=soluzioni)
    for i, e in enumerate(enigmi, 1):
        pagina_enigma(c, i, len(enigmi), e, soluzione=soluzioni)
    c.save()


def scrivi_varianti(percorso):
    """Una pagina del giocatore e una di soluzione per ciascun metodo di conversione dell'enigma 8."""
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle(config.TITOLO + " - Varianti enigma 8")
    elenco = []
    for metodo in giochi_tavolo.METODI:
        e, d = giochi_tavolo.enigma_plancia(metodo, config.SOLUZIONI["forme"], config.SEED)
        e = dataclasses.replace(e, categoria=f"{e.categoria} - variante: {giochi_tavolo.TITOLI_METODI[metodo]}")
        elenco.append((metodo, e))
        pagina_enigma(c, 8, TOTALE_ENIGMI, e, soluzione=False)
        pagina_enigma(c, 8, TOTALE_ENIGMI, e, soluzione=True)
    c.save()
    return elenco


def main():
    enigmi = crea_enigmi()
    f = os.path.join(QUI, "fascicolo.pdf")
    s = os.path.join(QUI, "soluzioni.pdf")
    v = os.path.join(QUI, "varianti_enigma8.pdf")
    scrivi(enigmi, f, False)
    scrivi(enigmi, s, True)
    varianti = scrivi_varianti(v)
    print(f"Creati:\n  {f}\n  {s}\n  {v}\n")
    for i, e in enumerate(enigmi, 1):
        print(f"  {i:2d}. [{'facile' if e.livello == 1 else 'medio '}] {e.titolo:<24} -> {e.risposta}")
    print(f"\n  Enigma 8 nel fascicolo: metodo '{config.METODO_ENIGMA_8}'")
    for metodo, e in varianti:
        print(f"    variante {metodo:<16} -> {e.risposta}")


if __name__ == "__main__":
    main()
