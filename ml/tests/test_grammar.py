"""La grammatica contro frasi vere del libro (caso 1 «Nella locanda del viandante» e altre viste nelle foto)."""

import pytest

from reader.grammar import parse_sentence

NAMES = ["Alice", "Bors", "Clemenza", "Dionigi", "Erbin", "Vilfredo"]
ROOMS = ["Cucina", "Camera", "Sala da pranzo"]


def clues(sentence, **kw):
    parsed = parse_sentence(sentence, NAMES, ROOMS)
    return parsed, [(c["type"], c["params"], c.get("negate", False)) for c in parsed.clues]


def test_seduta_su_una_sedia():
    parsed, found = clues("Era seduta su una sedia.")
    assert found == [("onObjectType", {"objectTypeId": "chair"}, False)] and not parsed.unknown


def test_prima_colonna():
    _, found = clues("Era nella prima colonna.")
    assert found == [("inRowOrCol", {"axis": "col", "index": 1}, False)]


def test_due_direzioni_in_una_frase():
    _, found = clues("Era a sud di Clemenza e a est di Vilfredo.")
    assert found == [
        ("directionDistance", {"direction": "south", "target": {"name": "Clemenza"}}, False),
        ("directionDistance", {"direction": "east", "target": {"name": "Vilfredo"}}, False),
    ]


def test_stanza():
    _, found = clues("Era nella Cucina.")
    assert found == [("inRoom", {"room": "Cucina"}, False)]


def test_vittima_sola_con_assassino():
    parsed, found = clues("La vittima. Era solo con l'assassino.")
    assert parsed.victim and found == [] and not parsed.unknown


@pytest.mark.parametrize(
    "frase",
    [
        "La vittima. Era nell'ultima casella rimasta.",
        "La vittima. Era nell'ultima casella rimasta, sola con l'assassino.",
        "La vittima. Era nell'ultima casella libera.",
        "La vittima. Era nell'ultima casella libera, solo con l'assassino.",
        "La vittima. Era nell'ultima casella che restava.",
        "La vittima. Era nell'ultima casella rimasta libera.",
        "La vittima. Si trovava nell'ultima casella disponibile.",
        "Era nell'ultima casella libera.",
    ],
)
def test_ultima_casella_libera_e_la_frase_della_vittima(frase):
    parsed, found = clues(frase)
    assert parsed.victim and found == [] and not parsed.unknown and not parsed.unsupported


def test_sedia_o_leone_e_non_supportato():
    parsed, found = clues("Era seduto su una sedia o su un leone.")
    assert found == [] and "animals" in parsed.unsupported


def test_sedia_o_tavolo_diventa_orClue():
    _, found = clues("Era seduto su una sedia o su un tavolo.")
    assert found and found[0][0] == "orClue"


def test_accanto_a_un_oggetto_e_a_un_personaggio():
    _, found = clues("Era accanto a una colonna.")  # «colonna» non è un oggetto dell'app
    assert found == []
    _, found = clues("Era accanto a Bors.")
    assert found == [("adjacent", {"target": {"name": "Bors"}}, False)]
    _, found = clues("Era accanto a un tavolo.")
    assert found == [("adjacent", {"target": {"object": "table"}}, False)]


def test_negazione():
    _, found = clues("Non era accanto a Bors.")
    assert found == [("adjacent", {"target": {"name": "Bors"}}, True)]


def test_frase_sconosciuta_non_si_indovina():
    parsed, found = clues("Mangiava una mela con Bors.")
    assert found == [] and parsed.unknown


def test_distanza_esplicita():
    _, found = clues("Era a due colonne a ovest di Alice.")
    assert found == [("directionDistance", {"direction": "west", "distance": 2, "target": {"name": "Alice"}}, False)]


def test_sola_e_sola_con():
    _, found = clues("Non era sola.")
    assert found == [("aloneInRoom", {}, True)]
    _, found = clues("Era sola.")
    assert found == [("aloneInRoom", {}, False)]
    _, found = clues("Era solo con Bors.")
    assert found == [("aloneWithPerson", {"target": {"name": "Bors"}}, False)]


def test_in_sella_a_un_cavallo():
    parsed, found = clues("Era in sella a un cavallo.")
    assert found == [("onObjectType", {"objectTypeId": "horse"}, False)] and not parsed.unsupported
    _, found = clues("Era seduta su una sedia o in sella a un cavallo.")
    assert found and found[0][0] == "orClue"


def test_accanto_a_un_animale_e_agli_altri_oggetti_all_aperto():
    _, found = clues("Era accanto a un animale.")
    assert found == [("adjacent", {"target": {"object": "#animal"}}, False)]
    _, found = clues("Era accanto a una mucca.")
    assert found == [("adjacent", {"target": {"object": "cow"}}, False)]
    _, found = clues("Era su una pozza di fango.")
    assert found == [("onObjectType", {"objectTypeId": "mud"}, False)]


def test_si_trovava_sul_tappeto_e_sul_letto():
    for sentence, obj in [
        ("Si trovava sul tappeto.", "carpet"),
        ("Si trovava sul letto", "bed"),
        ("si trovava sulla panca", "bench"),
        ("Si trovava sullo sgabello.", "stool"),
        ("Si trovava sull'incudine.", "anvil"),
        ("Era sul tappeto.", "carpet"),
        ("Stava su un letto.", "bed"),
        ("Si trovava sopra il tappeto.", "carpet"),
        ("Era sdraiato sul letto.", "bed"),
        ("Era seduta sulla sedia.", "chair"),
    ]:
        parsed, found = clues(sentence)
        assert found == [("onObjectType", {"objectTypeId": obj}, False)] and not parsed.unknown, sentence


def test_non_si_trovava_e_altri_verbi():
    _, found = clues("Non si trovava sul tappeto.")
    assert found == [("onObjectType", {"objectTypeId": "carpet"}, True)]
    _, found = clues("Si trovava accanto al tappeto e a est di Bors.")
    assert found == [
        ("adjacent", {"target": {"object": "carpet"}}, False),
        ("directionDistance", {"direction": "east", "target": {"name": "Bors"}}, False),
    ]
    _, found = clues("Si trovava nella Cucina.")
    assert found == [("inRoom", {"room": "Cucina"}, False)]


def test_sul_tappeto_o_sul_letto():
    _, found = clues("Si trovava sul tappeto o sul letto.")
    assert [c[0] for c in found] == ["orClue"]
    _, found = clues("Era sul tappeto e sul letto.")  # due oggetti insieme: due indizi, la soluzione dirà se è possibile
    assert [c[0] for c in found] == ["onObjectType", "onObjectType"]


def test_in_mare_e_a_terra():
    _, found = clues("Era in mare.")
    assert found == [("inSea", {}, False)]
    _, found = clues("Era a terra.")
    assert found == [("inSea", {}, True)]  # «a terra» è «in mare» negato
    _, found = clues("Non era a terra.")
    assert found == [("inSea", {}, False)]
    _, found = clues("Non era in mare.")
    assert found == [("inSea", {}, True)]


def test_su_una_nave():
    parsed, found = clues("Era su una nave.")
    assert found == [("onShip", {}, False)] and not parsed.unknown
    _, found = clues("Non era su una nave.")
    assert found == [("onShip", {}, True)]
    _, found = clues("Era in mare e a est di Bors.")
    assert [f[0] for f in found] == ["inSea", "directionDistance"]


@pytest.mark.parametrize(
    "sentence, object_type",
    [
        ("Era seduta su una zattera.", "raft"),
        ("Era sdraiato su un'amaca.", "hammock"),
        ("Era sulla sabbia.", "sand"),
        ("Era sopra una cassa.", "crate"),
    ],
)
def test_oggetti_dei_pirati(sentence, object_type):
    parsed, found = clues(sentence)
    assert found == [("onObjectType", {"objectTypeId": object_type}, False)] and not parsed.unknown


@pytest.mark.parametrize("word, object_type", [("maiale", "pig"), ("squalo", "shark"), ("masso", "rock"), ("cannone", "cannon")])
def test_accanto_a_un_oggetto_dei_pirati(word, object_type):
    _, found = clues(f"Era accanto a un {word}.")
    assert found == [("adjacent", {"target": {"object": object_type}}, False)]


def test_il_pappagallo_non_e_ancora_supportato():
    parsed, found = clues("Era accanto a un pappagallo.")
    assert not found and parsed.unsupported == ["parrot"]


# ---- «Nella sua stanza c'era un …»
def test_nella_sua_stanza_c_era_un_oggetto():
    parsed, found = clues("Nella sua stanza c'era un tavolo.")
    assert found == [("objectInRoom", {"objectTypeId": "table"}, False)] and not parsed.unknown and not parsed.unsupported
    _, found = clues("Nella sua stanza non c'era una sedia.")
    assert found == [("objectInRoom", {"objectTypeId": "chair"}, True)]
    _, found = clues("Nella stanza c'è una finestra.")
    assert found == [("objectInRoom", {"objectTypeId": "window"}, False)]


def test_nella_sua_stanza_c_era_un_pappagallo_non_e_supportato_e_un_animale_qualunque_non_si_capisce():
    parsed, found = clues("Nella sua stanza c'era un pappagallo.")
    assert not found and parsed.unsupported == ["parrot"]
    parsed, found = clues("Nella sua stanza c'era un animale.")
    assert not found and parsed.unknown


# ---- «accanto a un muro» e «l'unica persona…»
def test_accanto_a_un_muro_e_il_suo_contrario():
    parsed, found = clues("Era accanto a un muro.")
    assert found == [("nextToWall", {}, False)] and not parsed.unknown and not parsed.unsupported
    parsed, found = clues("Non era accanto a un muro.")
    assert found == [("nextToWall", {}, True)] and not parsed.unsupported


def test_unica_persona_accanto_a_una_finestra():
    parsed, found = clues("Era l'unica persona accanto a una finestra.")
    assert found == [("onlyOneWithProperty", {"property": "adjacentTo", "target": {"object": "window"}}, False)]
    assert not parsed.unknown and not parsed.unsupported
    _, found = clues("Era l'unica persona vicino a Bors.")
    assert found == [("onlyOneWithProperty", {"property": "adjacentTo", "target": {"name": "Bors"}}, False)]


def test_unica_persona_seduta_e_genere():
    _, found = clues("Era l'unica persona seduta su una sedia.")
    assert found == [("onlyOneWithProperty", {"property": "sittingOn", "objectTypeId": "chair"}, False)]
    _, found = clues("Era l'unica persona seduta.")
    assert found == [("onlyOneWithProperty", {"property": "seated"}, False)]
    _, found = clues("Era l'unica donna.")
    assert found == [("onlyOneWithProperty", {"property": "female"}, False)]
    _, found = clues("Non era l'unico uomo.")
    assert found == [("onlyOneWithProperty", {"property": "male"}, True)]


def test_unica_persona_con_un_altra_condizione_e_indizio_annidato():
    _, found = clues("Era l'unica persona su un tappeto.")
    assert found == [("onlyOneWithProperty", {"property": "custom", "customClue": {"type": "onObjectType", "params": {"objectTypeId": "carpet"}}}, False)]
    _, found = clues("Era l'unica persona nella Cucina.")
    assert found[0][1]["customClue"] == {"type": "inRoom", "params": {"room": "Cucina"}}


def test_unica_persona_non_capita_o_non_supportata():
    parsed, found = clues("Era l'unica persona che mangiava una mela.")
    assert found == [] and parsed.unknown
    parsed, found = clues("Era l'unica persona accanto a un leone.")
    assert found == [] and parsed.unsupported == ["animals"] and not parsed.unknown
