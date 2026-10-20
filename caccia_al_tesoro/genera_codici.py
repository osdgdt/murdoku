#!/usr/bin/env python3
"""Genera l'enigma dei codici della professoressa (dossier segreto, una griglia 5x5 per lettera) e il catalogo delle regole.

Uso:  python genera_codici.py [parola]      (default: NASCONDIGLIO, 12 lettere = le 12 regole del catalogo)
Scrive:
  codici_professoressa.pdf              pagine dei giocatori (storia, griglie, riquadro risposta)
  codici_professoressa_spiegatori.pdf   le stesse con le griglie risolte e, sotto ogni blocco, il riquadro che spiega la regola
  catalogo_regole.pdf / catalogo_regole_soluzioni.pdf   anteprima delle 12 regole dell'enigma (parola CASTELLO)
  catalogo_regole_2.pdf / catalogo_regole_2_soluzioni.pdf   seconda serie: 10 regole difficili in più (parola PROFESSORE)
La parola ha da 1 a 12 lettere (solo l'alfabeto italiano): una regola diversa per lettera, dalla più facile alla più difficile.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from enigmi.codici import crea_catalogo, crea_catalogo_2, crea_enigma, nome_voce
from enigmi.dossier_codici import scrivi_catalogo
from enigmi.dossier_enigma import scrivi_enigma

QUI = os.path.dirname(os.path.abspath(__file__))
PAROLA_DEFAULT = "NASCONDIGLIO"


def main():
    parola = sys.argv[1].upper().replace(" ", "") if len(sys.argv) > 1 else PAROLA_DEFAULT
    blocchi = crea_enigma(parola)
    f = os.path.join(QUI, "codici_professoressa.pdf")
    s = os.path.join(QUI, "codici_professoressa_spiegatori.pdf")
    p1 = scrivi_enigma(blocchi, parola, f, False)
    p2 = scrivi_enigma(blocchi, parola, s, True)
    print(f"Enigma dei codici: parola {parola}\n  {f} ({p1} pagine)\n  {s} ({p2} pagine)\n")
    for i, b in enumerate(blocchi, 1):
        ex = ", ".join(e["lettera"] for e in b["esempi"])
        print(f"  {i:2d}. {nome_voce(b['voce']):<34} lettera {b['bersaglio']['lettera']}   esempi: {ex:<6} "
              f"caselle di partenza: {len(b['bersaglio']['hint'])}")
    cat = crea_catalogo("CASTELLO")
    scrivi_catalogo(cat, os.path.join(QUI, "catalogo_regole.pdf"), False)
    scrivi_catalogo(cat, os.path.join(QUI, "catalogo_regole_soluzioni.pdf"), True)
    cat2 = crea_catalogo_2("PROFESSORE")
    scrivi_catalogo(cat2, os.path.join(QUI, "catalogo_regole_2.pdf"), False, "SECONDA SERIE DI REGOLE")
    scrivi_catalogo(cat2, os.path.join(QUI, "catalogo_regole_2_soluzioni.pdf"), True, "SECONDA SERIE DI REGOLE")
    print("\nSeconda serie (parola PROFESSORE):")
    for i, b in enumerate(cat2, 1):
        ex = ", ".join(e["lettera"] for e in b["esempi"])
        print(f"  {i:2d}. {nome_voce(b['voce']):<34} lettera {b['bersaglio']['lettera']}   esempi: {ex:<6} "
              f"caselle di partenza: {len(b['bersaglio']['hint'])}")


if __name__ == "__main__":
    main()
