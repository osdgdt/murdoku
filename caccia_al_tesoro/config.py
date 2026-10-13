"""Parametri personalizzabili del fascicolo.

Cambia qui nomi, parole e titoli, poi rigenera con `python genera.py`.
"""

# Seme fisso: stesso seme = stessi enigmi a ogni rigenerazione.
# Cambialo (es. 7, 99, 2027) per ottenere un fascicolo completamente nuovo.
SEED = 2026

TITOLO = "CACCIA AL TESORO"
SOTTOTITOLO = "Il fascicolo degli enigmi"

# Nomi dei personaggi usati nei giochi di deduzione (5 nomi, iniziali tutte diverse).
NOMI = ["Anna", "Bruno", "Carla", "Dario", "Elisa"]

# Parola nascosta nel labirinto (lettere lungo il percorso giusto): 3-8 lettere.
PAROLA_LABIRINTO = "CHIAVE"

# Cosa compare unendo i puntini (deve coincidere con la figura disegnata).
FIGURA_PUNTINI = "CASA"
