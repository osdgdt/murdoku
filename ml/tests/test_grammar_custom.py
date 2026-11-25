"""La grammatica personale (`grammatica.json`): parole, verbi e frasi che la persona aggiunge a quelle del programma."""

import json

import pytest

from reader import grammar
from reader.grammar import parse_sentence

NAMES = ["Alice", "Bors", "Clemenza"]
ROOMS = ["Cucina", "Sala da pranzo"]


@pytest.fixture(autouse=True)
def senza_grammatica_personale():
    yield
    grammar.set_custom(None)


def found(sentence):
    parsed = parse_sentence(sentence, NAMES, ROOMS)
    return parsed, [(c["type"], c["params"], c.get("negate", False)) for c in parsed.clues]


def test_una_parola_in_piu_per_un_oggetto():
    _, trovati = found("Era sul pagliericcio.")
    assert trovati == []
    grammar.set_custom({"oggetti": {"pagliericcio": "pallet"}})
    _, trovati = found("Era sul pagliericcio.")
    assert trovati == [("onObjectType", {"objectTypeId": "pallet"}, False)]


def test_un_verbo_in_piu():
    grammar.set_custom({"verbi": ["si accomodava"]})
    _, trovati = found("Si accomodava sul tappeto.")
    assert trovati == [("onObjectType", {"objectTypeId": "carpet"}, False)]
    _, trovati = found("Non si accomodava sul tappeto.")
    assert trovati == [("onObjectType", {"objectTypeId": "carpet"}, True)]


def test_una_frase_con_un_buco_oggetto():
    grammar.set_custom({"frasi": [{"se": "riposava sul {oggetto}", "indizio": "onObjectType"}]})
    parsed, trovati = found("Riposava sul letto.")
    assert trovati == [("onObjectType", {"objectTypeId": "bed"}, False)] and not parsed.unknown
    _, trovati = found("Non riposava sul letto")  # col «non» davanti vale il contrario
    assert trovati == [("onObjectType", {"objectTypeId": "bed"}, True)]


def test_frasi_con_persona_direzione_distanza_e_stanza():
    grammar.set_custom(
        {
            "frasi": [
                {"se": "stava a {direzione} di {persona}", "indizio": "directionDistance"},
                {"se": "stava {n} caselle a {direzione} di {persona}", "indizio": "directionDistance"},
                {"se": "bivaccava in {stanza}", "indizio": "inRoom"},
                {"se": "dormiva", "indizio": "onObjectType", "parametri": {"objectTypeId": "bed"}},
                {"se": "faceva la guardia a {oggetto}", "indizio": "adjacent"},
            ]
        }
    )
    assert found("Stava a nord di Bors.")[1] == [("directionDistance", {"direction": "north", "target": {"name": "Bors"}}, False)]
    assert found("Stava due caselle a est di Alice.")[1] == [
        ("directionDistance", {"direction": "east", "distance": 2, "target": {"name": "Alice"}}, False)
    ]
    assert found("Bivaccava in cucina.")[1] == [("inRoom", {"room": "Cucina"}, False)]
    assert found("Dormiva.")[1] == [("onObjectType", {"objectTypeId": "bed"}, False)]
    assert found("Faceva la guardia a un tavolo.")[1] == [("adjacent", {"target": {"object": "table"}}, False)]


def test_un_buco_che_non_si_capisce_non_indovina():
    grammar.set_custom({"frasi": [{"se": "stava a {direzione} di {persona}", "indizio": "directionDistance"}]})
    parsed, trovati = found("Stava a nord di Pinco.")  # nessun personaggio si chiama così
    assert trovati == [] and parsed.unknown


def test_le_frasi_scritte_dalla_persona_restano_come_testo_dell_indizio():
    parsed = parse_sentence("si trovava sul tappeto e a est di Bors", NAMES, ROOMS)
    assert [c["source"] for c in parsed.clues] == ["Si trovava sul tappeto.", "A est di Bors."]


def test_il_testo_dell_indizio_nel_caso_dell_app():
    from reader import draft

    bozza = draft.blank_draft(1, "Prova")
    bozza.update(rows=2, cols=2, rooms=[{"name": "Cucina"}])
    bozza["cells"] = [[{"inside": True, "blocked": False, "room": 0, "object": "carpet" if (r, c) == (0, 0) else None} for c in range(2)] for r in range(2)]
    bozza["cards"] = [
        {"letter": "A", "name": "Alice", "sentence": "Si trovava sul tappeto.", "victim": False},
        {"letter": "V", "name": "Bors", "sentence": "La vittima.", "victim": True},
    ]
    puzzle, _, _, _ = draft.assemble(bozza)
    assert "text" not in puzzle["clues"][0]  # predefinito: le parole le sceglie l'app
    bozza["wording"] = "mio"
    puzzle, _, _, _ = draft.assemble(bozza)
    assert puzzle["clues"][0]["text"] == "Si trovava sul tappeto."


def test_errori_di_scrittura_si_spiegano():
    for broken in ({"frasi": [{"se": "x"}]}, {"frasi": [{"se": "a {colore}", "indizio": "onObjectType"}]}, {"testo_indizi": "boh"}, [1]):
        grammar.set_custom(broken)
        with pytest.raises(ValueError):
            grammar.custom()


def test_il_file_nella_cartella_dei_dati(tmp_path, monkeypatch):
    monkeypatch.setenv("MURDOKU_DATA", str(tmp_path))
    grammar._custom_cache.update(key=None)
    assert grammar.custom()["frasi"] == []
    (tmp_path / "grammatica.json").write_text(json.dumps({"testo_indizi": "mio", "oggetti": {"tappetino": "carpet"}}), encoding="utf-8")
    assert grammar.default_wording() == "mio"
    assert found("Era sul tappetino.")[1] == [("onObjectType", {"objectTypeId": "carpet"}, False)]
    (tmp_path / "grammatica.json").write_text("{ non json", encoding="utf-8")
    with pytest.raises(ValueError):
        grammar.custom()
