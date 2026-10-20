#!/usr/bin/env python3
"""Genera la pagina del labirinto (versione facile) con la parola/frase nascosta sul percorso e il riquadro «REPERTO».

Uso:  python genera_labirinto.py [parola] [reperto] [seme]     (default da config.py: PAROLA_LABIRINTO_PAGINA, REPERTO, SEED)
Scrive labirinto.pdf (giocatori) e labirinto_soluzione.pdf (percorso in grigio e lettere scritte), una pagina ciascuno.
La parola può avere spazi (es. "PARCO GALLO"); da 3 a 14 lettere, solo l'alfabeto italiano.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from enigmi.pagina_labirinto import crea_pagina_labirinto, scrivi_labirinto

QUI = os.path.dirname(os.path.abspath(__file__))


def main():
    parola = sys.argv[1].upper() if len(sys.argv) > 1 else config.PAROLA_LABIRINTO_PAGINA
    reperto = sys.argv[2].upper() if len(sys.argv) > 2 else config.REPERTO
    seme = int(sys.argv[3]) if len(sys.argv) > 3 else config.SEED
    d = crea_pagina_labirinto(parola, seme)
    f = os.path.join(QUI, "labirinto.pdf")
    s = os.path.join(QUI, "labirinto_soluzione.pdf")
    scrivi_labirinto(d, reperto, f, False, config.NUMERO_REPERTO_LABIRINTO)
    scrivi_labirinto(d, reperto, s, True, config.NUMERO_REPERTO_LABIRINTO)
    print(f"Labirinto 12x12: parola {parola} (reperto n. {config.NUMERO_REPERTO_LABIRINTO}: {reperto})\n  {f}\n  {s}")
    print(f"  Percorso di {len(d['percorso'])} caselle, {len(d['lettere']) - len(d['parola'])} lettere trappola.")


if __name__ == "__main__":
    main()
