#!/usr/bin/env python3
"""Genera il catalogo delle regole dei "codici a griglia" (anteprima per l'organizzatore).

Uso:  python genera_codici.py [parola]      (default: CASTELLO)
Scrive catalogo_regole.pdf (per provare le regole) e catalogo_regole_soluzioni.pdf (con spiegazioni e soluzioni).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from enigmi.codici import crea_catalogo, nome_voce
from enigmi.dossier_codici import scrivi_catalogo

QUI = os.path.dirname(os.path.abspath(__file__))


def main():
    parola = sys.argv[1].upper() if len(sys.argv) > 1 else "CASTELLO"
    blocchi = crea_catalogo(parola)
    f = os.path.join(QUI, "catalogo_regole.pdf")
    s = os.path.join(QUI, "catalogo_regole_soluzioni.pdf")
    scrivi_catalogo(blocchi, f, False)
    scrivi_catalogo(blocchi, s, True)
    print(f"Catalogo con bersagli dalla parola {parola}\n  {f}\n  {s}\n")
    for i, b in enumerate(blocchi, 1):
        ex = ", ".join(e["lettera"] for e in b["esempi"])
        print(f"  {i:2d}. {nome_voce(b['voce']):<38} esempi: {ex:<6} bersaglio {b['bersaglio']['lettera']}  "
              f"(caselle di partenza: {len(b['bersaglio']['hint'])})")


if __name__ == "__main__":
    main()
