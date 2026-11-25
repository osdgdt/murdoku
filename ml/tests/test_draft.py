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


def two_rooms_draft():
    """Come tiny_draft, ma con due stanze (colonna 0 e 1 nella prima, colonna 2 nella seconda): un muro in mezzo, fra le colonne 1 e 2."""
    d = tiny_draft()
    for r in range(3):
        d["cells"][r][2]["room"] = 1
    d["rooms"] = [{"name": "Sala"}, {"name": "Studio"}]
    return d


def test_porte_e_finestre_si_segnano_sul_bordo_e_diventano_oggetti_con_il_lato():
    d = two_rooms_draft()
    d["edges"] = [
        {"type": "door", "row": 1, "col": 1, "side": "E"},  # il muro fra le due stanze
        {"type": "window", "row": 0, "col": 0, "side": "N"},  # il bordo della mappa
        {"type": "window", "row": 2, "col": 2, "side": "S"},
    ]
    puzzle, _, problems, _ = D.assemble(d)
    assert problems == []
    edges = [o for o in puzzle["grid"]["objects"] if o["typeId"] in ("door", "window")]
    assert [(o["typeId"], o["row"], o["col"], o["side"]) for o in edges] == [("door", 1, 1, "E"), ("window", 0, 0, "N"), ("window", 2, 2, "S")]
    # il bordo è scritto come nell'app: il lato W di una casella è il lato E di quella a sinistra
    d["edges"] = [{"type": "door", "row": 1, "col": 2, "side": "W"}]
    puzzle, _, problems, _ = D.assemble(d)
    assert problems == []
    assert [(o["row"], o["col"], o["side"]) for o in puzzle["grid"]["objects"] if o["typeId"] == "door"] == [(1, 1, "E")]


def test_porta_non_su_un_muro_o_doppia_o_senza_caselle_libere_sono_problemi():
    d = two_rooms_draft()
    d["edges"] = [{"type": "door", "row": 1, "col": 0, "side": "E"}]  # fra due caselle della stessa stanza
    assert any("non è su un muro" in p for p in D.assemble(d)[2])
    d["edges"] = [{"type": "door", "row": 1, "col": 1, "side": "E"}, {"type": "window", "row": 1, "col": 2, "side": "W"}]  # lo stesso muro due volte
    assert any("stesso muro" in p for p in D.assemble(d)[2])
    d["edges"] = [{"type": "door", "row": 0, "col": 0, "side": "E"}, {"type": "table", "row": 0, "col": 0, "side": "N"}]
    assert any("non è valida" in p for p in D.assemble(d)[2])
    d = two_rooms_draft()
    d["cells"][0][0]["blocked"] = True
    d["cells"][0][1]["blocked"] = True
    d["edges"] = [{"type": "window", "row": 0, "col": 0, "side": "E"}]  # il muro fra due caselle bloccate
    assert any("nessuna delle due" in p for p in D.assemble(d)[2])


def test_porta_e_finestra_non_sono_oggetti_di_casella():
    assert "door" not in D.object_types() and "window" not in D.object_types()
    assert D.edge_types() == {"door": "Porta", "window": "Finestra"}
    d = tiny_draft()
    d["cells"][1][1]["object"] = "door"  # una bozza vecchia, scelta dall'elenco degli oggetti
    assert any("bordo" in p for p in D.assemble(d)[2])


@needs_node
def test_la_porta_sul_bordo_passa_il_controllo_di_forma_dell_app():
    d = two_rooms_draft()
    d["edges"] = [{"type": "door", "row": 1, "col": 1, "side": "E"}, {"type": "window", "row": 0, "col": 0, "side": "N"}]
    result = D.check(d)
    assert result["problems"] == []
    assert not [p for p in (result["report"] or {}).get("problems", []) if "porta" in p.lower() or "finestra" in p.lower() or "muro" in p.lower()]


# ---- indizi composti col menu (quando la frase non si capisce)
def test_indizio_col_menu_si_aggiunge_a_quelli_della_frase_e_si_risolve():
    d = tiny_draft()
    d["cards"][0]["sentence"] = "Era seduta su una sedia. Mangiava una mela."
    d["cards"][0]["extra"] = [
        {"type": "adjacent", "negate": True, "params": {"targetId": {"name": "Bors"}}},
        {"type": "inRoom", "negate": False, "params": {"zoneId": {"room": "Sala"}}},
        {"type": "directionDistance", "negate": False, "params": {"direction": "south", "targetId": {"object": "chair"}}},
    ]
    puzzle, _, problems, analysis = D.assemble(d)
    mine = [c for c in puzzle["clues"] if c["type"] != "onObjectType"]
    assert [c["type"] for c in mine] == ["adjacent", "inRoom", "directionDistance"]
    assert mine[0]["params"] == {"targetId": "char_V"} and mine[0]["negate"] is True
    assert mine[1]["params"] == {"zoneId": "zone_0"} and "negate" not in mine[1]
    assert mine[2]["params"] == {"direction": "south", "targetId": "objtype:chair"}
    assert "text" not in mine[0]  # nessuna frase del libro: l'app sceglie le sue parole
    assert [c.get("manual") for c in analysis[0]["clues"]] == [None, True, True, True]
    assert any("non capita" in p for p in problems)  # la frase «Mangiava una mela» resta un pezzo non capito…


def test_pezzo_non_capito_coperto_col_menu_non_e_piu_un_problema():
    d = tiny_draft()
    d["cards"][0]["sentence"] = "Era seduta su una sedia. Mangiava una mela."
    unknown = D.assemble(d)[3][0]["unknown"]
    assert unknown and unknown[0]
    d["cards"][0]["covered"] = list(unknown)
    _, _, problems, analysis = D.assemble(d)
    assert analysis[0]["unknown"] == [] and not any("non capita" in p for p in problems)


def test_scheda_vuota_con_un_indizio_col_menu_non_e_vuota():
    d = tiny_draft()
    d["cards"][0]["sentence"] = ""
    assert any("vuota" in p for p in D.assemble(d)[2])
    d["cards"][0]["extra"] = [{"type": "inCorner", "negate": False, "params": {}}]
    _, _, problems, _ = D.assemble(d)
    assert problems == []


def test_bersaglio_del_menu_sconosciuto_e_un_problema():
    d = tiny_draft()
    d["cards"][0]["extra"] = [{"type": "adjacent", "negate": False, "params": {"targetId": {"name": "Zeno"}}}]
    assert any("Zeno" in p for p in D.assemble(d)[2])


@needs_node
def test_il_catalogo_dei_tipi_viene_dall_app():
    types = {t["id"]: t for t in D.clue_catalog()}
    assert {"adjacent", "inRoom", "directionDistance", "inCorner", "nextToWall"} <= set(types)
    assert [p["kind"] for p in types["adjacent"]["params"]] == ["characterOrObject"]
    direction = next(p for p in types["directionDistance"]["params"] if p["name"] == "direction")
    assert {v["value"] for v in direction["values"]} == {"north", "south", "east", "west"}
    assert "hasRole" not in types and "orClue" not in types  # quelli che non si fanno col menu semplice


def test_indizio_generale_col_menu_non_ha_personaggio_e_si_risolve():
    d = tiny_draft()
    d["general"] = [
        {"type": "noOneInRoom", "negate": False, "params": {"zoneId": {"room": "Sala"}}},
        {"type": "noOneNear", "negate": True, "params": {"targetId": {"object": "chair"}}},
        {"type": "noOneWithProperty", "negate": False, "params": {"property": "sittingOn", "objectTypeId": "chair", "onlyGender": "female"}},
    ]
    puzzle, _, problems, _ = D.assemble(d)
    assert problems == []
    generic = [c for c in puzzle["clues"] if c["characterId"] is None]
    assert [c["type"] for c in generic] == ["noOneInRoom", "noOneNear", "noOneWithProperty"]
    assert generic[0]["params"] == {"zoneId": "zone_0"}
    assert generic[1]["params"] == {"targetId": "objtype:chair"} and generic[1]["negate"] is True
    assert generic[2]["params"]["onlyGender"] == "female"


def test_indizio_generale_con_bersaglio_sconosciuto_e_un_problema():
    d = tiny_draft()
    d["general"] = [{"type": "noOneNear", "negate": False, "params": {"targetId": {"name": "Zeno"}}}]
    assert any("indizio generale" in p and "Zeno" in p for p in D.assemble(d)[2])


@needs_node
def test_il_catalogo_ha_i_tipi_generali_e_le_proprieta_senza_la_condizione_annidata():
    types = {t["id"]: t for t in D.clue_catalog()}
    assert types["noOneInRoom"]["scope"] == "generic" and types["adjacent"]["scope"] == "character"
    prop = types["noOneWithProperty"]
    names = {p["name"]: p for p in prop["params"]}
    assert "customClue" not in names and "custom" not in {v["value"] for v in names["property"]["values"]}
    assert names["targetId"]["showIf"] == {"property": "adjacentTo"} and names["objectTypeId"]["showIf"] == {"property": "sittingOn"}
    assert names["zoneId"]["optional"] is True and names["onlyGender"]["optional"] is True
    assert "" not in {v["value"] for v in names["onlyGender"]["values"]}
