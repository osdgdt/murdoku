"""Lettore v1: dalle foto di un caso al record `NNN.record.json` (ml/FORMATO.md), fase per fase.

Ogni fase dice cosa ha letto e cosa no. Un caso si *scarta* se non si riesce a ricostruire il caso (`puzzle` nullo): non si
inventa nulla. Passa a `incerto` quando il caso è ricostruito ma da guardare, e a `ok` solo se il solver lo trova a soluzione
unica uguale a quella stampata (vedi murdoku_ml.validate).

    python -m reader.pipeline 1-20          # dalla cartella ml/, con MURDOKU_DATA impostata
"""

from __future__ import annotations

import json
import sys

from murdoku_ml.record import new_record, save_record

from . import characters, config, imageio, schematic
from .grammar import parse_sentence
from .progress import Progress

# Cosa il lettore v1 NON sa ancora fare: sono limiti dello strumento, non del caso.
NOT_IMPLEMENTED = [
    "tipi di oggetto non letti (serve il classificatore sull'illustrazione della mappa)",
    "soluzione stampata non letta (pagina dei passaggi: pedine e «R C» da leggere)",
]


def _load_upright(name: str):
    """La foto nella rotazione trovata dall'inventario (cache `lavoro/pagine`)."""
    image = imageio.load(config.data_dir() / name)
    cache = config.work_dir() / "pagine" / (name.rsplit(".", 1)[0] + ".json")
    if cache.exists():
        rotation = json.loads(cache.read_text(encoding="utf-8")).get("rotation", 0)
        if rotation:
            image = imageio.rotate(image, rotation)
    return image


def read_case(entry: dict) -> dict:
    """Legge un caso del manifest e ne fa il record."""
    number = entry["number"]
    record = new_record(number)
    record["source"]["title"] = entry.get("title", "")
    record["source"]["pages"] = {
        "personaggi": entry["personaggi"][0] if entry["personaggi"] else None,
        "mappa": entry["mappa"][0] if entry["mappa"] else None,
        "passaggi": entry["passaggi"][0] if entry["passaggi"] else None,
    }
    issues: list[str] = []
    stages: dict = {}

    # --- mappa (griglia schematica)
    if entry["mappa"]:
        page = imageio.load(config.data_dir() / entry["mappa"][0])
        box = schematic.locate(page)
        sch = schematic.read(page, box) if box else None
        if sch is None:
            stages["griglia"] = {"letta": False}
            issues.append("griglia schematica non trovata")
        else:
            rooms = int(sch.rooms().max()) + 1
            stages["griglia"] = {
                "letta": True,
                "righe": sch.rows,
                "colonne": sch.cols,
                "caselle": int(sch.inside.sum()),
                "bloccate": int(sch.blocked.sum()),
                "stanze": rooms,
                "occupabili": len(sch.marks),
            }
            if rooms < 2:
                issues.append("griglia: una sola stanza (muri spessi probabilmente non letti)")
    else:
        stages["griglia"] = {"letta": False}
        issues.append("pagina della mappa assente")

    # --- personaggi
    if entry["personaggi"]:
        page = _load_upright(entry["personaggi"][0])
        cards = characters.read_cards(page)
        names, rooms = characters.mentioned(cards)
        parsed = [parse_sentence(c.sentence, names, rooms) for c in cards]
        # «riconosciuta» = tutta la frase è stata capita (o è di un tipo noto ma non supportato); nessun pezzo ignoto
        recognised = sum(1 for p in parsed if not p.unknown)
        stages["personaggi"] = {
            "schede": len(cards),
            "frasi_riconosciute": recognised,
            "frasi_non_supportate": sum(1 for p in parsed if p.unsupported),
            "con_vittima": sum(1 for c, p in zip(cards, parsed) if c.victim or p.victim),
            "frasi_ignote": [c.sentence for c, p in zip(cards, parsed) if p.unknown],
        }
        record["printed"]["steps"] = []
        if len(cards) < 3:
            issues.append("personaggi: meno di tre schede lette")
        elif recognised < len(cards):
            issues.append(f"personaggi: {len(cards) - recognised} schede su {len(cards)} senza un indizio riconosciuto")
        if not stages["personaggi"]["con_vittima"]:
            issues.append("personaggi: nessuna scheda «La vittima» riconosciuta")
        issues.append("personaggi: i nomi in gotico non sono letti (le schede restano A, B, C… per ordine alfabetico)")
    else:
        stages["personaggi"] = {"schede": 0}
        issues.append("pagina dei personaggi assente")

    if not entry["passaggi"]:
        issues.append("pagina dei passaggi non abbinata al caso")
    issues += NOT_IMPLEMENTED

    record["extraction"]["status"] = "scartato"  # puzzle non ricostruito: niente da correggere né da validare
    record["extraction"]["issues"] = issues
    record["extraction"]["stages"] = stages
    return record


def parse_range(text: str) -> list[int]:
    if "-" in text:
        a, b = text.split("-", 1)
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in text.split(",")]


def main() -> None:
    wanted = parse_range(sys.argv[1]) if len(sys.argv) > 1 else list(range(1, 21))
    manifest = json.loads((config.work_dir() / "manifest.json").read_text(encoding="utf-8"))
    by_number = {c["number"]: c for c in manifest["cases"]}
    out_dir = config.work_dir() / "record"
    out_dir.mkdir(exist_ok=True)
    counts: dict[str, int] = {}
    bar = Progress(len(wanted), "Casi")
    for number in wanted:
        entry = by_number.get(number)
        if not entry:
            bar.note(f"caso {number}: non nel manifest")
            bar.step(f"caso {number}")
            continue
        record = read_case(entry)
        save_record(record, out_dir / f"{number:03d}.record.json")
        status = record["extraction"]["status"]
        counts[status] = counts.get(status, 0) + 1
        st = record["extraction"]["stages"]
        print(f"caso {number:2d} {status:8s} griglia={st['griglia']} personaggi={st['personaggi']}")
    print("\nriepilogo:", counts)


if __name__ == "__main__":
    main()
