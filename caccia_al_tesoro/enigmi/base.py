from dataclasses import dataclass
from typing import Callable

FACILE = 1
MEDIO = 2


@dataclass
class Enigma:
    titolo: str
    categoria: str
    livello: int
    consegna: str
    prompt_risposta: str  # cosa scrivere nel riquadro "RISPOSTA"
    risposta: str  # risposta breve e univoca (compare solo nelle soluzioni)
    spiegazione: str  # come si arriva alla risposta (solo nelle soluzioni)
    disegna: Callable  # disegna(c, box, soluzione): box = (x, y_basso, larghezza, altezza)
