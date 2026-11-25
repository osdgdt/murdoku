"""Le parti di characters.py che non richiedono l'OCR: attacchi di frase e nomi citati."""

from reader.characters import Card, _STRONG_START, mentioned


def card(sentence):
    return Card(name="", name_conf=0, sentence=sentence, sentence_conf=90, box=(0, 0, 1, 1))


def test_attacchi_di_frase():
    for text in ("Era seduta su", "Non era sola.", "Uno tra lui e Bella", "La vittima.", "Éra accanto a"):
        assert _STRONG_START.match(text), text
    assert not _STRONG_START.match("era su un letto.")  # continuazione di «Uno tra lui e Bella»
    assert not _STRONG_START.match("Erano due")


def test_nomi_e_stanze_citati():
    names, rooms = mentioned([card("Era a sud di Clemenza e a est di Vilfredo."), card("Era nella Cucina."), card("Era nella Sala Grande.")])
    assert names == ["Clemenza", "Vilfredo"]
    assert rooms == ["Cucina", "Sala Grande"]
