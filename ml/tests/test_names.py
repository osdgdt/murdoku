"""Nomi in corsivo → lettere dei personaggi (nessuna foto: letture finte)."""

import numpy as np

from reader.characters import Card
from reader.names import best_reading, find_blobs, known_names, letters_from_names, match_name


def card(name, conf=100, victim=False):
    return Card(name=name, name_conf=conf, sentence="Era qui.", sentence_conf=90, box=(0, 0, 10, 10), victim=victim)


def test_lettere_dall_ordine_alfabetico_dei_nomi():
    cards = [card("Alessandro"), card("Clarissa"), card("Battista"), card("Diana"), card("Valentino", victim=True)]
    assert letters_from_names(cards)
    assert {c.name: c.letter for c in cards} == {"Alessandro": "A", "Battista": "B", "Clarissa": "C", "Diana": "D", "Valentino": "V"}


def test_senza_tutti_i_nomi_le_lettere_non_si_toccano():
    cards = [card("Alessandro"), card("", 0), card("Battista")]
    for i, c in enumerate(cards):
        c.letter = "ABC"[i]
    assert not letters_from_names(cards)
    assert [c.letter for c in cards] == ["A", "B", "C"]
    assert not letters_from_names([card("Anna"), card("Anna")])  # due nomi uguali: non si ordina
    assert not letters_from_names([card("Anna"), card("Bruno", 40)])  # lettura incerta


def test_il_nome_si_corregge_con_i_nomi_noti():
    names = known_names()
    assert "Elsa" in names and "Alessandro" in names
    assert match_name("Alessandra", names)[0] in ("Alessandra", "Alessandro")
    # la «A» maiuscola in corsivo si legge «q»; fra più letture vince quella che somiglia a un nome
    name, conf = best_reading([("qchille", 45.0), ("Foo", 30.0)], names)
    assert name == "Achille" and conf >= 72
    # niente di somigliante: lettura grezza, con confidenza bassa (non basta ad assegnare le lettere)
    name, conf = best_reading([("Xqzkjhw", 80.0)], names)
    assert conf <= 50


def test_le_parole_scure_larghe_sono_candidate_a_nome():
    gray = np.full((600, 900), 235, np.uint8)
    gray[200:260, 100:400] = 40  # una parola scura (300×60)
    gray[400:420, 100:200] = 40  # troppo piccola
    blobs = find_blobs(gray, (0, 0, 900, 600), 80, 1.0)
    assert len(blobs) == 1 and blobs[0].box[0] <= 100 and blobs[0].box[2] >= 400
