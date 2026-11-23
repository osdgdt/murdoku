"""Il «record» di un caso: il caso nel formato dell'app più tutto quello che si sa della fonte e dell'estrazione.

Formato in ml/FORMATO.md. Un record sta in un file `NNN.record.json` nella cartella dei dati (fuori dal repository).
"""

from __future__ import annotations

import json
from pathlib import Path

from .unsupported import UNSUPPORTED

FORMAT = "murdoku-ml-case"
VERSION = 1
STATUSES = ("ok", "incerto", "scartato", "verificato")


def new_record(number: int, puzzle: dict | None = None) -> dict:
    """Un record vuoto per il caso `number` del libro."""
    return {
        "format": FORMAT,
        "version": VERSION,
        "source": {"number": number, "title": "", "tagline": "", "pages": {}},
        "puzzle": puzzle,
        "printed": {"culprit": None, "placements": [], "steps": []},
        "extraction": {"status": "incerto", "issues": [], "report": None},
        "unsupported": [],
    }


def check_record(record: dict) -> list[str]:
    """I problemi di forma di un record (lista vuota = a posto)."""
    problems: list[str] = []
    if record.get("format") != FORMAT:
        problems.append(f"format deve essere «{FORMAT}»")
    if record.get("version") != VERSION:
        problems.append(f"version deve essere {VERSION}")
    source = record.get("source") or {}
    if not isinstance(source.get("number"), int):
        problems.append("source.number deve essere il numero del caso (intero)")
    extraction = record.get("extraction") or {}
    status = extraction.get("status")
    if status not in STATUSES:
        problems.append(f"extraction.status deve essere uno di {STATUSES}")
    for code in record.get("unsupported") or []:
        if code not in UNSUPPORTED:
            problems.append(f"unsupported: codice sconosciuto «{code}»")
    if status in ("ok", "verificato"):
        if not record.get("puzzle"):
            problems.append("un record «ok» o «verificato» ha il caso (puzzle)")
        if record.get("unsupported"):
            problems.append("un record con elementi non supportati non può essere «ok» né «verificato»")
    return problems


def save_record(record: dict, path: str | Path) -> None:
    problems = check_record(record)
    if problems:
        raise ValueError("record non valido: " + "; ".join(problems))
    Path(path).write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_record(path: str | Path) -> dict:
    record = json.loads(Path(path).read_text(encoding="utf-8"))
    problems = check_record(record)
    if problems:
        raise ValueError(f"{path}: " + "; ".join(problems))
    return record


def inventory(records: list[dict]) -> dict[str, list[int]]:
    """Per ogni codice non supportato, i numeri dei casi che lo usano (per decidere cosa estendere nell'app)."""
    found: dict[str, list[int]] = {}
    for record in records:
        for code in record.get("unsupported") or []:
            found.setdefault(code, []).append(record["source"]["number"])
    return {code: sorted(numbers) for code, numbers in sorted(found.items())}
