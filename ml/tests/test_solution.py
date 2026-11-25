"""Le parti della lettura della soluzione che non richiedono l'OCR: reticolo, nome dell'assassino, lettere."""

import cv2
import numpy as np

from reader.solution import _CULPRIT, _chains, _merge_tokens, _pick, _MENTION, FrameLattice, Lattice, fit_frame, Pawn, alphabetical_issue, color_similarity, culprit_letter, learn_colors, reconcile_with_text


def cards(*names):
    out = []
    for i, name in enumerate(names):
        out.append({"letter": chr(65 + i), "name": name, "victim": False})
    out.append({"letter": "V", "name": "Vilfredo", "victim": True})
    return out


def test_nome_dell_assassino_nella_riga_finale():
    assert _CULPRIT.findall("… solo con D. Dionigi è : l'assassino!")[-1] == "Dionigi"
    assert _CULPRIT.findall("Questo isola V nell'ultima casella, solo con C. Cosimo è l’assassino!")[-1] == "Cosimo"


def test_lettera_dell_assassino_dall_ordine_alfabetico():
    assert culprit_letter("Dionigi", cards("Alice", "Bors", "Clemenza", "Dionigi", "Erbin")) == "D"
    # nomi mancanti: si fida del nome della scheda, poi dell'iniziale
    assert culprit_letter("Dionigi", cards("Alice", "", "", "Dionigi", "")) == "D"
    assert culprit_letter("Dionigi", cards("", "", "", "", "")) == "D"
    assert culprit_letter("", cards("Alice")) == ""


def test_nomi_fuori_ordine_si_segnalano():
    assert alphabetical_issue(cards("Alice", "Bors", "Clemenza")) == ""
    assert "ordine alfabetico" in alphabetical_issue(cards("Clemenza", "Alice", "Bors"))


def test_reticolo_affine_da_etichette_sintetiche():
    """Griglia 4×5 ruotata di 3°, passo 100 px: etichette R a sinistra, C sotto."""
    a = np.deg2rad(3)
    rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
    origin = np.array([500.0, 400.0])  # centro della casella (1,1)

    def at(row, col):
        return tuple(origin + rot @ np.array([(col - 1) * 100.0, (row - 1) * 100.0]))

    labels = {"R": {k: at(k, 0.2) for k in range(1, 5)}, "C": {j: at(4.8, j) for j in range(1, 6)}}
    lattice = Lattice(labels, 4, 5)
    for row, col in ((1, 1), (2, 4), (4, 5), (3, 2)):
        r, c = lattice.cell(*at(row, col))
        assert (round(r), round(c)) == (row, col) and abs(r - row) < 0.05 and abs(c - col) < 0.05


def test_caselle_scritte_nel_testo():
    text = "Era in Sala da pranzo (in R4 C4), poi in Strada (in R6 C2) e forse in R10, C7 (RC non basta: R3)."
    assert [(int(r), int(c)) for r, c in _MENTION.findall(text)] == [(4, 4), (6, 2), (10, 7)]


def test_somiglianza_di_colore_e_prototipi():
    protos = learn_colors([("A", (0.58, 0.12, 0.40)), ("A", (0.60, 0.12, 0.42)), ("B", (0.2, 0.2, 0.3))])
    assert protos["A"]["n"] == 2
    assert color_similarity((0.59, 0.12, 0.41), protos["A"]) > 0.9
    assert color_similarity((0.2, 0.2, 0.3), protos["A"]) == 0.0
    assert color_similarity((0.2, 0.2, 0.3), None) == 0.0


def pawn(letter, fr, conf=100.0, margin=0.1):
    p = Pawn(letter, 0, 0, 50, conf)
    p.fr, p.row, p.col, p.margin = fr, round(fr[0]), round(fr[1]), margin
    return p


def test_testo_sposta_solo_le_pedine_dubbie_accanto_a_una_casella_citata():
    issues: list[str] = []
    doubtful, sure, far = pawn("A", (4.4, 4.0), conf=30), pawn("B", (6.0, 2.0)), pawn("C", (1.0, 1.0), conf=30)
    reconcile_with_text([doubtful, sure, far], [(5, 4), (6, 2)], issues)
    assert (doubtful.row, doubtful.col, doubtful.via) == (5, 4, "testo")
    assert (sure.row, sure.col, sure.via) == (6, 2, "")  # già citata: resta
    assert (far.row, far.col, far.via) == (1, 1, "")  # nessuna casella citata vicina
    assert len(issues) == 1 and "R5 C4" in issues[0]


def test_reticolo_dalla_cornice_regge_la_prospettiva():
    """Mappa 4×5 vista in prospettiva (il lato destro più corto): il centro di ogni casella torna al suo posto."""
    corners = [np.array(c, float) for c in ((100, 100), (600, 160), (600, 440), (100, 500))]
    frame = FrameLattice(corners, 4, 5)
    plane = np.array([[0.5, 0.5], [5.5, 0.5], [5.5, 4.5], [0.5, 4.5]], np.float32)
    to_image = cv2.getPerspectiveTransform(plane, np.array(corners, np.float32))
    for row, col in ((1, 1), (2, 3), (4, 5), (3, 2.5)):
        x, y, w = to_image @ np.array([col, row, 1.0])
        r, c = frame.cell(x / w, y / w)
        assert abs(r - row) < 1e-3 and abs(c - col) < 1e-3


def test_cornice_trovata_su_un_disegno_sintetico():
    """Un rettangolo scuro storto su fondo chiaro, con etichette R/C a lato: i quattro angoli si ritrovano entro pochi pixel."""
    img = np.full((700, 900), 235, np.uint8)
    quad = np.array([(200, 150), (720, 190), (700, 560), (210, 600)], np.int32)
    cv2.polylines(img, [quad], True, 40, 9)
    for k in range(1, 4):  # pareti interne (non devono confondere i lati)
        a, b = quad[0] + (quad[3] - quad[0]) * k / 4, quad[1] + (quad[2] - quad[1]) * k / 4
        cv2.line(img, tuple(int(v) for v in a), tuple(int(v) for v in b), 60, 3)
    rows, cols = 4, 5
    frame_true = FrameLattice([np.array(p, float) for p in quad], rows, cols)
    inv = np.linalg.inv(frame_true.H)

    def where(row, col):
        v = inv @ np.array([col, row, 1.0])
        return float(v[0] / v[2]), float(v[1] / v[2])

    labels = {"R": {k: (where(k, 0.2)[0] - 20, where(k, 0.2)[1]) for k in range(1, 5)}, "C": {j: where(4.9, j) for j in range(1, 6)}}
    labels["C"] = {j: (x, y + 25) for j, (x, y) in labels["C"].items()}
    lattice = Lattice(labels, rows, cols)  # affine: approssimata, la cornice la corregge
    found = fit_frame(img, (0, 0, 900, 700), lattice, rows, cols, labels)
    assert found is not None
    for got, want in zip(found.corners, quad):
        assert np.linalg.norm(got - want) < 8
    r, c = found.cell(*where(2, 3))
    assert abs(r - 2) < 0.1 and abs(c - 3) < 0.1


def label_tokens():
    """Etichette di una mappa 5×6 (passo 100, righe a x≈200, colonne a y≈700) più rumore: «R4 C7» sparsi nel testo e una lettura doppia."""
    tokens = [("R", k, 200 + 2 * k, 100 + 100 * k) for k in range(1, 6)] + [("C", j, 300 + 100 * j, 700 - 6 * j) for j in range(1, 7)]
    tokens += [("R", 4, 905, 660), ("C", 7, 80, 1000), ("R", 2, 700, 1200), ("R", 1, 203, 202)]  # testo; R1 letta due volte (stesso posto)
    return tokens


def test_catene_di_etichette_ignorano_il_testo():
    tokens = _merge_tokens(label_tokens())
    assert len([t for t in tokens if t[0] == "R" and t[1] == 1]) == 1  # la doppia lettura di R1 diventa una
    rc, cc = _pick(tokens)
    assert rc["ks"] == [1, 2, 3, 4, 5] and cc["ks"] == [1, 2, 3, 4, 5, 6]
    assert 95 < rc["pitch"] < 105 and 95 < cc["pitch"] < 105


def test_una_catena_solida_batte_due_corte_coincidenti_per_caso():
    """Due etichette sparse (R1 in alto, R8 nel testo) fanno una catena a due: se c'è una catena di otto, vince quella."""
    tokens = [("R", k, 1500 + 6 * k, 2300 + 115 * k) for k in (1, 2, 3, 4, 5, 6, 7, 9)] + [("R", 8, 1184, 3600), ("C", 1, 1219, 3674), ("C", 5, 2164, 3333)]
    rc, cc = _pick(_merge_tokens(tokens))
    assert rc["ks"] == [1, 2, 3, 4, 5, 6, 7, 9] and cc is None  # le «C» si cercano a parte, nella striscia sotto la mappa


def test_scatola_della_mappa_dal_reticolo():
    labels = {"R": {k: (200.0, 100.0 + 100 * k) for k in range(1, 5)}, "C": {j: (300.0 + 100 * j, 600.0) for j in range(1, 6)}}
    lattice = Lattice(labels, 4, 5)
    x0, y0, x1, y1 = lattice.map_box(4, 5, (0, 0, 2000, 2000))
    assert x0 < 350 and y0 < 150 and x1 > 850 and y1 > 550
    assert x0 >= 0 and y1 <= 2000


def test_assassina_al_femminile():
    assert _CULPRIT.findall("8. Questo isola V, sola con D. Dina è l'assassina!")[-1] == "Dina"


def test_cornice_piu_corta_della_predizione_affine():
    """Con la prospettiva le caselle si restringono a destra: poche etichette (a sinistra) fanno prevedere una mappa troppo larga, e il
    lato destro della cornice sta più vicino di quanto l'affine dica. Si prova più di un'estensione."""
    img = np.full((700, 1000), 235, np.uint8)
    quad = np.array([(150, 150), (800, 190), (790, 560), (160, 600)], np.int32)  # larga 650 px per 8 colonne
    cv2.polylines(img, [quad], True, 40, 9)
    rows, cols = 4, 8
    true = FrameLattice([np.array(p, float) for p in quad], rows, cols)
    # etichette solo sulle prime colonne, a passo 98 px (più largo del vero, 81): l'affine allunga la mappa di ~140 px a destra
    labels = {"R": {k: (110.0, 150.0 + 110 * (k - 0.5)) for k in range(1, 5)}, "C": {j: (150.0 + 98 * (j - 0.5), 640.0) for j in range(1, 5)}}
    lattice = Lattice(labels, rows, cols)
    found = fit_frame(img, (0, 0, 1000, 700), lattice, rows, cols, labels)
    assert found is not None
    r, c = found.cell(*true.point(2, 7))
    assert abs(r - 2) < 0.15 and abs(c - 7) < 0.15


def test_colori_del_volume_dalle_pedine_sicure(tmp_path, monkeypatch):
    import json

    from reader import solution

    monkeypatch.setenv("MURDOKU_DATA", str(tmp_path))
    work = tmp_path / "lavoro"
    (work / "bozze").mkdir(parents=True)
    (work / "pawn_colors.json").write_text("{}")
    assert solution.load_colors() == {}  # il file del volume vince su quello del repository (anche vuoto)
    for n, vec in ((1, [0.2, 0.1, 0.5]), (2, [0.22, 0.12, 0.52])):
        placements = [
            {"letter": "A", "row": 1, "col": 1, "conf": 90, "margin": 0.1, "via": "", "color": vec},
            {"letter": "B", "row": 2, "col": 2, "conf": 40, "margin": 0.1, "via": "", "color": [0.9, 0.9, 0.9]},  # poco sicura: non conta
            {"letter": "C", "row": 3, "col": 3, "conf": 95, "margin": 0.1, "via": "solver", "color": [0.9, 0.9, 0.9]},  # scelta dal solver: non conta
        ]
        (work / "bozze" / f"{n:03d}.json").write_text(json.dumps({"number": n, "placements": placements}))
    protos = solution.learn_from_drafts()
    assert protos == {}  # due sole pedine: troppo poche per un prototipo
