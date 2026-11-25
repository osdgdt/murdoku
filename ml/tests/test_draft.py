"""La bozza corretta a mano → caso dell'app → giudizio del solver (serve Node, come test_validate)."""

import shutil

import pytest

from reader import draft as D

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="Node non installato")


def tiny_draft():
    """3×3, una stanza sola, due personaggi: Anna in una sedia, Bors (la vittima) sola con l'assassino."""
    cells = [[{"inside": True, "blocked": False, "room": 0, "object": ""} for _ in range(3)] for _ in range(3)]
    cells[0][0]["object"] = "chair"
    d = D.blank_draft(1, "Prova")
    d.update(rows=3, cols=3, cells=cells, rooms=[{"name": "Sala"}])
    d["cards"] = [
        {"letter": "A", "name": "Anna", "sentence": "Era seduta su una sedia.", "victim": False},
        {"letter": "V", "name": "Bors", "sentence": "La vittima. Era solo con l'assassino.", "victim": True},
    ]
    return d


def test_assemble_costruisce_il_caso():
    puzzle, printed, problems, analysis = D.assemble(tiny_draft())
    assert problems == []
    assert [c["name"] for c in puzzle["characters"]] == ["Anna", "Bors"]
    assert puzzle["characters"][1]["isVictim"] is True
    assert [c["type"] for c in puzzle["clues"]] == ["onObjectType"] and puzzle["clues"][0]["params"] == {"objectTypeId": "chair"}
    assert puzzle["grid"]["objects"] == [{"id": "obj_0_0", "typeId": "chair", "row": 0, "col": 0}]


def test_oggetto_senza_tipo_e_nome_sconosciuto_sono_problemi():
    d = tiny_draft()
    d["cells"][1][1]["object"] = "?"
    d["cards"][0]["sentence"] = "Era a sud di Zeno."
    _, _, problems, _ = D.assemble(d)
    assert any("senza tipo" in p for p in problems) and any("Zeno" in p for p in problems)


def test_frase_non_capita_e_non_supportata_si_vedono():
    d = tiny_draft()
    d["cards"][0]["sentence"] = "Mangiava una mela."
    _, _, problems, analysis = D.assemble(d)
    assert analysis[0]["unknown"] and any("non capita" in p for p in problems)
    d["cards"][0]["sentence"] = "Era seduta su una sedia o su un leone."
    assert D.check(d)["unsupported"] == ["animals"]


def test_i_luoghi_si_risolvono_per_nome():
    d = tiny_draft()
    d["cards"][0]["sentence"] = "Era nella Sala."
    puzzle, _, problems, _ = D.assemble(d)
    assert problems == [] and puzzle["clues"][0]["params"] == {"zoneId": "zone_0"}


@needs_node
def test_check_chiama_il_solver():
    d = tiny_draft()
    d["culprit"] = "A"
    d["placements"] = [{"letter": "A", "row": 1, "col": 1}, {"letter": "V", "row": 2, "col": 2}]
    result = D.check(d)
    assert result["report"] is not None and result["verdict"] in ("ok", "da_correggere")


def test_solver_arbitro_sposta_solo_le_pedine_dubbie_vicine(monkeypatch):
    d = tiny_draft()
    d["placements"] = [
        {"letter": "A", "row": 1, "col": 1, "conf": 30, "margin": 0.2, "fr": [1.4, 1.0]},  # dubbia, vicina alla soluzione (R2 C1)
        {"letter": "V", "row": 3, "col": 3, "conf": 95, "margin": 0.1, "fr": [3.0, 3.0]},  # sicura e coincide
    ]
    report = {"unique": True, "solutionCount": 1, "solution": [{"name": "Anna", "row": 1, "col": 0}, {"name": "Bors", "row": 2, "col": 2}]}
    monkeypatch.setattr(D, "validate_case", lambda puzzle, printed=None, **kw: report)
    outcome = D.refine_with_solver(d)
    assert outcome["changed"] == [{"letter": "A", "from": [1, 1], "to": [2, 1]}]
    assert (d["placements"][0]["row"], d["placements"][0]["via"]) == (2, "solver")
    assert "via" not in d["placements"][1]


def test_solver_arbitro_non_tocca_pedine_sicure_ne_lontane(monkeypatch):
    d = tiny_draft()
    d["placements"] = [
        {"letter": "A", "row": 1, "col": 1, "conf": 30, "margin": 0.2, "fr": [1.0, 1.0]},  # dubbia ma la soluzione è lontana
        {"letter": "V", "row": 3, "col": 3, "conf": 95, "margin": 0.1, "fr": [3.0, 3.0]},  # sicura ma la soluzione dice altro
    ]
    report = {"unique": True, "solutionCount": 1, "solution": [{"name": "Anna", "row": 2, "col": 2}, {"name": "Bors", "row": 2, "col": 1}]}
    monkeypatch.setattr(D, "validate_case", lambda puzzle, printed=None, **kw: report)
    outcome = D.refine_with_solver(d)
    assert outcome["changed"] == [] and len(outcome["notes"]) == 2
    assert (d["placements"][0]["row"], d["placements"][1]["row"]) == (1, 3)


def test_senza_soluzione_unica_il_solver_non_arbitra(monkeypatch):
    d = tiny_draft()
    d["placements"] = [{"letter": "A", "row": 1, "col": 1, "conf": 30, "fr": [1.4, 1.0]}]
    monkeypatch.setattr(D, "validate_case", lambda puzzle, printed=None, **kw: {"unique": False, "solutionCount": 4, "solution": []})
    outcome = D.refine_with_solver(d)
    assert outcome["changed"] == [] and "4 soluzioni" in outcome["notes"][0]
