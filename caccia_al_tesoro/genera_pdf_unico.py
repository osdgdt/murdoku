#!/usr/bin/env python3
"""Un unico PDF con tre enigmi, ognuno nella versione per i giocatori e in quella con la soluzione.

Uso:  python genera_pdf_unico.py        (scrive enigmi_unico.pdf; serve la libreria pypdf: pip install pypdf)
Contenuto, nell'ordine (ogni enigma: prima le pagine dei giocatori, poi quelle con la soluzione):
  1. Il labirinto (PARCO GALLO, reperto 6)                     2 pagine
  2. Il conteggio delle forme + il cifrario (COLPEVOLE, reperto 9)  4 pagine
  3. I finti nonogrammi con le lettere (PARCHEGGIO, reperto 11)     2 pagine
Parole, numeri dei reperti e punteggio vengono da config.py come negli script dei singoli enigmi.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pypdf import PdfReader, PdfWriter

import config
import genera_parcheggio
import genera_plancia
from enigmi.codici import crea_gruppi
from enigmi.dossier_gruppi import scrivi_gruppi
from enigmi.pagina_labirinto import crea_pagina_labirinto, scrivi_labirinto
from enigmi.plancia_finale import crea_plancia_finale

QUI = os.path.dirname(os.path.abspath(__file__))


def crea_parti(cartella):
    """Per ogni enigma: (titolo, file giocatori, file soluzione)."""
    lab = crea_pagina_labirinto(config.PAROLA_LABIRINTO_PAGINA, config.SEED)
    l1, l2 = os.path.join(cartella, "lab_g.pdf"), os.path.join(cartella, "lab_s.pdf")
    scrivi_labirinto(lab, config.REPERTO, l1, False, config.NUMERO_REPERTO_LABIRINTO)
    scrivi_labirinto(lab, config.REPERTO, l2, True, config.NUMERO_REPERTO_LABIRINTO)

    pl = crea_plancia_finale(config.PUNTEGGIO_ENIGMA_8, config.PAROLA_PLANCIA, config.SEED)
    p1, p2 = os.path.join(cartella, "pl_g.pdf"), os.path.join(cartella, "pl_s.pdf")
    genera_plancia.scrivi(pl, p1, False, genera_plancia.aiuto_da_config())
    genera_plancia.scrivi(pl, p2, True)

    parola = "PARCHEGGIO"
    bl = crea_gruppi(parola, genera_parcheggio.leggi_gruppi("3x5,4x5"))
    k1, k2 = os.path.join(cartella, "pk_g.pdf"), os.path.join(cartella, "pk_s.pdf")
    scrivi_gruppi(bl, parola, k1, False, numero_reperto=config.NUMERO_REPERTO_PARCHEGGIO)
    scrivi_gruppi(bl, parola, k2, True, numero_reperto=config.NUMERO_REPERTO_PARCHEGGIO)
    return [("1 · Il labirinto", l1, l2), ("2 · Il conteggio delle forme e il cifrario", p1, p2),
            ("3 · I finti nonogrammi con le lettere", k1, k2)]


def unisci(parti, percorso):
    w = PdfWriter()
    for titolo, giocatori, soluzione in parti:
        prima = len(w.pages)
        genitore = None
        for etichetta, f in (("Versione per i giocatori", giocatori), ("Versione con la soluzione", soluzione)):
            r = PdfReader(f)
            inizio = len(w.pages)
            for pagina in r.pages:
                w.add_page(pagina)
            if genitore is None:
                genitore = w.add_outline_item(titolo, prima)
            w.add_outline_item(etichetta, inizio, parent=genitore)
    w.add_metadata({"/Title": "Caccia al tesoro - enigmi (giocatori e soluzioni)", "/Author": "Caccia al tesoro"})
    w.page_mode = "/UseOutlines"
    with open(percorso, "wb") as fh:
        w.write(fh)
    return len(w.pages)


def main():
    out = os.path.join(QUI, "enigmi_unico.pdf")
    with tempfile.TemporaryDirectory() as t:
        n = unisci(crea_parti(t), out)
    print(f"{out}: {n} pagine (labirinto 2, forme+cifrario 4, nonogrammi 2)")


if __name__ == "__main__":
    main()
