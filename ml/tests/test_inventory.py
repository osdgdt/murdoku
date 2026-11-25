"""L'abbinamento delle foto ai casi, con pagine finte (nessuna foto del libro nel repository)."""

from reader.inventory import _label_sequence, build_manifest
from reader.pages import PageInfo


def page(name, kind, words, titles=()):
    return PageInfo(file=name, kind=kind, rotation=0, words=words, rc_count=0, titles=list(titles))


def shots(prefix="20261123_21", start=0, step=20):
    """Nomi con orario crescente (gli scatti sono a ~20 s l'uno dall'altro)."""
    t = start
    while True:
        yield f"{prefix}{(t // 60) % 60:02d}{t % 60:02d}.jpg"
        t += step


def test_alternanza_personaggi_mappa_e_numeri_dalla_sequenza():
    names = shots()
    pages = [
        page(next(names), "altro", 40),  # prefazione: prima del caso 1
        page(next(names), "personaggi", 24, [(1, "Nella locanda")]),
        page(next(names), "mappa", 3),
        page(next(names), "altro", 15),  # personaggi senza titolo letto
        page(next(names), "mappa", 2),
        page(next(names), "personaggi", 20, [(9, "Numero letto male")]),  # sarebbe il caso 3
        page(next(names), "mappa", 1),
    ]
    manifest = build_manifest(pages)
    assert [c["number"] for c in manifest["cases"]] == [1, 2, 3]
    assert [len(c["mappa"]) for c in manifest["cases"]] == [1, 1, 1]
    assert manifest["cases"][1]["personaggi"] == [pages[3].file]


def test_due_scatti_ravvicinati_della_stessa_pagina_sono_un_caso_solo():
    pages = [
        page("20261123_210000.jpg", "personaggi", 24, [(1, "Uno")]),
        page("20261123_210020.jpg", "mappa", 3),
        page("20261123_210100.jpg", "personaggi", 30, [(2, "Due")]),
        page("20261123_210103.jpg", "personaggi", 31),  # ripresa di 3 s dopo: stessa pagina
        page("20261123_210120.jpg", "mappa", 2),
        page("20261123_210123.jpg", "mappa", 2),  # ripresa della mappa
        page("20261123_210200.jpg", "personaggi", 22, [(3, "Tre")]),
        page("20261123_210220.jpg", "mappa", 3),
    ]
    manifest = build_manifest(pages)
    assert [c["number"] for c in manifest["cases"]] == [1, 2, 3]
    assert len(manifest["cases"][1]["personaggi"]) == 2 and len(manifest["cases"][1]["mappa"]) == 2


def test_i_casi_cominciano_dal_titolo_1():
    pages = [
        page("20261123_210000.jpg", "personaggi", 25),  # prefazione che sembra una pagina di personaggi
        page("20261123_210020.jpg", "mappa", 3),
        page("20261123_210100.jpg", "personaggi", 24, [(1, "Uno")]),
        page("20261123_210120.jpg", "mappa", 3),
    ]
    manifest = build_manifest(pages)
    assert [c["number"] for c in manifest["cases"]] == [1]


def test_le_etichette_sono_p_m_alternate():
    pages = [page(f"20261123_2100{i:02d}.jpg", "altro", 20 if i % 2 == 0 else 2) for i in range(6)]
    assert "".join(_label_sequence(pages)) == "PMPMPM"


def test_passaggi_per_sequenza():
    """Due casi per pagina; le foto ripetute della stessa pagina (pochi secondi) restano alla stessa pagina; i titoli sono ancore."""
    from reader.inventory import assign_passaggi
    from reader.pages import PageInfo

    def page(name, titles=()):
        return PageInfo(file=name, kind="passaggi", rotation=0, words=100, rc_count=5, titles=list(titles))

    pages = [page("x_100000.jpg"), page("x_100030.jpg"), page("x_100034.jpg", [(4, "QUATTRO")]), page("x_100100.jpg")]
    notes: list[str] = []
    got = assign_passaggi(pages, ["S"] * 4, {}, notes, 6)
    assert [got[p.file] for p in pages] == [0, 1, 1, 2]  # prima = pagina 0, ultima = ultima pagina, ripresa a 4 s = stessa pagina


def test_passaggi_con_soluzione_stampata_senza_rc():
    """Nel volume con le pedine sulla mappa non ci sono «R3 C2»: i passi «Questo isola…» bastano; i personaggi non li hanno."""
    from reader.pages import looks_like_passaggi

    assert looks_like_passaggi(words=116, rc_count=0, has_assassino=True, isola=6)
    assert looks_like_passaggi(words=9, rc_count=0, has_assassino=False, isola=3)  # pagina quasi tutta mappa
    assert not looks_like_passaggi(words=62, rc_count=0, has_assassino=False, isola=0)  # personaggi
    assert not looks_like_passaggi(words=40, rc_count=0, has_assassino=True, isola=1)  # «isola» come parola qualunque
    assert looks_like_passaggi(words=90, rc_count=4, has_assassino=True, isola=0)  # il vecchio criterio resta


def test_titoli_in_grassetto_solo_le_righe_alte():
    """I titoli «N. Titolo» sono più alti del testo; i passi «1. Questo isola…» hanno la stessa forma ma altezza normale."""
    from reader.pages import _bold_titles

    class Finto:
        class Output:
            DICT = "dict"

        @staticmethod
        def image_to_data(image, lang, config, output_type):
            rows = [  # (riga, altezza, parole)
                (1, 30, "13. Nella vecchia locanda"),
                (2, 18, "1. Questo isola A nella riga 5."),
                (3, 18, "2. Questo isola G"),
                (4, 18, "3. Altro passo del testo"),
                (5, 31, "14. Festa di compleanno"),
                (6, 18, "4. Un altro passo"),
            ]
            data = {"text": [], "block_num": [], "par_num": [], "line_num": [], "left": [], "height": [], "top": []}
            for line, height, text in rows:
                for k, word in enumerate(text.split()):
                    data["text"].append(word)
                    data["block_num"].append(1)
                    data["par_num"].append(1)
                    data["line_num"].append(line)
                    data["left"].append(10 * k)
                    data["height"].append(height)
                    data["top"].append(20 * line)
            return data

    import numpy as np

    image = np.full((200, 100, 3), 255, np.uint8)
    assert _bold_titles(Finto, image) == [(13, "Nella vecchia locanda"), (14, "Festa di compleanno")]


def test_passaggi_una_foto_per_pagina_due_casi_per_foto():
    """Libro con la soluzione stampata: ogni foto è una pagina con due casi; 4 casi = 2 foto. Anche con tutti i titoli mancanti la sequenza basta."""
    from reader.inventory import assign_passaggi

    def pagina(i, titles=()):
        return PageInfo(file=f"x_10{i // 60:02d}{i % 60:02d}.jpg", kind="passaggi", rotation=0, words=100, rc_count=0, titles=list(titles))

    pages = [pagina(10 * i, [(2 * i + 1, "Titolo letto")] if i % 3 == 0 else []) for i in range(6)]  # 6 pagine = 12 casi
    notes: list[str] = []
    got = assign_passaggi(pages, ["S"] * 6, {}, notes, 12)
    assert [got[p.file] for p in pages] == [0, 1, 2, 3, 4, 5]
    assert notes == []


def test_rotazione_dall_osd():
    """L'OSD decide la rotazione quando è sicuro; senza testo (mappe) o con poca confidenza non si fida."""
    import numpy as np

    from reader.pages import OSD_MIN_CONFIDENCE, osd_rotation

    class Finto:
        def __init__(self, text):
            self.text = text

        def image_to_osd(self, gray, config=""):
            if self.text is None:
                raise RuntimeError("Too few characters")
            return self.text

    image = np.full((50, 80, 3), 255, np.uint8)
    osd = "Orientation in degrees: 90\nRotate: 270\nOrientation confidence: 22.36\nScript: Latin\n"
    assert osd_rotation(Finto(osd), image) == (3, 22.36)
    assert osd_rotation(Finto(osd.replace("270", "0")), image)[0] == 0
    assert osd_rotation(Finto(None), image) == (0, 0.0)
    assert 2.0 < OSD_MIN_CONFIDENCE < 12.0  # fra le mappe (< 2) e le pagine di testo (≥ 12)


def test_opzione_dati_non_tocca_la_variabile_di_sistema(tmp_path, monkeypatch):
    """`--dati Murdoku1` vale per il programma che parte: trova la cartella sorella e toglie l'opzione da argv."""
    from reader import config

    (tmp_path / "Murdoku1").mkdir()
    (tmp_path / "Murdoku2").mkdir()
    monkeypatch.setenv("MURDOKU_DATA", str(tmp_path / "Murdoku2"))
    argv = config.take_data_option(["8766", "--dati", "Murdoku1"])
    assert argv == ["8766"]
    assert config.data_dir() == tmp_path / "Murdoku1"
    assert config.take_data_option(["9000"]) == ["9000"]
    monkeypatch.setenv("MURDOKU_DATA", str(tmp_path / "Murdoku2"))
    assert config.take_data_option(["--data=Murdoku1", "9001"]) == ["9001"]  # anche --data e la forma con =
    assert config.data_dir() == tmp_path / "Murdoku1"
