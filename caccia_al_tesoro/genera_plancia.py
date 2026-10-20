#!/usr/bin/env python3
"""Genera la plancia "Serata giochi da tavolo" rifinita e il mini enigma 10 (numero -> parola).

Uso:  python genera_plancia.py [punteggio] [parola] [seme]     (default: punteggio e parola da config.py)
Scrive plancia_e_mini10.pdf (2 pagine per i giocatori) e plancia_e_mini10_soluzioni.pdf (2 pagine).
Il punteggio finale (somma delle sei risposte) va da 19 a 85; la parola ha 3-7 lettere.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

import config
from enigmi.plancia_finale import crea_plancia_finale, pagina_mini10, pagina_plancia

QUI = os.path.dirname(os.path.abspath(__file__))


def scrivi(d, percorso, soluzione):
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle("Serata giochi da tavolo e codice del tesoro" + (" - Soluzioni" if soluzione else ""))
    c.setAuthor("Caccia al tesoro")
    pagina_plancia(c, d, soluzione)
    pagina_mini10(c, d, soluzione)
    c.save()


def main():
    punteggio = int(sys.argv[1]) if len(sys.argv) > 1 else config.PUNTEGGIO_ENIGMA_8
    parola = sys.argv[2].upper() if len(sys.argv) > 2 else config.SOLUZIONI["forme"]
    seme = int(sys.argv[3]) if len(sys.argv) > 3 else config.SEED
    d = crea_plancia_finale(punteggio, parola, seme)
    f = os.path.join(QUI, "plancia_e_mini10.pdf")
    s = os.path.join(QUI, "plancia_e_mini10_soluzioni.pdf")
    scrivi(d, f, False)
    scrivi(d, s, True)
    print(f"Punteggio finale {punteggio} -> parola {parola}\n  {f}\n  {s}\n")
    print("  Risposte: " + ", ".join(f"{t} {n}" for t, n in d["conteggi"].items()) + f"  (somma {sum(d['conteggi'].values())})")
    print(f"  Chiave {d['chiave']}: i simboli dicono {d['pigpen']} -> {parola}")


if __name__ == "__main__":
    main()
