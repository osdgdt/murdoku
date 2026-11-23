"""Il giudice: chiede al solver dell'app (Node) se un caso è valido e unico.

Il solver, il solver umano e i controlli sono in JavaScript (src/solver/, tools/lib/ml-validate.mjs): non si riscrivono in Python.
Qui si chiama `node tools/ml-validate.mjs` come sottoprocesso, passando il caso (e la soluzione stampata, se la si conosce).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE = REPO_ROOT / "tools" / "ml-validate.mjs"


class ValidatorError(RuntimeError):
    """Node non c'è, o il ponte non ha risposto (diverso da «il caso non è valido»: quello sta nel rapporto)."""


def validate_case(puzzle: dict, printed: list[dict] | None = None, *, max_nodes: int | None = None, timeout: float = 300) -> dict:
    """Rapporto del solver su un caso.

    `puzzle`: il caso nel formato `.murdoku.json` dell'app. `printed`: la soluzione stampata come
    [{"name": "Anna", "row": 0, "col": 1}, ...] (righe e colonne da 0), oppure None.
    Il rapporto ha: ok, stage ("shape" | "search" | "done"), problems, solutionCount, unique, solution, matchesPrinted,
    mismatches, culprit, human (livello e passi del solver umano), declared.
    """
    node = shutil.which("node")
    if node is None:
        raise ValidatorError("Node non è installato: serve per il solver dell'app (https://nodejs.org)")
    payload: dict = {"puzzle": puzzle}
    if printed is not None:
        payload["printed"] = {"placements": printed}
    if max_nodes is not None:
        payload["maxNodes"] = max_nodes
    try:
        done = subprocess.run(
            [node, str(BRIDGE)], input=json.dumps(payload), capture_output=True, text=True, timeout=timeout, cwd=REPO_ROOT, check=False
        )
    except subprocess.TimeoutExpired as error:
        raise ValidatorError(f"il solver non ha risposto in {timeout} secondi") from error
    if done.returncode != 0:
        raise ValidatorError(f"il ponte è uscito con {done.returncode}: {done.stderr.strip()}")
    return json.loads(done.stdout)


def validate_file(path: str | Path, printed: list[dict] | None = None, **kwargs) -> dict:
    return validate_case(json.loads(Path(path).read_text(encoding="utf-8")), printed, **kwargs)
