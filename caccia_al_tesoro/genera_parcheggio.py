#!/usr/bin/env python3
"""Genera l'enigma dei codici a gruppi: una parola divisa in serie, ogni serie con la sua regola (una pagina).

Uso:  python genera_parcheggio.py [parola] [gruppi]      (default: PARCHEGGIO 3x5,4x5)
  gruppi = elenco "numero regola x quante lettere", numeri del catalogo di 22 regole (catalogo_regole.pdf).
  Esempio:  python genera_parcheggio.py PARCHEGGIO 3x5,4x5
La prima lettera di ogni serie è già risolta (esempio); le altre vanno risolte con la stessa regola.
Scrive codici_parcheggio.pdf (giocatori) e codici_parcheggio_spiegatori.pdf (griglie risolte e regole spiegate).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from enigmi.codici import CATALOGO, crea_gruppi, nome_voce
from enigmi.dossier_gruppi import scrivi_gruppi

QUI = os.path.dirname(os.path.abspath(__file__))


def leggi_gruppi(testo):
    gruppi = []
    for pezzo in testo.split(","):
        n, q = pezzo.lower().split("x")
        if not 1 <= int(n) <= len(CATALOGO):
            raise SystemExit(f"Regola {n} inesistente: il catalogo va da 1 a {len(CATALOGO)}")
        gruppi.append((CATALOGO[int(n) - 1], int(q)))
    return gruppi


def main():
    parola = sys.argv[1].upper().replace(" ", "") if len(sys.argv) > 1 else "PARCHEGGIO"
    gruppi = leggi_gruppi(sys.argv[2] if len(sys.argv) > 2 else "3x5,4x5")
    blocchi = crea_gruppi(parola, gruppi)
    f = os.path.join(QUI, "codici_parcheggio.pdf")
    s = os.path.join(QUI, "codici_parcheggio_spiegatori.pdf")
    scrivi_gruppi(blocchi, parola, f, False, numero_reperto=config.NUMERO_REPERTO_PARCHEGGIO)
    scrivi_gruppi(blocchi, parola, s, True, numero_reperto=config.NUMERO_REPERTO_PARCHEGGIO)
    print(f"Enigma a gruppi: parola {parola}\n  {f}\n  {s}\n")
    for b in blocchi:
        print(f"  {nome_voce(b['voce'])}: esempio {b['esempio']['lettera']}; da risolvere "
              + ", ".join(f"{t['lettera']} ({len(t['hint'])} caselle di partenza)" for t in b["bersagli"]))


if __name__ == "__main__":
    main()
