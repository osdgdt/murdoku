"""La bozza di un caso: quello che il lettore ha letto, in una forma che una persona corregge, e il montaggio nel caso dell'app.

La bozza (`lavoro/bozze/NNN.json`, fuori dal repository) è fatta per essere modificata a mano nella pagina di correzione
(`python -m reader.review`): una casella è {dentro, bloccata, stanza, oggetto}, una scheda è {lettera, nome, frase, vittima}.
`assemble` la trasforma nel caso `.murdoku.json` dell'app; `check` la fa giudicare dal solver (unica? uguale a quella stampata?).

Righe e colonne della bozza sono da **1**, come nel libro («R3 C2»); il caso dell'app le vuole da 0.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

from murdoku_ml.record import new_record, save_record
from murdoku_ml.validate import REPO_ROOT, validate_case

from . import config
from .grammar import default_wording, parse_sentence

ROOM_COLORS = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2", "#c2f4e8", "#e8e8e8", "#f4a8a8", "#d7f4c2", "#f4c2e2", "#c2f1f4"]
CHARACTER_COLORS = ["#608aea", "#ea558a", "#158060", "#d98b1f", "#8a5bd0", "#2aa1b8", "#c0504d", "#7a8f2b", "#b5651d", "#4f6d7a", "#9c4f96", "#3b7f3b"]


def _icon_types() -> list[tuple[str, str, bool]]:
    """(id, nome italiano, sta sul bordo di una casella?) dei tipi di oggetto dell'app, letti da src/model/icons.js (così non si disallineano)."""
    text = (REPO_ROOT / "src" / "model" / "icons.js").read_text(encoding="utf-8")
    found = re.finditer(r'^\s{2}(\w+): \{([^\n]*?label: t\("([^"]+)"\)[^\n]*)', text, re.M)
    return [(m.group(1), m.group(3), "edge: true" in m.group(2)) for m in found]


def object_types() -> dict[str, str]:
    """id → nome italiano degli oggetti che riempiono una casella (porte e finestre stanno sul bordo: vedi `edge_types`)."""
    return {type_id: label for type_id, label, edge in _icon_types() if not edge}


# Quello che si segna sul bordo di una casella: un pezzo di muro condiviso fra le due caselle (o sul bordo della mappa).
EDGE_TYPE_IDS = ("door", "window")
SIDE_STEP = {"N": (-1, 0), "E": (0, 1), "S": (1, 0), "W": (0, -1)}
SIDE_NAME = {"N": "nord", "E": "est", "S": "sud", "W": "ovest"}


def edge_types() -> dict[str, str]:
    """id → nome italiano di ciò che si segna sul bordo di una casella (porta, finestra)."""
    return {type_id: label for type_id, label, edge in _icon_types() if edge and type_id in EDGE_TYPE_IDS}


def normalize_edge(row: int, col: int, side: str) -> tuple[int, int, str]:
    """Un solo modo di scrivere ogni segmento, come nell'app (src/model/grid.js): E e S, tranne sul bordo della mappa."""
    if side == "N" and row > 0:
        return row - 1, col, "S"
    if side == "W" and col > 0:
        return row, col - 1, "E"
    return row, col, side


def drafts_dir() -> Path:
    path = config.work_dir() / "bozze"
    path.mkdir(exist_ok=True)
    return path


def draft_path(number: int) -> Path:
    return drafts_dir() / f"{number:03d}.json"


def load_draft(number: int) -> dict | None:
    path = draft_path(number)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def save_draft(draft: dict) -> None:
    draft_path(int(draft["number"])).write_text(json.dumps(draft, ensure_ascii=False, indent=1), encoding="utf-8")


def blank_draft(number: int, title: str = "") -> dict:
    return {
        "number": number, "title": title, "rows": 0, "cols": 0, "cells": [], "edges": [], "rooms": [], "cards": [],
        "culprit": "", "placements": [], "unsupported": [], "notes": "", "boxes": {},
    }


# ----------------------------------------------------------------------------------------------- dalla lettura automatica


def auto_draft(entry: dict) -> dict:
    """La bozza che il lettore ricava dalle foto del caso (griglia + schede). Tutto è da controllare."""
    from . import characters, imageio, pipeline, schematic

    draft = blank_draft(entry["number"], entry.get("title", ""))
    if entry["mappa"]:
        page = imageio.load(config.data_dir() / entry["mappa"][0])
        box = schematic.locate(page)
        sch = schematic.read(page, box) if box else None
        if sch is not None:
            rooms = sch.rooms()
            draft["rows"], draft["cols"] = sch.rows, sch.cols
            draft["cells"] = [
                [
                    {
                        "inside": bool(sch.inside[r, c]),
                        "blocked": bool(sch.blocked[r, c]),
                        "room": int(max(rooms[r, c], 0)),
                        "object": "",
                    }
                    for c in range(sch.cols)
                ]
                for r in range(sch.rows)
            ]
            for mark in sch.marks:  # rettangoli arrotondati: oggetti occupabili, tipo da scegliere
                for r, c in mark:
                    draft["cells"][r][c]["object"] = "?"
            draft["rooms"] = [{"name": f"Stanza {i + 1}"} for i in range(int(rooms.max()) + 1)] or [{"name": "Stanza 1"}]
    if entry["personaggi"]:
        page = pipeline._load_upright(entry["personaggi"][0])
        cards = characters.read_cards(page)
        names, _ = characters.mentioned(cards)
        for card in cards:
            draft["cards"].append(
                {"letter": card.letter, "name": card.name if card.name_conf >= 60 else "", "sentence": card.sentence, "victim": card.victim, "conf": round(card.sentence_conf)}
            )
            draft["boxes"][card.letter] = list(card.box)
        # i nomi citati nelle frasi riempiono i nomi vuoti con la stessa iniziale
        for name in names:
            for card in draft["cards"]:
                if not card["name"] and card["letter"] == name[:1].upper():
                    card["name"] = name
                    break
        draft["page_size"] = list(page.shape[1::-1])
        draft["letters_by_name"] = bool(cards) and all(c.by_name for c in cards)
    # assassino e posizioni (pagina dei passaggi) costano un minuto per caso: si leggono a richiesta, dalla pagina di correzione
    return draft


def read_solution(draft: dict, entry: dict) -> list[str]:
    """Legge dalla pagina dei passaggi l'assassino e le posizioni finali e li scrive nella bozza (sostituisce quelli che c'erano).

    Usa le schede e la griglia della bozza (corrette a mano, se è il caso): le lettere da cercare e le dimensioni attese.
    Ritorna i problemi incontrati, che la pagina di correzione mostra: la lettura va controllata sulla foto."""
    from . import pipeline, solution

    if not entry.get("passaggi"):
        return ["pagina dei passaggi non abbinata a questo caso"]
    number = int(draft["number"])
    index = 0 if number % 2 == 1 else 1  # due casi per pagina: i dispari sopra, i pari sotto
    letters = [c["letter"] for c in draft["cards"]] or list("ABCDEFGHV")
    plausible = 5 <= int(draft.get("rows") or 0) <= 10 and 5 <= int(draft.get("cols") or 0) <= 10  # una griglia letta storta (3×7) farebbe sbagliare la cornice
    dims = [(draft["rows"], draft["cols"]) if plausible else None] * 2
    best, best_score = None, -1
    for name in entry["passaggi"]:  # più foto della stessa pagina: si tiene la lettura migliore
        page = pipeline._load_upright(name)
        results = solution.read_page(page, letters, dims, only=index)
        case = results[index] if index < len(results) else results[-1]
        score = len(case.pawns) + (3 if case.culprit_name else 0)
        if score > best_score:
            best, best_score = (name, case), score
    name, case = best
    draft["culprit"] = solution.culprit_letter(case.culprit_name, draft["cards"])
    order_issue = solution.alphabetical_issue(draft["cards"])
    if order_issue:
        case.issues.append(order_issue)
    draft["placements"] = [
        {"letter": p.letter, "row": p.row, "col": p.col, "conf": round(p.conf), "margin": round(p.margin, 2), "fr": [round(p.fr[0], 2), round(p.fr[1], 2)], "via": p.via, "color": [round(v, 4) for v in p.color]}
        for p in sorted(case.pawns, key=lambda p: p.letter)
        if p.row and p.col
    ]
    issues = list(case.issues)
    if case.culprit_name and not draft["culprit"]:
        issues.append(f"assassino: letto «{case.culprit_name}», ma non corrisponde a nessuna scheda")
    draft["solution_source"] = {"file": name, "culprit_name": case.culprit_name, "issues": issues, "lattice": case.lattice}
    return issues


# ----------------------------------------------------------------------------------------------- montaggio


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9à-ÿ ]", "", text.lower()).strip()


def card_names(draft: dict) -> list[str]:
    """Il nome con cui ogni scheda entra nel caso: quello scritto, o «Personaggio X» se manca."""
    names = []
    for card in draft["cards"]:
        names.append((card.get("name") or "").strip() or f"Personaggio {card['letter']}")
    return names


_catalog_cache: dict = {}


def clue_catalog() -> list[dict]:
    """I tipi di indizio che si possono comporre col menu (id, nome, parametri), letti dall'app (`tools/ml-catalog.mjs`, serve Node)."""
    if "types" not in _catalog_cache:
        node = shutil.which("node")
        if node is None:
            raise RuntimeError("Node non è installato: serve per leggere i tipi di indizio dell'app")
        done = subprocess.run([node, str(REPO_ROOT / "tools" / "ml-catalog.mjs")], capture_output=True, text=True, encoding="utf-8", timeout=60, cwd=REPO_ROOT, check=False)
        if done.returncode != 0:
            raise RuntimeError(f"il ponte dei tipi di indizio è uscito con {done.returncode}: {done.stderr.strip()}")
        _catalog_cache["types"] = json.loads(done.stdout)["types"]
    return _catalog_cache["types"]


def parse_cards(draft: dict) -> list[dict]:
    """Per ogni scheda: indizi, pezzi non capiti, codici non supportati (la grammatica sulla frase scritta nella bozza).

    Gli indizi composti col menu (`extra`: [{type, negate, params}], con i bersagli simbolici {name|object|room}) si aggiungono a quelli
    letti dalla frase; un pezzo non capito che la persona ha detto di aver coperto col menu (`covered`) non è più un problema."""
    names = card_names(draft)
    rooms = [r["name"] for r in draft["rooms"]]
    out = []
    for card in draft["cards"]:
        parsed = parse_sentence(card.get("sentence", ""), names, rooms)
        extra = [e for e in card.get("extra") or [] if isinstance(e, dict) and e.get("type")]
        covered = set(card.get("covered") or [])
        if extra:
            covered.add("")  # una scheda con un indizio composto a mano non è «vuota»
        clues = parsed.clues + [{"type": e["type"], "params": e.get("params") or {}, "negate": bool(e.get("negate")), "manual": True} for e in extra]
        out.append({"clues": clues, "unknown": [u for u in parsed.unknown if u not in covered], "unsupported": parsed.unsupported, "victim": parsed.victim})
    return out


def assemble(draft: dict) -> tuple[dict | None, list[dict], list[str], list[dict]]:
    """(caso dell'app o None, soluzione stampata [{name,row,col}] da 0, problemi, analisi di ogni scheda)."""
    problems: list[str] = []
    rows, cols = int(draft.get("rows") or 0), int(draft.get("cols") or 0)
    cards = draft["cards"]
    analysis = parse_cards(draft)
    if rows < 2 or cols < 2 or not draft["cells"]:
        return None, [], ["la griglia non c'è"], analysis
    if len(cards) < 2:
        return None, [], ["servono almeno due schede"], analysis

    names = card_names(draft)
    if len({n.lower() for n in names}) != len(names):
        problems.append("due schede hanno lo stesso nome")
    victims = [i for i, c in enumerate(cards) if c.get("victim") or analysis[i]["victim"]]
    if len(victims) != 1:
        problems.append(f"serve una sola vittima (ora {len(victims)})")

    zone_ids = [f"zone_{i}" for i in range(len(draft["rooms"]))]
    zones = [
        {"id": zone_ids[i], "name": room["name"] or f"Stanza {i + 1}", "color": ROOM_COLORS[i % len(ROOM_COLORS)], "textureId": "hatch"}
        for i, room in enumerate(draft["rooms"])
    ]
    objects, grid_cells = [], []
    for r in range(rows):
        line = []
        for c in range(cols):
            cell = draft["cells"][r][c]
            usable = cell["inside"] and not cell["blocked"]
            obj_id = None
            if usable and cell.get("object"):
                if cell["object"] == "?":
                    problems.append(f"oggetto senza tipo in R{r + 1} C{c + 1}")
                elif cell["object"] in EDGE_TYPE_IDS:
                    problems.append(f"in R{r + 1} C{c + 1} c'è una porta o finestra scelta come oggetto: si segna sul bordo, con lo strumento dei bordi")
                else:
                    obj_id = f"obj_{r}_{c}"
                    objects.append({"id": obj_id, "typeId": cell["object"], "row": r, "col": c})
            room = cell.get("room", 0)
            line.append(
                {"zoneId": zone_ids[room] if usable and 0 <= room < len(zone_ids) else None, "objectId": obj_id, "blocked": not usable}
            )
        grid_cells.append(line)

    # porte e finestre: pezzi di muro sul bordo di una casella (`edges`: tipo, riga e colonna da 0, lato N/E/S/W)
    def room_at(r: int, c: int):
        cell = draft["cells"][r][c]
        return cell.get("room", 0) if cell["inside"] and not cell["blocked"] else None

    seen: set[tuple[int, int, str]] = set()
    labels = edge_types()
    for edge in draft.get("edges") or []:
        kind, side = edge.get("type"), edge.get("side")
        r, c = edge.get("row"), edge.get("col")
        if kind not in EDGE_TYPE_IDS or side not in SIDE_STEP or not isinstance(r, int) or not isinstance(c, int) or not (0 <= r < rows and 0 <= c < cols):
            problems.append(f"una porta o finestra non è valida: {edge}")
            continue
        r, c, side = normalize_edge(r, c, side)
        dr, dc = SIDE_STEP[side]
        nr, nc = r + dr, c + dc
        outside = not (0 <= nr < rows and 0 <= nc < cols)
        here, there = room_at(r, c), None if outside else room_at(nr, nc)
        where = f"R{r + 1} C{c + 1}, lato {SIDE_NAME[side]}"
        name = labels.get(kind, kind).lower()
        if here is None and there is None:
            problems.append(f"{name} in {where}: nessuna delle due caselle è libera")
        elif not outside and here == there:
            problems.append(f"{name} in {where}: non è su un muro (le due caselle sono nella stessa stanza)")
        elif (r, c, side) in seen:
            problems.append(f"due porte o finestre sullo stesso muro in {where}")
        else:
            seen.add((r, c, side))
            objects.append({"id": f"edge_{r}_{c}_{side}", "typeId": kind, "row": r, "col": c, "side": side})

    ids = [f"char_{card['letter']}" for card in cards]
    by_name = {n.lower(): ids[i] for i, n in enumerate(names)}
    zone_by_name = {z["name"].lower(): z["id"] for z in zones}

    def who(card_index: int | None) -> str:
        return f"scheda {cards[card_index]['letter']}" if card_index is not None else "indizio generale"

    def resolve_target(target: dict | None, card_index: int | None) -> str | None:
        if target is None:
            return None
        if "name" in target:
            found = by_name.get(target["name"].lower())
            if not found:
                problems.append(f"{who(card_index)}: il nome «{target['name']}» non corrisponde a nessuna scheda")
            return found
        if "object" in target:
            return "objtype:" + target["object"]
        if "room" in target:
            found = zone_by_name.get(target["room"].lower())
            if not found:
                problems.append(f"{who(card_index)}: la stanza «{target['room']}» non è nella lista delle stanze")
            return found
        return None

    def resolve_params(params: dict, card_index: int | None) -> dict:
        out = {}
        for key, value in params.items():
            if key == "target":
                out["targetId"] = resolve_target(value, card_index)
            elif key == "room":
                out["zoneId"] = zone_by_name.get(str(value).lower())
                if out["zoneId"] is None:
                    problems.append(f"{who(card_index)}: la stanza «{value}» non è nella lista delle stanze")
            elif key in ("a", "b", "customClue") and isinstance(value, dict) and "type" in value:
                out[key] = {"type": value["type"], "params": resolve_params(value.get("params", {}), card_index)}
                if value.get("negate"):
                    out[key]["negate"] = True
            elif isinstance(value, dict) and any(k in value for k in ("name", "object", "room")):  # un bersaglio scelto col menu
                out[key] = resolve_target(value, card_index)
            else:
                out[key] = value
        return out

    clues = []
    use_own_words = (draft.get("wording") or default_wording()) == "mio"
    unsupported: list[str] = list(draft.get("unsupported") or [])
    for i, item in enumerate(analysis):
        if item["unknown"]:
            problems.append(f"scheda {cards[i]['letter']}: frase non capita ({'; '.join(u for u in item['unknown'] if u) or 'vuota'})")
        for code in item["unsupported"]:
            if code not in unsupported:
                unsupported.append(code)
        for clue in item["clues"]:
            built = {"id": f"clue_{i}_{len(clues)}", "characterId": ids[i], "type": clue["type"], "params": resolve_params(clue["params"], i)}
            if clue.get("negate"):
                built["negate"] = True
            if use_own_words and clue.get("source"):
                built["text"] = clue["source"]  # le parole scritte dalla persona, non quelle scelte dall'app
            clues.append(built)

    # gli indizi generali (un fatto sulla scena, di nessun personaggio) composti col menu: `general` della bozza
    for k, item in enumerate(e for e in draft.get("general") or [] if isinstance(e, dict) and e.get("type")):
        built = {"id": f"clue_g{k}", "characterId": None, "type": item["type"], "params": resolve_params(item.get("params") or {}, None)}
        if item.get("negate"):
            built["negate"] = True
        clues.append(built)

    characters = [
        {
            "id": ids[i], "name": names[i], "iconId": "construction", "isVictim": i in victims, "bio": "",
            "color": CHARACTER_COLORS[i % len(CHARACTER_COLORS)], "gender": None,
        }
        for i in range(len(cards))
    ]
    puzzle = {
        "schemaVersion": 4, "id": f"puzzle_ml_{draft['number']:03d}", "title": draft.get("title") or f"Caso {draft['number']}",
        "author": "", "difficulty": "medium", "completed": False, "bestTimeSeconds": None, "briefing": "", "resolutionNote": "",
        "tense": "past", "createdAt": 0, "updatedAt": 0,
        "grid": {"size": {"rows": rows, "cols": cols}, "cells": grid_cells, "zones": zones, "objects": objects},
        "characters": characters, "clues": clues, "solution": {"placements": []}, "manualHints": [],
    }

    printed: list[dict] = []
    letter_to_name = {card["letter"]: names[i] for i, card in enumerate(cards)}
    for item in draft.get("placements") or []:
        name = letter_to_name.get(item.get("letter"))
        if name and item.get("row") and item.get("col"):
            printed.append({"name": name, "row": int(item["row"]) - 1, "col": int(item["col"]) - 1})
    return puzzle, printed, problems, analysis


def check(draft: dict) -> dict:
    """Montaggio + giudizio del solver. `verdict`: ok | da_correggere | non_valido."""
    puzzle, printed, problems, analysis = assemble(draft)
    result: dict = {"problems": problems, "cards": analysis, "report": None, "unsupported": draft.get("unsupported") or []}
    if puzzle is None:
        result["verdict"] = "non_valido"
        return result
    result["unsupported"] = sorted(set(result["unsupported"]) | {c for a in analysis for c in a["unsupported"]})
    try:
        report = validate_case(puzzle, printed or None)
    except Exception as error:  # Node assente, ponte rotto: si dice, non si inventa
        result["problems"].append(f"solver non raggiungibile: {error}")
        result["verdict"] = "non_valido"
        return result
    result["report"] = report
    complete = len(printed) == len(draft["cards"]) and bool(draft.get("culprit"))
    good = report.get("ok") and not problems and not result["unsupported"] and complete
    by_solver = [p["letter"] for p in draft.get("placements") or [] if p.get("via") == "solver"]
    if by_solver:  # una posizione scelta dal solver non può poi dimostrare che il solver ha ragione
        result["problems"].append("posizioni scelte dal solver (" + ", ".join(by_solver) + "): confrontale con la foto e correggile a mano se serve")
        good = False
    result["verdict"] = "ok" if good else "da_correggere"
    result["printed_complete"] = complete
    return result


def _doubtful(p: dict) -> bool:
    return p.get("conf", 100) < 60 or p.get("margin", 0) > 0.3 or p.get("via") == "testo"


def refine_with_solver(draft: dict) -> dict:
    """Il solver come arbitro fra caselle vicine: se il caso (come scritto nella bozza) ha UNA soluzione, ogni pedina dubbia (lettera
    letta con poca sicurezza, vicina a un bordo, spostata dal testo) che la soluzione mette in una casella a meno di una casella di distanza
    dalla posizione fotografata viene portata lì. Le pedine sicure non si toccano, e se non coincidono con la soluzione si lascia il dubbio
    all'esito (`mismatches`). Segna `via: "solver"`: il verdetto non diventa `ok` finché non le confermi a mano.
    Ritorna {changed:[{letter,from,to}], notes:[…]}; modifica `draft["placements"]`."""
    import math

    notes: list[str] = []
    puzzle, _, problems, _ = assemble(draft)
    if puzzle is None:
        return {"changed": [], "notes": ["il caso non è ancora completo: " + "; ".join(problems)]}
    try:
        report = validate_case(puzzle, None)
    except Exception as error:
        return {"changed": [], "notes": [f"solver non raggiungibile: {error}"]}
    if not report.get("unique"):
        count = report.get("solutionCount")
        return {"changed": [], "notes": [f"il caso ha {count if count is not None else 'nessuna'} soluzioni: il solver non può arbitrare (finisci prima le schede)"]}
    names = dict(zip((c["letter"] for c in draft["cards"]), card_names(draft)))
    solved = {s["name"]: (s["row"] + 1, s["col"] + 1) for s in report["solution"]}
    changed = []
    for p in draft.get("placements") or []:
        target = solved.get(names.get(p["letter"], ""))
        if not target or not p.get("row") or not p.get("col"):
            continue
        here = (int(p["row"]), int(p["col"]))
        if here == target:
            continue
        fr = p.get("fr")
        close = fr is not None and math.hypot(fr[0] - target[0], fr[1] - target[1]) <= 1.0
        if _doubtful(p) and close:
            changed.append({"letter": p["letter"], "from": list(here), "to": list(target)})
            p["row"], p["col"], p["via"] = target[0], target[1], "solver"
        elif _doubtful(p):
            notes.append(f"{p['letter']}: la soluzione la mette in R{target[0]} C{target[1]}, lontano da R{here[0]} C{here[1]} (letta): controlla la foto")
        else:
            notes.append(f"{p['letter']}: letta in R{here[0]} C{here[1]} con sicurezza, ma la soluzione trovata dal solver è R{target[0]} C{target[1]}: o la lettura o gli indizi sono sbagliati")
    return {"changed": changed, "notes": notes}


def accept(draft: dict) -> dict:
    """Scrive il record `lavoro/record/NNN.record.json` col caso corretto. `verificato` solo se tutto torna (è un caso d'oro)."""
    outcome = check(draft)
    puzzle, printed, _, _ = assemble(draft)
    record = new_record(int(draft["number"]), puzzle)
    record["source"]["title"] = draft.get("title", "")
    culprit_letter = draft.get("culprit") or ""
    names = {c["letter"]: n for c, n in zip(draft["cards"], card_names(draft))}
    record["printed"] = {"culprit": names.get(culprit_letter), "placements": printed, "steps": []}
    record["unsupported"] = outcome["unsupported"]
    record["extraction"]["report"] = outcome["report"]
    record["extraction"]["issues"] = outcome["problems"]
    status = "verificato" if outcome["verdict"] == "ok" else "incerto"
    record["extraction"]["status"] = status
    if puzzle is None:
        record["extraction"]["status"] = "scartato"
    out_dir = config.work_dir() / "record"
    out_dir.mkdir(exist_ok=True)
    path = out_dir / f"{int(draft['number']):03d}.record.json"
    save_record(record, path)
    return {"status": record["extraction"]["status"], "path": str(path), "verdict": outcome["verdict"]}
