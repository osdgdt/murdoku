"""La barra di progresso: riga leggibile, percentuale giusta, una riga ogni 5% quando non è un terminale."""

import io

from reader.progress import Progress


def test_barra_su_file_stampa_una_riga_ogni_5_per_cento():
    out = io.StringIO()
    bar = Progress(40, "Foto", out)
    for i in range(40):
        bar.step(f"foto{i}.jpg")
    bar.done()
    lines = out.getvalue().splitlines()
    assert lines[-1].startswith("Foto [") and "40/40" in lines[-1] and "100%" in lines[-1] and "foto39.jpg" in lines[-1]
    assert 15 <= len(lines) <= 25  # circa una ogni 5%, non una per passo


def test_il_lavoro_gia_fatto_non_conta_nel_tempo_che_manca():
    bar = Progress(10, "Foto", io.StringIO(), done_already=8)
    assert "mancanti" not in bar.line()  # nessun passo nuovo: non si può stimare
    bar.step()
    assert "9/10" in bar.line()


def test_note_stampa_sopra_la_barra():
    out = io.StringIO()
    bar = Progress(2, "Casi", out)
    bar.note("caso 1 ok")
    assert "caso 1 ok" in out.getvalue()
