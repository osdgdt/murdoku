"""Le bozze di molti casi in una volta: griglia + schede + soluzione stampata + giudizio del solver, con barra di progresso.

    python -m reader.batch 1-20            # dalla cartella ml/, con MURDOKU_DATA impostata
    python -m reader.batch 1-80 --workers 4 --force

Scrive `lavoro/bozze/NNN.json` (la bozza che si corregge con `python -m reader.review`) e `lavoro/batch.json` (la tabella). Una bozza già
presente NON si sovrascrive (può essere stata corretta a mano) a meno di `--force`: in quel caso la tabella la legge e la giudica.
Esito per caso: `ok` (il solver trova una sola soluzione, uguale alla stampata, nessun problema), `da_correggere` (il caso è ricostruito ma
manca o non torna qualcosa), `non_valido` (la griglia non c'è: non si può nemmeno giudicare).
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed

from . import config, draft as drafts
from .progress import Progress


def process_case(entry: dict, force: bool = False) -> dict:
    """Legge (o carica) la bozza del caso e la giudica. Ritorna la riga della tabella."""
    number = entry["number"]
    problems_reading: list[str] = []
    current = None if force else drafts.load_draft(number)
    fresh = current is None
    if fresh:
        try:
            current = drafts.auto_draft(entry)
        except Exception as error:  # una foto illeggibile non ferma il resto
            current = drafts.blank_draft(number, entry.get("title", ""))
            problems_reading.append(f"lettura delle pagine fallita: {error}")
        if entry.get("passaggi"):
            try:
                problems_reading += drafts.read_solution(current, entry)
            except Exception as error:
                problems_reading.append(f"lettura della soluzione fallita: {error}")
        drafts.save_draft(current)
    try:
        result = drafts.check(current)
    except Exception as error:
        result = {"verdict": "non_valido", "problems": [f"giudizio fallito: {error}"], "cards": [], "report": None, "unsupported": []}
    report = result.get("report") or {}
    return {
        "number": number,
        "title": current.get("title", ""),
        "fresh": fresh,
        "grid": [current.get("rows", 0), current.get("cols", 0)],
        "rooms": len(current.get("rooms") or []),
        "cards": len(current.get("cards") or []),
        "cards_understood": sum(1 for c in result.get("cards") or [] if not c["unknown"]),
        "culprit": current.get("culprit", ""),
        "placements": len(current.get("placements") or []),
        "verdict": result["verdict"],
        "unique": report.get("unique"),
        "solutions": report.get("solutionCount"),
        "matches_printed": report.get("matchesPrinted"),
        "unsupported": result.get("unsupported") or [],
        "problems": (result.get("problems") or [])[:8],
        "reading": problems_reading[:8],
    }


def summary(rows: list[dict]) -> dict:
    """Quanti casi per esito e quante parti sono state lette."""
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["verdict"]] = counts.get(row["verdict"], 0) + 1
    return {
        "casi": len(rows),
        "esiti": counts,
        "griglia_letta": sum(1 for r in rows if r["grid"][0]),
        "schede_tutte_capite": sum(1 for r in rows if r["cards"] and r["cards_understood"] == r["cards"]),
        "assassino_letto": sum(1 for r in rows if r["culprit"]),
        "posizioni_complete": sum(1 for r in rows if r["cards"] and r["placements"] == r["cards"]),
        "soluzione_unica": sum(1 for r in rows if r["unique"]),
    }


def parse_range(text: str) -> list[int]:
    if "-" in text:
        a, b = text.split("-", 1)
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in text.split(",")]


def main() -> None:
    argv = config.take_data_option(sys.argv[1:])
    workers = 1
    if "--workers" in argv:
        k = argv.index("--workers")
        workers = int(argv[k + 1])
        del argv[k : k + 2]
    force = "--force" in argv
    args = [a for a in argv if not a.startswith("--")]
    wanted = parse_range(args[0]) if args else list(range(1, 21))
    manifest = json.loads((config.work_dir() / "manifest.json").read_text(encoding="utf-8"))
    by_number = {c["number"]: c for c in manifest["cases"]}
    entries = [by_number[n] for n in wanted if n in by_number]
    rows: list[dict] = []
    bar = Progress(len(entries), "Bozze")
    if workers > 1:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(process_case, e, force): e["number"] for e in entries}
            for future in as_completed(futures):
                row = future.result()
                rows.append(row)
                bar.step(f"caso {row['number']} {row['verdict']}")
    else:
        for entry in entries:
            row = process_case(entry, force)
            rows.append(row)
            bar.step(f"caso {row['number']} {row['verdict']}")
    bar.done()
    rows.sort(key=lambda r: r["number"])
    out = config.work_dir() / "batch.json"
    out.write_text(json.dumps({"summary": summary(rows), "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in rows:
        print(
            f"caso {r['number']:2d} {r['verdict']:13s} griglia {r['grid'][0]}x{r['grid'][1]} stanze {r['rooms']} schede {r['cards_understood']}/{r['cards']} "
            f"assassino {r['culprit'] or '-'} posizioni {r['placements']} soluzioni {r['solutions']} stampata {r['matches_printed']}"
        )
    print("\nriepilogo:", json.dumps(summary(rows), ensure_ascii=False))
    print("tabella →", out)


if __name__ == "__main__":
    main()
