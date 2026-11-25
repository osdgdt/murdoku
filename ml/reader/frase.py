"""Prova una frase contro la grammatica (quella del programma + la tua `grammatica.json`), senza aprire la pagina di correzione.

    python ml/run.py frase "Si trovava sul tappeto" --dati Murdoku1
    python ml/run.py frase "Stava a nord di Bors" --nomi Alice,Bors --stanze "Cucina,Sala da pranzo"
    python ml/run.py frase --esempio --dati Murdoku1      # crea un `grammatica.json` d'esempio nella cartella dei dati

Dice cosa ha capito (tipo di indizio e parametri), cosa no, e che testo avrebbe l'indizio nel gioco con «le mie parole».
"""

from __future__ import annotations

import json
import sys

from . import config
from .grammar import CUSTOM_FILE, custom, parse_sentence

EXAMPLE = {
    "testo_indizi": "automatico",
    "oggetti": {"pagliericcio": "pallet"},
    "verbi": ["si accomodava"],
    "frasi": [
        {"se": "riposava sul {oggetto}", "indizio": "onObjectType"},
        {"se": "stava a {direzione} di {persona}", "indizio": "directionDistance"},
        {"se": "dormiva", "indizio": "onObjectType", "parametri": {"objectTypeId": "bed"}},
    ],
}


def main() -> None:
    argv = config.take_data_option(sys.argv[1:])

    def option(name: str, default: str = "") -> str:
        if name in argv:
            index = argv.index(name)
            value = argv[index + 1] if index + 1 < len(argv) else default
            del argv[index : index + 2]
            return value
        return default

    names = [n.strip() for n in option("--nomi", "Alice,Bors,Clemenza").split(",") if n.strip()]
    rooms = [r.strip() for r in option("--stanze", "Cucina,Camera,Sala da pranzo").split(",") if r.strip()]

    if "--esempio" in argv:
        path = config.data_dir() / CUSTOM_FILE
        if path.exists():
            sys.exit(f"{path} esiste già: non lo sovrascrivo.")
        path.write_text(json.dumps(EXAMPLE, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Creato {path}: apri il file, cambia le frasi con le tue e rilancia la pagina di correzione (o questo comando) per provarle.")
        return

    sentence = " ".join(argv).strip()
    if not sentence:
        sys.exit(__doc__)
    try:
        grammar = custom()
    except ValueError as error:
        sys.exit(f"Errore in {CUSTOM_FILE}: {error}")
    parsed = parse_sentence(sentence, names, rooms)
    extra = len(grammar["frasi"]) + len(grammar["oggetti"]) + len(grammar["verbi"])
    print(f"Grammatica personale: {extra} voci" if extra else "Grammatica personale: nessuna (nessun grammatica.json, o è vuoto)")
    for clue in parsed.clues:
        print(f"  ✓ {'NON ' if clue.get('negate') else ''}{clue['type']} {json.dumps(clue['params'], ensure_ascii=False)}")
        print(f"      con «le mie parole» nel gioco: «{clue.get('source', '')}»")
    if parsed.victim:
        print("  ✓ vittima, sola con l'assassino")
    for text in parsed.unknown:
        print(f"  ✗ non capita: {text or '(vuota)'}")
    for code in parsed.unsupported:
        print(f"  ⚠ non supportata dall'app: {code}")
    if not (parsed.clues or parsed.unknown or parsed.unsupported or parsed.victim):
        print("  ✗ nessun indizio")


if __name__ == "__main__":
    main()
