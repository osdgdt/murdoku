"""Pagina dei passaggi: assassino e posizioni finali dei personaggi.

Ogni pagina ha due casi (uno sopra l'altro). Per ognuno:
- **assassino**: l'ultima riga dei passaggi dice «Dionigi è l'assassino!» in carattere normale: si legge il nome e lo si traduce nella
  lettera della scheda (nome della scheda, altrimenti l'iniziale: le lettere sono l'ordine alfabetico dei nomi);
- **posizioni**: sulla mappa illustrata ogni personaggio è una pedina con la sua lettera in bianco sul corpo. Si trovano le lettere
  (soglia locale, poi OCR della singola lettera) e si riportano su righe e colonne con le etichette «R1…», «C1…» della mappa:
  dalle etichette si ricava il reticolo (le foto sono storte, ma una trasformazione affine basta per capire in che casella cade
  il centro della lettera).
- **colore**: ogni lettera ha la sua pedina colorata (la B è sempre verde, la C azzurra…, in tutto il libro): il colore del corpo
  accanto alla lettera si confronta con i prototipi di `pawn_colors.json` e aiuta l'OCR a decidere (A/F/V rosse, E/F/G scure…);
- **testo dei passaggi**: «… è in Sala da pranzo (in R4 C4)» dà una casella scritta in chiaro: se la pedina letta cade accanto a una casella
  citata, e nessuna pedina occupa quella citata, si sposta lì (segnato «dal testo»);
- **solver**: vedi `draft.refine_with_solver` (sceglie fra caselle vicine quando il caso ha una soluzione sola).
Quello che non torna (etichette mancanti, lettere doppie o assenti, posizione troppo vicina a un bordo) finisce in `issues`: la
pagina di correzione lo mostra, il solver giudica il resto.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from . import config

_LABEL = re.compile(r"^([RC])\s?(\d{1,2})$")


@dataclass
class Pawn:
    letter: str
    x: float
    y: float
    size: int
    conf: float
    row: int | None = None  # da 1
    col: int | None = None
    margin: float = 0.0  # 0 = al centro della casella, 0.5 = sul bordo
    fr: tuple[float, float] = (0.0, 0.0)  # (riga, colonna) frazionarie da 1: serve per scegliere fra caselle vicine
    via: str = ""  # "" = letta sulla mappa; "testo" = spostata sulla casella citata nei passaggi; "solver" = scelta dal solver
    color: tuple[float, float, float] = (0.0, 0.0, 0.0)


@dataclass
class CaseSolution:
    culprit_name: str = ""
    pawns: list[Pawn] = field(default_factory=list)
    rows: int = 0
    cols: int = 0
    issues: list[str] = field(default_factory=list)
    box: tuple[int, int, int, int] = (0, 0, 0, 0)
    mentions: list[tuple[int, int]] = field(default_factory=list)  # caselle scritte nel testo («R4 C4»)
    lattice: str = "affine"  # come si passa da pixel a casella: "affine" (dalle etichette) o "cornice" (omografia dai lati della mappa)


# ----------------------------------------------------------------------------------------------- parole e blocchi


def _words(gray: np.ndarray, scale: float, psm: int = 11) -> list[tuple[str, int, int, int, int, float]]:
    pytesseract = config.setup_tesseract()
    img = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC) if scale != 1 else gray
    data = pytesseract.image_to_data(img, lang="ita", config=f"--psm {psm}", output_type=pytesseract.Output.DICT)
    out = []
    for text, x, y, w, h, conf in zip(data["text"], data["left"], data["top"], data["width"], data["height"], data["conf"]):
        if text.strip():
            out.append((text.strip(), int(x / scale), int(y / scale), int(w / scale), int(h / scale), float(conf)))
    return out


def find_blocks(gray: np.ndarray) -> list[tuple[int, int]]:
    """(y0, y1) di ogni caso della pagina, dall'alto. Si usano due segni: l'intestazione «L'assassino è…» sotto il titolo e la riga
    finale «… è l'assassino!» dei passaggi; ognuno dei due è letto bene solo a volte, quindi se ne basta uno dei due con due occorrenze."""
    height = gray.shape[0]
    # Volume con la soluzione stampata: i due titoli «N. Titolo» in grassetto dividono la pagina (la mappa del primo caso scende
    # più in basso del suo testo, e la riga finale non basta a trovare il taglio).
    from . import pages

    titles = [y for _, _, y in pages.bold_title_lines(config.setup_tesseract(), gray)]
    if len(titles) >= 2 and 0.3 < titles[1] < 0.75 and titles[0] < 0.2:
        cut = int(titles[1] * height) - 30
        return [(0, cut), (cut, height)]
    words = _words(gray, 0.6)

    def clusters(ys: list[int]) -> list[int]:
        out: list[int] = []
        for y in sorted(ys):
            if not out or y - out[-1] > 500:
                out.append(y)
        return out

    heads = clusters([y for t, x, y, w, h, c in words if re.fullmatch(r"[L’'`]*[’'`]assassin[oa][.,:]?", t)])
    ends = clusters([y for t, x, y, w, h, c in words if re.fullmatch(r"[l’'`]*assassin[oa][!.]+", t)])
    # Il taglio fra i due casi sta ~330 px sopra l'intestazione del secondo, e ~110 px sotto la riga finale del primo: ogni segno
    # letto dà un candidato, e se ne legge quasi sempre almeno uno. I candidati fuori dalla fascia centrale sono bordi di pagina.
    candidates = [y - 330 for y in heads] + [y + 110 for y in ends]
    middle = sorted(c for c in candidates if 0.3 * height < c < 0.8 * height)
    if middle:
        cut = int(middle[len(middle) // 2])
        return [(0, cut), (cut, height)]
    return [(0, height // 2), (height // 2, height)]


# ----------------------------------------------------------------------------------------------- assassino


_CULPRIT = re.compile(r"([A-ZÀ-Ý][a-zà-ÿ'’\-]{2,})\s+(?:è|e|é)[\s:;|.,]*l\W{0,2}assassin[oa]", re.UNICODE)


_MENTION = re.compile(r"\bR\s?(\d{1,2})\s*[,;.]?\s*C\s?(\d{1,2})\b")


def read_text(gray: np.ndarray, block: tuple[int, int]) -> tuple[str, list[tuple[int, int]]]:
    """(nome dell'assassino, caselle «R4 C4» scritte nei passaggi) dalla colonna di testo del caso.
    Il nome sta nell'ultima riga («… Dionigi è l'assassino!»); le caselle sono quelle citate nei passi («è in Strada (in R6 C2)»)."""
    pytesseract = config.setup_tesseract()
    y0, y1 = block
    width = gray.shape[1]
    crop = gray[y0:y1, int(0.03 * width) : int(0.52 * width)]
    text = re.sub(r"\s+", " ", pytesseract.image_to_string(crop, lang="ita", config="--psm 6"))
    mentions = list(dict.fromkeys((int(r), int(c)) for r, c in _MENTION.findall(text)))
    matches = _CULPRIT.findall(text)
    if matches:
        return matches[-1], mentions
    # fallback: la riga finale da sola («… Dionigi è l'assassino!»), ritagliata attorno alla parola «assassino!»
    for t, x, y, w, h, c in _words(gray[y0:y1], 0.6):
        if re.fullmatch(r"[l’'`]*assassino!+", t):
            strip = gray[max(0, y0 + y - 110) : y0 + y + h + 40, int(0.03 * width) : int(0.6 * width)]
            line = re.sub(r"\s+", " ", pytesseract.image_to_string(strip, lang="ita", config="--psm 6"))
            found = _CULPRIT.findall(line)
            if found:
                return found[-1], mentions
    return "", mentions


# ----------------------------------------------------------------------------------------------- etichette e reticolo


def _labels(gray: np.ndarray, box: tuple[int, int, int, int]) -> dict[str, dict[int, tuple[float, float]]]:
    """Etichette «R1…», «C1…» della mappa. Sono piccole e grigie: si prova a leggerle in più modi (tutta la mappa, e poi le sole
    strisce a sinistra e in basso, ingrandite, con e senza contrasto) e si tiene la posizione mediana di ogni etichetta."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    regions = [(box, [(1.0, False), (1.6, False), (1.3, True)]),
               ((x0, y0, x0 + int(0.22 * w), y1), [(1.6, False), (2.2, True)]),  # etichette di riga
               ((x0, y1 - int(0.25 * h), x1, y1), [(1.0, False), (1.6, False), (2.2, False), (1.6, True), (2.2, True)])]  # di colonna
    found: dict[tuple[str, int], list[tuple[float, float]]] = {}
    for (rx0, ry0, rx1, ry1), variants in regions:
        crop = gray[ry0:ry1, rx0:rx1]
        for scale, contrast in variants:
            img = cv2.createCLAHE(3.0, (8, 8)).apply(crop) if contrast else crop
            for text, x, y, ww, hh, conf in _words(img, scale):
                m = _LABEL.match(text.replace("O", "0"))
                if m and conf >= 40:
                    found.setdefault((m.group(1), int(m.group(2))), []).append((rx0 + x + ww / 2, ry0 + y + hh / 2))
    out: dict[str, dict[int, tuple[float, float]]] = {"R": {}, "C": {}}
    for (axis, number), points in found.items():
        arr = np.array(points)
        out[axis][number] = (float(np.median(arr[:, 0])), float(np.median(arr[:, 1])))
    return out


def _merge_tokens(tokens: list[tuple[str, int, float, float]]) -> list[tuple[str, int, float, float]]:
    """La stessa etichetta letta a più scale (posizioni a meno di 30 px) diventa una sola, alla posizione mediana."""
    merged: list[list] = []
    for axis, k, x, y in tokens:
        for group in merged:
            if group[0] == axis and group[1] == k and np.hypot(group[2][0][0] - x, group[2][0][1] - y) < 30:
                group[2].append((x, y))
                break
        else:
            merged.append([axis, k, [(x, y)]])
    return [(a, k, float(np.median([p[0] for p in pts])), float(np.median([p[1] for p in pts]))) for a, k, pts in merged]


def _chains(tokens: list[tuple[str, int, float, float]], axis: str, limit: int = 6) -> list[dict]:
    """Le catene di etichette di un asse: numeri crescenti su una retta, con passo costante. Le etichette stanno su una riga (le «R»,
    in verticale) o su una colonna (le «C», in orizzontale) di punti ben allineati e spaziati come la griglia; il testo dei passi cita
    anche «R4 C7», ma sparso. Si provano tutte le coppie di etichette come ipotesi (RANSAC) e si tengono le migliori."""
    pts = [(k, np.array([x, y])) for a, k, x, y in tokens if a == axis]
    found: list[dict] = []
    for i, (ki, pi) in enumerate(pts):
        for kj, pj in pts[i + 1 :]:
            if kj == ki:
                continue
            (k0, p0), (k1, p1) = ((ki, pi), (kj, pj)) if ki < kj else ((kj, pj), (ki, pi))
            step = (p1 - p0) / (k1 - k0)
            pitch = float(np.hypot(*step))
            along, across = (step[1], step[0]) if axis == "R" else (step[0], step[1])
            if not (50 <= pitch <= 300) or along <= 0 or abs(across) > 0.6 * along:
                continue
            members: dict[int, tuple[float, np.ndarray]] = {}
            for k, p in pts:
                err = float(np.hypot(*(p - (p0 + step * (k - k0)))))
                if err < 0.3 * pitch and (k not in members or err < members[k][0]):
                    members[k] = (err, p)
            if len(members) >= 2:
                found.append({"ks": sorted(members), "points": {k: tuple(map(float, v[1])) for k, v in members.items()}, "step": step, "pitch": pitch,
                              "error": sum(v[0] for v in members.values()) / len(members)})
    found.sort(key=lambda c: (-len(c["ks"]), c["error"]))
    out: list[dict] = []
    for chain in found:  # ipotesi diverse: non quelle che differiscono solo per un'etichetta
        if all(set(chain["ks"]) != set(o["ks"]) or chain["pitch"] > 1.1 * o["pitch"] or chain["pitch"] < 0.9 * o["pitch"] for o in out):
            out.append(chain)
        if len(out) >= limit:
            break
    return out


def _strip_tokens(gray: np.ndarray, region: tuple[int, int, int, int]) -> list[tuple[str, int, float, float]]:
    """Etichette lette in una striscia stretta. Sono piccole e grigio chiaro su fondo mosso: oltre al grigio e al contrasto, la
    binarizzazione adattiva (testo nero su bianco) è la lettura che ne trova di più; con l'elenco dei caratteri ammessi si leggono anche
    quelle che il riconoscimento normale scambia per parole."""
    x0, y0, x1, y1 = region
    x0, y0 = max(0, x0), max(0, y0)
    crop = gray[y0:y1, x0:x1]
    out: list[tuple[str, int, float, float]] = []
    if crop.size == 0:
        return out
    pytesseract = config.setup_tesseract()
    adapt = cv2.adaptiveThreshold(cv2.GaussianBlur(crop, (3, 3), 0), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 12)
    clahe = cv2.createCLAHE(3.0, (8, 8)).apply(crop)
    variants = [(crop, 2.2, None), (clahe, 2.2, None), (adapt, 1.5, None), (adapt, 2.5, None), (adapt, 1.5, "C0123456789"), (clahe, 1.5, "C0123456789")]
    for image, scale, whitelist in variants:
        big = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        cfg = "--psm 11" + (f" -c tessedit_char_whitelist={whitelist}" if whitelist else "")
        data = pytesseract.image_to_data(big, lang="ita", config=cfg, output_type=pytesseract.Output.DICT)
        for text, x, y, w, h, conf in zip(data["text"], data["left"], data["top"], data["width"], data["height"], data["conf"]):
            m = _LABEL.match(text.strip().replace("O", "0"))
            if m and float(conf) >= 40 and 1 <= int(m.group(2)) <= 20:
                out.append((m.group(1), int(m.group(2)), x0 + (x + w / 2) / scale, y0 + (y + h / 2) / scale))
    return out


def _consistent(rc: dict, cc: dict) -> bool:
    """La catena delle C parte a destra di quella delle R e sotto la sua prima etichetta, con un passo simile."""
    first_r, last_r = rc["points"][rc["ks"][0]], rc["points"][rc["ks"][-1]]
    first_c = cc["points"][cc["ks"][0]]
    return (
        first_c[0] > min(first_r[0], last_r[0]) - 0.5 * rc["pitch"]
        and first_c[1] > first_r[1] - 0.5 * rc["pitch"]
        and 0.5 < rc["pitch"] / cc["pitch"] < 2.0  # righe e colonne di una mappa hanno passo simile
    )


def _pick(tokens: list[tuple[str, int, float, float]]) -> tuple[dict | None, dict | None]:
    """(catena delle R, catena delle C): la coppia più lunga che stia insieme. Una catena solida (≥3 etichette) vale più di due catene
    corte e coincidenti per caso: se non c'è una coppia di solide, si tiene la sola solida più lunga (l'altra si cerca a parte, nella
    striscia dove deve stare). Senza catene solide, la coppia di corte più coerente."""
    rows, cols = _chains(tokens, "R"), _chains(tokens, "C")

    def best_pair(rs: list[dict], cs: list[dict]):
        best, best_score = None, 0.0
        for rc in rs:
            for cc in cs:
                score = len(rc["ks"]) + len(cc["ks"]) - 0.01 * (rc["error"] + cc["error"]) / rc["pitch"]
                if _consistent(rc, cc) and score > best_score:
                    best, best_score = (rc, cc), score
        return best

    strong_r, strong_c = [c for c in rows if len(c["ks"]) >= 3], [c for c in cols if len(c["ks"]) >= 3]
    pair = best_pair(strong_r, strong_c)
    if pair:
        return pair
    if strong_r or strong_c:
        sr, sc = (strong_r[0] if strong_r else None), (strong_c[0] if strong_c else None)
        if sr and sc:  # entrambe solide ma incompatibili: si tiene la più lunga
            return (sr, None) if len(sr["ks"]) >= len(sc["ks"]) else (None, sc)
        return sr, sc
    return best_pair(rows, cols) or ((rows[0] if rows else None), (cols[0] if cols else None))


def find_labels(
    gray: np.ndarray, box: tuple[int, int, int, int], n_rows: int = 0, n_cols: int = 0, y_max: int | None = None
) -> dict[str, dict[int, tuple[float, float]]]:
    """Etichette «R1…», «C1…» ovunque stia la mappa nel blocco (le pagine hanno la mappa in posti diversi, e il testo cita «R4 C7»).
    1. Si legge tutto il blocco a due scale e fra le etichette lette si scelgono la catena delle «R» (a sinistra, una sopra l'altra) e
       quella delle «C» (sotto, una accanto all'altra) più lunghe che stiano insieme.
    2. Le etichette piccole e chiare a volte non si leggono su tutta la pagina: se una catena è solida (≥3) e l'altra no, si legge la
       striscia dove l'altra deve stare (sotto l'ultima riga, o a sinistra della prima colonna) con più ingrandimenti.
    `n_rows`, `n_cols` (se noti) dicono quanto è lunga la striscia. `y_max`: fin dove si può scendere con la striscia delle «C» (il taglio
    fra i due casi non sempre è giusto: la mappa del caso di sopra può finire sotto il taglio); di default, il fondo del blocco."""
    x0, y0, x1, y1 = box
    y_end = y_max if y_max is not None else y1
    raw = []
    for scale in (0.8, 1.2):
        for text, x, y, w, h, conf in _words(gray[y0:y1, x0:x1], scale):
            m = _LABEL.match(text.replace("O", "0"))
            if m and conf >= 40 and 1 <= int(m.group(2)) <= 20:
                raw.append((m.group(1), int(m.group(2)), x0 + x + w / 2, y0 + y + h / 2))
    tokens = _merge_tokens(raw)
    rc, cc = _pick(tokens)
    if rc and len(rc["ks"]) >= 3 and (cc is None or len(cc["ks"]) < 3):
        pitch, k_last = rc["pitch"], rc["ks"][-1]
        seen = np.array(rc["points"][k_last])  # l'ultima «R» letta
        # le etichette delle colonne stanno sotto l'ultima riga: dove sia lo dicono le dimensioni note; senza, si scende di qualche riga
        last = seen + rc["step"] * ((n_rows - k_last) if n_rows > k_last else (0 if n_rows else 5))
        first = np.array(rc["points"][rc["ks"][0]])
        region = (int(first[0] + 0.4 * pitch), int(seen[1] - 2.0 * pitch), min(x1, int(first[0] + 16 * pitch)), min(y_end, int(last[1] + 2.5 * pitch)))
        tokens = _merge_tokens(tokens + _strip_tokens(gray, region))
        rc, cc = _pick(tokens)
    elif cc and len(cc["ks"]) >= 3 and (rc is None or len(rc["ks"]) < 3):
        pitch = cc["pitch"]
        first = np.array(cc["points"][cc["ks"][0]])
        top = first[1] - (n_rows if n_rows else 14) * pitch
        region = (int(first[0] - 3.5 * pitch), max(y0, int(top)), int(first[0] + 0.5 * pitch), int(first[1] + 0.5 * pitch))
        tokens = _merge_tokens(tokens + _strip_tokens(gray, region))
        rc, cc = _pick(tokens)
    return {"R": dict(rc["points"]) if rc else {}, "C": dict(cc["points"]) if cc else {}}


def _fill_labels(gray: np.ndarray, labels: dict[str, dict[int, tuple[float, float]]], n_rows: int, n_cols: int) -> None:
    """Le etichette che l'OCR di pagina non ha visto si cercano dove devono stare (estrapolando quelle trovate) e si leggono da sole."""
    pytesseract = config.setup_tesseract()
    for axis, wanted in (("R", n_rows), ("C", n_cols)):
        fit = _fit_axis(labels[axis])
        if fit is None:
            continue
        origin, step = fit
        pitch = float(np.hypot(*step))
        for k in range(1, wanted + 1):
            if k in labels[axis]:
                continue
            cx, cy = origin + step * k
            hw, hh = int(0.55 * pitch), int(0.35 * pitch)
            x0, y0 = int(cx) - hw, int(cy) - hh
            if x0 < 0 or y0 < 0:
                continue
            window = gray[y0 : int(cy) + hh, x0 : int(cx) + hw]
            if window.size == 0:
                continue
            for img in (window, cv2.createCLAHE(3.0, (4, 4)).apply(window)):
                big = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
                text = pytesseract.image_to_string(big, lang="ita", config="--psm 7 -c tessedit_char_whitelist=RC0123456789").strip()
                m = _LABEL.match(text.replace("O", "0"))
                if m and m.group(1) == axis and int(m.group(2)) == k:
                    labels[axis][k] = (float(cx), float(cy))
                    break


def _fit_axis(points: dict[int, tuple[float, float]]) -> tuple[np.ndarray, np.ndarray] | None:
    """Retta numero → (x, y) per le etichette di un asse; scarta le etichette fuori linea (letture sbagliate)."""
    if len(points) < 2:
        return None
    ks = np.array(sorted(points), float)
    xy = np.array([points[int(k)] for k in ks])
    keep = np.ones(len(ks), bool)
    for _ in range(3):
        if keep.sum() < 2:
            return None
        A = np.vstack([np.ones(keep.sum()), ks[keep]]).T
        coef_x, *_ = np.linalg.lstsq(A, xy[keep, 0], rcond=None)
        coef_y, *_ = np.linalg.lstsq(A, xy[keep, 1], rcond=None)
        pred = np.stack([coef_x[0] + coef_x[1] * ks, coef_y[0] + coef_y[1] * ks], 1)
        err = np.linalg.norm(pred - xy, axis=1)
        step = np.hypot(coef_x[1], coef_y[1])
        bad = err > 0.35 * step
        if not (bad & keep).any() or keep.sum() - (bad & keep).sum() < 2:
            break
        keep &= ~bad
    return np.array([coef_x[0], coef_y[0]]), np.array([coef_x[1], coef_y[1]])


class Lattice:
    """Casella (riga, colonna) ↔ punto dell'immagine, dalle etichette di riga (a sinistra) e di colonna (sotto).

    Trasformazione affine senza ipotesi sulla distanza delle etichette dalla griglia: il centro della casella (1,1) è
    l'incrocio fra la riga dell'etichetta «R1» (che corre nella direzione delle colonne) e la colonna dell'etichetta «C1» (che corre
    nella direzione delle righe). Provata sul caso 1 (passi scritti nel libro): tutte le pedine nella casella giusta, margine ≤ 0.21.
    Una omografia, con la distanza delle etichette fissata, è risultata peggiore: la pagina curva non rispetta la prospettiva."""

    def __init__(self, labels: dict[str, dict[int, tuple[float, float]]], rows: int, cols: int):
        rows_fit, cols_fit = _fit_axis(_clean_axis(labels["R"])), _fit_axis(_clean_axis(labels["C"]))
        if rows_fit is None or cols_fit is None:
            raise ValueError("etichette R/C insufficienti")
        (r_origin, v), (c_origin, u) = rows_fit, cols_fit  # origini: posizione di «R0» e «C0»; v: passo per riga, u: per colonna
        r1, c1 = r_origin + v, c_origin + u
        A = np.array([[u[0], -v[0]], [u[1], -v[1]]])
        if abs(np.linalg.det(A)) < 1e-6:
            raise ValueError("righe e colonne parallele")
        s, _ = np.linalg.solve(A, c1 - r1)
        self.origin = r1 + s * u
        self.M = np.linalg.inv(np.array([u, v]).T)

    def cell(self, x: float, y: float) -> tuple[float, float]:
        """(riga, colonna) frazionarie da 1: l'intero più vicino è la casella."""
        col, row = self.M @ (np.array([x, y]) - self.origin)
        return row + 1, col + 1

    def point(self, row: float, col: float) -> np.ndarray:
        """Il contrario: il punto dell'immagine di (riga, colonna) frazionarie da 1."""
        return self.origin + np.linalg.inv(self.M) @ np.array([col - 1, row - 1])

    def map_box(self, rows: int, cols: int, limit: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        """Rettangolo che contiene la mappa (con una casella di margine: teste delle pedine, cornice, curvatura), nei limiti del blocco."""
        pitch = float(np.hypot(*(self.point(2, 1) - self.point(1, 1))))
        corners = np.array([self.point(r, c) for r in (0.5, rows + 0.5) for c in (0.5, cols + 0.5)])
        x0, y0 = corners.min(axis=0) - 1.2 * pitch
        x1, y1 = corners.max(axis=0) + 1.0 * pitch
        return (max(limit[0], int(x0)), max(limit[1], int(y0)), min(limit[2], int(x1)), min(limit[3], int(y1)))


class FrameLattice:
    """Casella ↔ pixel dai quattro lati della cornice della mappa (omografia): regge le pagine curve o storte, dove le sole etichette R/C
    (una retta per asse, ai bordi) non dicono come si restringono le righe lontano dal lato sinistro."""

    def __init__(self, corners: list[np.ndarray], rows: int, cols: int):
        # corners: angoli esterni dell'immagine in ordine alto-sinistra, alto-destra, basso-destra, basso-sinistra
        plane = np.array([[0.5, 0.5], [cols + 0.5, 0.5], [cols + 0.5, rows + 0.5], [0.5, rows + 0.5]], np.float32)  # (colonna, riga)
        self.corners = [np.asarray(c, float) for c in corners]
        self.H = cv2.getPerspectiveTransform(np.array(corners, np.float32), plane)

    def cell(self, x: float, y: float) -> tuple[float, float]:
        v = self.H @ np.array([x, y, 1.0])
        return float(v[1] / v[2]), float(v[0] / v[2])

    def point(self, row: float, col: float) -> np.ndarray:
        """Il contrario di `cell`: il punto dell'immagine di (riga, colonna) frazionarie da 1."""
        v = np.linalg.inv(self.H) @ np.array([col, row, 1.0])
        return np.array([v[0] / v[2], v[1] / v[2]])


def _fit_side(pts: np.ndarray, p0: np.ndarray, p1: np.ndarray, band: float):
    """Lato esterno della cornice fra i punti predetti p0 e p1: l'angolo (±8°) e lo scostamento che raccolgono più pixel scuri sottili in
    una striscia larga ±band; poi una retta ai minimi quadrati sui pixel vicini. Ritorna (punto a, punto b, pixel usati) o None."""
    d = p1 - p0
    length = float(np.linalg.norm(d))
    u = d / length
    n = np.array([-u[1], u[0]])
    rel = pts - p0
    along, perp = rel @ u, rel @ n
    sel = (along > 0.03 * length) & (along < 0.97 * length) & (np.abs(perp) < band)
    a, q = along[sel], perp[sel]
    if len(a) < 200:
        return None
    best = (0.0, 0.0, 0.0)
    for deg in np.arange(-8, 8.01, 0.5):
        r = q - np.tan(np.deg2rad(deg)) * (a - length / 2)
        hist, edges = np.histogram(r, bins=np.arange(-band, band + 1, 4))
        k = int(np.argmax(hist))
        score = hist[k] + 0.5 * (hist[k - 1] if k > 0 else 0) + 0.5 * (hist[k + 1] if k + 1 < len(hist) else 0)
        if score > best[0]:
            best = (float(score), float(deg), float((edges[k] + edges[k + 1]) / 2))
    _, deg, off = best
    slope = np.tan(np.deg2rad(deg))
    keep = np.abs(q - slope * (a - length / 2) - off) < 7
    if keep.sum() < 300:
        return None
    slope, off = np.polyfit(a[keep] - length / 2, q[keep], 1)
    return p0 + n * (off - slope * length / 2), p0 + u * length + n * (off + slope * length / 2), int(keep.sum())


def fit_frame(gray: np.ndarray, box: tuple[int, int, int, int], lattice: "Lattice", rows: int, cols: int, labels: dict) -> FrameLattice | None:
    """Cerca i quattro lati della cornice scura della mappa vicino a dove li predice il reticolo affine e ne ricava l'omografia.
    Ritorna None (si resta sull'affine) se un lato manca, la forma è strana o le etichette R/C non tornano.

    Le etichette sono poche e la prospettiva restringe le caselle lontano dal lato di sinistra: il reticolo affine allunga la mappa a
    destra e in basso. Si provano allora più estensioni (da 100% a 76% della predizione) e vince quella che raccoglie più pixel di cornice."""
    x0, y0, x1, y1 = box
    blur = cv2.GaussianBlur(gray[y0:y1, x0:x1], (5, 5), 0)
    thin_dark = cv2.morphologyEx(blur, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (31, 31))) > 22  # linee scure sottili
    ys, xs = np.nonzero(thin_dark)
    pts = np.stack([xs + x0, ys + y0], 1).astype(np.float64)
    at = lattice.point  # punto dell'immagine di (riga, colonna) secondo l'affine
    pitch = float(np.hypot(*(at(2, 1) - at(1, 1))))
    first = at(0.5, 0.5)  # il lato sinistro e quello alto sono ben predetti (le etichette stanno lì): l'estensione si accorcia da lì

    def meet(a, b):
        (p1, p2), (p3, p4) = a, b
        s = np.linalg.solve(np.array([p2 - p1, p3 - p4]).T, p3 - p1)[0]
        return p1 + s * (p2 - p1)

    best: tuple[int, FrameLattice] | None = None
    for shrink_rows in (1.0, 0.92, 0.84, 0.76):
        for shrink_cols in (1.0, 0.92, 0.84, 0.76):
            def pred(r: float, c: float) -> np.ndarray:
                return first + shrink_cols * (at(0.5, c) - first) + shrink_rows * (at(r, 0.5) - first)

            tl, tr, br, bl = pred(0.5, 0.5), pred(0.5, cols + 0.5), pred(rows + 0.5, cols + 0.5), pred(rows + 0.5, 0.5)
            sides = [_fit_side(pts, a, b, 0.8 * pitch) for a, b in ((tl, tr), (bl, br), (tl, bl), (tr, br))]
            if any(side is None for side in sides):
                continue
            (top, bottom, left, right) = ((side[0], side[1]) for side in sides)
            try:
                corners = [meet(top, left), meet(top, right), meet(bottom, right), meet(bottom, left)]
            except np.linalg.LinAlgError:
                continue
            # forma plausibile: i quattro angoli non lontani da quelli predetti (la pagina storta li sposta di qualche casella, non di più)
            if any(np.linalg.norm(c - p) > 1.6 * pitch for c, p in zip(corners, (tl, tr, br, bl))):
                continue
            def turn(i: int) -> float:  # prodotto vettoriale 2D di due lati consecutivi
                a, b = corners[(i + 1) % 4] - corners[i], corners[(i + 2) % 4] - corners[(i + 1) % 4]
                return float(a[0] * b[1] - a[1] * b[0])

            cross = [turn(i) for i in range(4)]
            if not (all(v > 0 for v in cross) or all(v < 0 for v in cross)):
                continue  # non convesso
            frame = FrameLattice(corners, rows, cols)
            # le etichette lo confermano? (la riga di «R3» deve venire ~3, la colonna di «C5» ~5; le etichette stanno fuori dalla mappa e la
            # pagina curva le sposta un po': si tollera mezza casella sulla mediana, una lettura sbagliata non conta)
            dr = [abs(frame.cell(*labels["R"][k])[0] - k) for k in labels["R"]]
            dc = [abs(frame.cell(*labels["C"][k])[1] - k) for k in labels["C"]]
            if (dr and float(np.median(dr)) > 0.5) or (dc and float(np.median(dc)) > 0.6):
                continue
            support = sum(side[2] for side in sides)
            if best is None or support > best[0]:
                best = (support, frame)
    return best[1] if best else None


def rough_frame(gray: np.ndarray, y0: int, y1: int, x_min: int = 0) -> list[np.ndarray] | None:
    """Gli angoli (alto-sinistra, alto-destra, basso-destra, basso-sinistra) del rettangolo della mappa, senza etichette: la mappa è la
    più grande massa connessa di tratti scuri (cornice e muri spessi) della parte destra del blocco. Le teste delle pedine che escono dalla
    cornice la allargano di poco: `fit_frame` poi la stringe sui lati veri."""
    width = gray.shape[1]
    left = max(x_min, int(0.28 * width))
    scale = 0.25
    small = cv2.resize(gray[y0:y1, left:], None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    dark = cv2.morphologyEx((small < 95).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    count, labels_, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
    best = None
    for i in range(1, count):
        x, y, bw, bh, _ = stats[i]
        if bw > 0.35 * small.shape[1] and bh > 0.25 * small.shape[0] and 0.6 < bw / bh < 1.7 and (best is None or bw * bh > best[1]):
            best = (i, bw * bh)
    if best is None:
        return None
    box = cv2.boxPoints(cv2.minAreaRect(cv2.findNonZero((labels_ == best[0]).astype(np.uint8)))) / scale + np.array([left, y0])
    sums, diffs = box.sum(axis=1), box[:, 1] - box[:, 0]
    return [box[int(np.argmin(sums))], box[int(np.argmin(diffs))], box[int(np.argmax(sums))], box[int(np.argmax(diffs))]]


def _pitch(points: dict[int, tuple[float, float]]) -> float:
    ks = sorted(points)
    return float(np.hypot(*(np.array(points[ks[-1]]) - np.array(points[ks[0]]))) / max(1, ks[-1] - ks[0]))


def _clean_axis(points: dict[int, tuple[float, float]]) -> dict[int, tuple[float, float]]:
    """Toglie le etichette fuori linea (letture sbagliate): ciò che non sta su una retta numero → posizione."""
    fit = _fit_axis(points)
    if fit is None:
        return dict(points)
    origin, step = fit
    pitch = float(np.hypot(*step))
    return {k: p for k, p in points.items() if np.hypot(*(np.array(p) - (origin + step * k))) <= 0.45 * pitch}


# ----------------------------------------------------------------------------------------------- pedine


COLORS_FILE = Path(__file__).with_name("pawn_colors.json")  # prototipi di partenza (primo volume); ogni volume ha i suoi in `lavoro/pawn_colors.json`


def colors_file() -> Path:
    """I colori delle pedine cambiano da un volume all'altro: quelli giusti sono in `lavoro/pawn_colors.json` della cartella dei dati
    (anche vuoto: significa «non usare i colori»). Se manca si parte da quelli del repository."""
    own = config.work_dir() / "pawn_colors.json"
    return own if own.exists() else COLORS_FILE


def _color_vec(hsv_pixels: np.ndarray) -> tuple[float, float, float]:
    """Colore tipico di un gruppo di pixel HSV, come punto di un cono (tinta e saturazione come angolo/raggio, poi luminosità)."""
    h, sat, val = np.median(hsv_pixels.reshape(-1, 3), axis=0)
    angle = 2 * np.pi * h / 180.0
    return float(sat / 255 * np.cos(angle)), float(sat / 255 * np.sin(angle)), float(val / 255)


def load_colors() -> dict[str, dict]:
    path = colors_file()
    return json.loads(path.read_text(encoding="utf-8") or "{}") if path.exists() else {}


def color_similarity(vec: tuple[float, float, float], proto: dict | None) -> float:
    """0..1: quanto il colore somiglia al prototipo della lettera (1 = uguale; 0 oltre 0.2 di distanza)."""
    if not proto:
        return 0.0
    return max(0.0, 1.0 - float(np.linalg.norm(np.array(vec) - np.array(proto["vec"]))) / 0.2)


def _letter_votes(gray_crop: np.ndarray, masks: list[np.ndarray], allowed: set[str]) -> dict[str, float]:
    """Punteggio di ogni lettera per un candidato: più letture (maschere a soglie diverse e il grigio rovesciato), con la lettera
    isolata nel suo riquadro (senza il margine, che porta pezzi di altre cose)."""
    pytesseract = config.setup_tesseract()
    variants = [255 - (m * 255).astype(np.uint8) for m in masks]
    inv = 255 - gray_crop  # lettera chiara su corpo scuro → scura su chiaro
    variants.append(cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1])
    votes: dict[str, float] = {}
    for variant in variants:
        for scale in (2, 3):
            img = cv2.copyMakeBorder(cv2.resize(variant, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC), 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=255)
            data = pytesseract.image_to_data(
                img, lang="ita", config="--psm 10 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ", output_type=pytesseract.Output.DICT
            )
            for t, c in zip(data["text"], data["conf"]):
                t = t.strip()
                if len(t) == 1 and t in allowed and float(c) > 0:
                    votes[t] = votes.get(t, 0.0) + float(c)
    return votes


COLOR_WEIGHT = 300.0  # punti di voto dati a una lettera il cui colore coincide col prototipo (le letture OCR valgono fino a ~600)
MIN_SCORE = 50.0  # voto minimo (una sola lettura ≥ 50) perché una lettera sia assegnata a un candidato


def find_pawns(
    gray: np.ndarray, box: tuple[int, int, int, int], letters: str, bgr: np.ndarray | None = None, colors: dict | None = None, inside=None, collect: list | None = None
) -> list[Pawn]:
    """Le lettere bianche sul corpo delle pedine: componenti chiare rispetto all'intorno, su fondo più scuro. Ogni candidato prende un
    voto per lettera dalle letture OCR e dal colore (se `bgr` c'è e `pawn_colors.json` ha il prototipo di quella lettera); le lettere
    si assegnano ai candidati una per una (il voto più alto vince, poi il successivo)."""
    x0, y0, x1, y1 = box
    crop = gray[y0:y1, x0:x1]
    blur = cv2.GaussianBlur(crop, (5, 5), 0)
    masks = [(cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 101, c) > 0).astype(np.uint8) for c in (-30, -20)]
    count, _, stats, _ = cv2.connectedComponentsWithStats(masks[0], connectivity=8)
    hsv = cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2HSV) if bgr is not None else None
    protos = (load_colors() if colors is None else colors) if hsv is not None else {}
    allowed = set(letters)
    cands = []
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        if not (36 <= h <= 90 and 28 <= w <= 90 and area > 0.15 * w * h):
            continue
        if inside is not None and not inside(x0 + x + w / 2, y0 + y + h / 2):  # fuori dalla griglia: non è una pedina
            continue
        pad = int(0.3 * h)
        ys, xs = slice(max(0, y - pad), y + h + pad), slice(max(0, x - pad), x + w + pad)
        body = masks[0][ys, xs] == 0
        ring = crop[ys, xs][body]
        if ring.size == 0 or (ring < 150).mean() < 0.55:  # il corpo della pedina è più scuro del resto; l'ultima parola è dell'OCR
            continue
        votes = _letter_votes(crop[ys, xs], [m[ys, xs] for m in masks], allowed)
        vec = (0.0, 0.0, 0.0)
        pawn = Pawn("", x0 + x + w / 2, y0 + y + h / 2, int(h), 0.0)
        if hsv is not None:
            body_pixels = body & (crop[ys, xs] < 150)
            vec = _color_vec(hsv[ys, xs][body_pixels]) if body_pixels.any() else vec
            for letter in allowed:
                sim = color_similarity(vec, protos.get(letter))
                if protos.get(letter):  # il colore conferma o smentisce la lettura: smentita pesa meno, conferma aggiunge
                    votes[letter] = votes.get(letter, 0.0) * (0.3 + 0.7 * sim) + COLOR_WEIGHT * sim
        pawn.color = vec
        if collect is not None:
            collect.append(pawn)
        if votes:
            cands.append((pawn, votes))
    pawns: list[Pawn] = []
    taken_letters: set[str] = set()
    taken_cands: set[int] = set()
    pairs = sorted(((v, ci, letter) for ci, (_, votes) in enumerate(cands) for letter, v in votes.items()), reverse=True)
    for score, ci, letter in pairs:
        if ci in taken_cands or letter in taken_letters or score < MIN_SCORE:
            continue
        taken_cands.add(ci)
        taken_letters.add(letter)
        pawn = cands[ci][0]
        pawn.letter, pawn.conf = letter, min(100.0, score / 6)  # sei letture: la confidenza media
        pawns.append(pawn)
    return pawns


def reconcile_with_text(pawns: list[Pawn], mentions: list[tuple[int, int]], issues: list[str]) -> None:
    """Le caselle scritte nei passaggi («in R4 C4») correggono le pedine lette accanto: se la casella della pedina non è fra quelle citate
    ma una citata (non occupata da un'altra pedina) è a meno di una casella di distanza, la pedina si sposta lì. Le caselle citate nei
    passi sono a volte ipotesi («sarebbe in R9 C8…»): per questo vale solo se la pedina era già incerta o in dubbio sulla casella."""
    if not mentions:
        return
    occupied = {(p.row, p.col) for p in pawns}
    for pawn in pawns:
        if (pawn.row, pawn.col) in mentions:
            continue  # già confermata dal testo
        doubtful = pawn.conf < 60 or pawn.margin > 0.3
        near = sorted(
            (float(np.hypot(pawn.fr[0] - r, pawn.fr[1] - c)), (r, c)) for r, c in mentions if (r, c) not in occupied
        )
        if doubtful and near and near[0][0] <= 1.0:
            old = (pawn.row, pawn.col)
            pawn.row, pawn.col = near[0][1]
            pawn.via = "testo"
            occupied.discard(old)
            occupied.add(near[0][1])
            issues.append(f"pedina «{pawn.letter}»: spostata da R{old[0]} C{old[1]} a R{pawn.row} C{pawn.col}, la casella scritta nei passaggi")


# ----------------------------------------------------------------------------------------------- una pagina


def _read_pawns(gray, image, lattice, n_rows, n_cols, map_box, wanted, colors, collect, case: CaseSolution) -> CaseSolution:
    """Le pedine del caso nel reticolo dato (etichette o cornice): lettera, casella, dubbi."""
    def inside(px: float, py: float) -> bool:
        r, c = lattice.cell(px, py)
        return 0.4 <= r <= n_rows + 0.6 and 0.4 <= c <= n_cols + 0.6

    pawns = find_pawns(gray, map_box, "".join(sorted(set(wanted))), image, colors, inside, collect)
    for pawn in (collect if collect is not None else []):
        pawn.fr = tuple(float(v) for v in lattice.cell(pawn.x, pawn.y))
    for pawn in pawns:
        r, c = lattice.cell(pawn.x, pawn.y)
        pawn.fr = (float(r), float(c))
        pawn.row, pawn.col = int(round(r)), int(round(c))
        pawn.margin = float(max(abs(r - pawn.row), abs(c - pawn.col)))
    reconcile_with_text(pawns, case.mentions, case.issues)
    for pawn in pawns:
        if pawn.via == "testo":
            continue
        r, c = pawn.fr
        if case.rows and case.cols and not (1 <= pawn.row <= case.rows and 1 <= pawn.col <= case.cols):
            case.issues.append(f"pedina «{pawn.letter}»: R{pawn.row} C{pawn.col} fuori dalla griglia {case.rows}×{case.cols}")
        elif pawn.conf < 45:
            case.issues.append(f"pedina «{pawn.letter}»: lettera letta con poca sicurezza ({int(pawn.conf)}%), controlla R{pawn.row} C{pawn.col}")
        elif pawn.margin > 0.42:
            case.issues.append(f"pedina «{pawn.letter}» vicina al bordo fra due caselle (R{pawn.row} C{pawn.col}?)")
    missing = sorted(set(wanted) - {p.letter for p in pawns})
    if missing:
        case.issues.append("pedine non trovate: " + ", ".join(missing))
    case.pawns = pawns
    return case


def estimate_size(gray: np.ndarray, corners: list[np.ndarray], minimum: int = 5, maximum: int = 11) -> int:
    """Quante caselle per lato (mappa quadrata) dal passo delle linee sottili della mappa raddrizzata: l'autocorrelazione del profilo di
    linee scure lungo x e y ha un picco a un nodo della griglia; vince il n (da `minimum`) il cui passo, larghezza/n, dà il picco più alto.
    Provata su 5 mappe: 4 giuste (8, 9, 9, 8…), una sbagliata (10 invece di 8): la dimensione resta «da controllare»."""
    tl, tr, br, bl = (np.asarray(c, np.float32) for c in corners)
    width = int(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl)))
    height = int(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr)))
    matrix = cv2.getPerspectiveTransform(np.array([tl, tr, br, bl], np.float32), np.array([[0, 0], [width, 0], [width, height], [0, height]], np.float32))
    flat = cv2.GaussianBlur(cv2.warpPerspective(gray, matrix, (width, height)), (3, 3), 0)
    thin = cv2.morphologyEx(flat, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))).astype(np.float32)
    mx, my = int(0.04 * width), int(0.04 * height)
    curves = []
    for axis, size in ((0, width), (1, height)):
        profile = thin[my : height - my, mx : width - mx].sum(axis=axis)
        profile = profile - np.convolve(profile, np.ones(41) / 41, mode="same")
        ac = np.correlate(profile, profile, mode="full")[len(profile) - 1 :]
        curves.append((size, ac / max(ac[0], 1e-9)))
    scores = {}
    for n in range(minimum, maximum + 1):
        total = 0.0
        for size, ac in curves:
            lag = size / n
            lo, hi = int(lag * 0.95), min(len(ac) - 1, int(lag * 1.05))
            total += float(ac[lo : hi + 1].max()) if hi >= lo else 0.0
        scores[n] = total
    return max(scores, key=scores.get)


def _frame_without_labels(gray, y0, y1, labels, expected):
    """Reticolo dalla sola cornice della mappa, quando le etichette R/C non bastano. Le dimensioni vengono dalla griglia già letta
    (`expected`) o dalle etichette viste (la più alta vale per entrambi gli assi se ne manca uno: le mappe di questo volume sono quadrate).
    Ritorna (reticolo, righe, colonne, rettangolo, nota) o None."""
    corners = rough_frame(gray, y0, y1)
    if corners is None:
        return None
    seen_r, seen_c = max(labels["R"], default=0), max(labels["C"], default=0)
    if expected:
        n_rows, n_cols, source = expected[0], expected[1], "dalla griglia letta"
    else:
        n_rows = n_cols = estimate_size(gray, corners, max(5, seen_r, seen_c))  # etichette sparse: la più alta vista è il minimo per entrambi gli assi
        source = "dal passo delle linee della mappa, supposta quadrata"
    rough = FrameLattice(corners, n_rows, n_cols)
    pts = np.array(corners)
    pitch = float(np.hypot(*(rough.point(2, 1) - rough.point(1, 1))))
    x0, y_top = pts.min(axis=0) - pitch
    x1, y_bottom = pts.max(axis=0) + pitch
    box = (max(0, int(x0)), max(y0, int(y_top)), min(gray.shape[1], int(x1)), min(gray.shape[0], int(y_bottom)))
    refined = fit_frame(gray, box, rough, n_rows, n_cols, {"R": {}, "C": {}})
    return refined or rough, n_rows, n_cols, box, f"mappa: etichette R/C insufficienti, reticolo dalla cornice con griglia {n_rows}×{n_cols} ({source}): da controllare"


def read_page(
    image: np.ndarray,
    letters: list[str] | list[list[str]],
    dims: list[tuple[int, int] | None] | None = None,
    only: int | None = None,
    colors: dict | None = None,
    collect: list | None = None,
) -> list[CaseSolution]:
    """Legge i casi di una pagina di passaggi (dall'alto). `letters`: le lettere dei personaggi di ogni caso (A, B, … V);
    `dims`: righe e colonne attese di ogni caso (dalla griglia già letta), per sapere dove finiscono le etichette.
    `only`: legge solo il caso di quell'indice (0 = sopra, 1 = sotto); gli altri restano vuoti (la lettura costa una trentina di secondi per caso)."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blocks = find_blocks(gray)
    results: list[CaseSolution] = []
    width = gray.shape[1]
    for index, (y0, y1) in enumerate(blocks):
        case = CaseSolution(box=(0, y0, width, y1))
        if only is not None and index != only:
            results.append(case)
            continue
        wanted = letters[index] if letters and isinstance(letters[0], list) else letters
        case.culprit_name, case.mentions = read_text(gray, (y0, y1))
        if not case.culprit_name:
            case.issues.append("assassino: riga «… è l'assassino!» non letta")
        block_box = (0, y0, width, y1)
        labels: dict = {"R": {}, "C": {}}
        try:
            labels = find_labels(gray, block_box, *(dims[index] if dims and index < len(dims) and dims[index] else (0, 0)), y_max=gray.shape[0])
            if len(labels["R"]) < 2 or len(labels["C"]) < 2:  # poche etichette in tutto il blocco: si prova dove stava la mappa nelle prime pagine
                labels = _labels(gray, (int(0.40 * width), y0, int(0.93 * width), y1))
            expected = dims[index] if dims and index < len(dims) else None
            n_rows = max(max(labels["R"], default=0), expected[0] if expected else 0)
            n_cols = max(max(labels["C"], default=0), expected[1] if expected else 0)
            _fill_labels(gray, labels, n_rows, n_cols)
            lattice = Lattice(labels, n_rows, n_cols)
            map_box = lattice.map_box(n_rows, n_cols, (0, y0, width, gray.shape[0]))
        except ValueError as error:
            fallback = _frame_without_labels(gray, y0, y1, labels, dims[index] if dims and index < len(dims) else None)
            if fallback is not None:
                lattice, n_rows, n_cols, map_box, note = fallback
                case.issues.append(note)
                case.rows, case.cols, case.lattice = n_rows, n_cols, "cornice"
                found = _read_pawns(gray, image, lattice, n_rows, n_cols, map_box, wanted, colors, collect, case)
                results.append(found)
                continue
            if (len(labels["R"]) >= 3) != (len(labels["C"]) >= 3):
                missing = "colonne «C»" if len(labels["R"]) >= 3 else "righe «R»"
                case.issues.append(f"mappa: non trovo le etichette delle {missing}: la mappa è forse tagliata dalla foto o coperta, rifotografa la pagina")
            else:
                case.issues.append(f"mappa: {error}")
            results.append(case)
            continue
        case.rows, case.cols = n_rows, n_cols
        framed = fit_frame(gray, map_box, lattice, n_rows, n_cols, labels)
        if framed is not None:
            lattice, case.lattice = framed, "cornice"
        if case.lattice == "affine" and (sorted(labels["R"]) != list(range(1, n_rows + 1)) or sorted(labels["C"]) != list(range(1, n_cols + 1))):
            case.issues.append(f"etichette lette R{sorted(labels['R'])} C{sorted(labels['C'])}: reticolo ricavato da poche (meno preciso)")
        results.append(_read_pawns(gray, image, lattice, n_rows, n_cols, map_box, wanted, colors, collect, case))
    return results


def alphabetical_issue(cards: list[dict]) -> str:
    """Le lettere sono l'ordine alfabetico dei nomi: se i nomi scritti nelle schede non lo rispettano, c'è un errore (nomi o lettere)."""
    named = [c for c in cards if not c.get("victim") and c.get("name")]
    if len(named) < 2:
        return ""
    by_name = sorted(named, key=lambda c: c["name"].lower())
    if [c["letter"] for c in by_name] != [c["letter"] for c in named]:
        found = ", ".join(f"{c['letter']}={c['name']}" for c in named)
        return f"i nomi delle schede non sono in ordine alfabetico ({found}): le lettere A, B, C… sono l'ordine alfabetico dei nomi"
    return ""


def culprit_letter(name: str, cards: list[dict]) -> str:
    """La lettera dell'assassino. Se i nomi di tutte le schede sono scritti, è il posto del suo nome nell'ordine alfabetico (le lettere
    sono l'ordine alfabetico dei nomi: regola del libro, più affidabile della lettera data alla scheda); altrimenti la scheda con quel
    nome, altrimenti l'iniziale."""
    from difflib import SequenceMatcher

    if not name:
        return ""
    others = [c for c in cards if not c.get("victim")]
    named = [c for c in others if c.get("name")]
    best, ratio = None, 0.0
    for card in named:
        r = SequenceMatcher(None, name.lower(), card["name"].lower()).ratio()
        if r > ratio:
            best, ratio = card, r
    if best is not None and ratio >= 0.7:
        if len(named) == len(others):
            rank = sorted(c["name"].lower() for c in named).index(best["name"].lower())
            return chr(ord("A") + rank)
        return best["letter"]
    initial = name[:1].upper()
    return initial if any(c["letter"] == initial for c in others) else ""


# ----------------------------------------------------------------------------------------------- impara i colori


def learn_colors(samples: list[tuple[str, tuple[float, float, float]]]) -> dict[str, dict]:
    """Prototipi {lettera: {vec, n}} dalla mediana dei colori delle pedine di cui si conosce la lettera."""
    by_letter: dict[str, list] = {}
    for letter, vec in samples:
        by_letter.setdefault(letter, []).append(vec)
    return {letter: {"vec": [round(float(x), 4) for x in np.median(np.array(v), axis=0)], "n": len(v)} for letter, v in sorted(by_letter.items())}


def _learn_main(args: list[str]) -> None:
    """`python -m reader.solution learn 1 "3:A=2,5;B=4,4"`: per i casi indicati prende le posizioni vere delle pedine (dalla bozza corretta
    a mano, o scritte come `lettera=riga,colonna;…`), ritrova le pedine sulla foto (senza usare i colori) e registra il colore di
    quelle che stanno nelle caselle giuste."""
    from . import draft as draft_mod
    from . import pipeline

    manifest = json.loads((config.work_dir() / "manifest.json").read_text(encoding="utf-8"))
    by_number = {c["number"]: c for c in manifest["cases"]}
    protos = load_colors()
    samples: list[tuple[str, tuple[float, float, float]]] = []
    for arg in args:
        number, _, spec = arg.partition(":")
        number = int(number)
        entry, draft = by_number[number], draft_mod.load_draft(number)
        if spec:
            truth = {part[0]: tuple(int(x) for x in part[2:].split(",")) for part in spec.split(";") if part}
        elif draft and all(isinstance(p.get("row"), int) for p in draft.get("placements", [])) and draft.get("placements"):
            truth = {p["letter"]: (p["row"], p["col"]) for p in draft["placements"]}
        else:
            print(f"caso {number}: né bozza con posizioni né elenco scritto, salto")
            continue
        if not draft:
            print(f"caso {number}: manca la bozza (servono schede e griglia)")
            continue
        index = 0 if number % 2 == 1 else 1
        letters = [c["letter"] for c in draft["cards"]]
        dims = [(draft["rows"], draft["cols"])] * 2
        for name in entry["passaggi"][:1]:
            cands: list[Pawn] = []
            read_page(pipeline._load_upright(name), letters, dims, only=index, colors={}, collect=cands)
            found = 0
            for letter, (row, col) in truth.items():  # la pedina è quella il cui centro cade nella casella vera (la lettera la sappiamo già)
                near = sorted((float(np.hypot(p.fr[0] - row, p.fr[1] - col)), i) for i, p in enumerate(cands))
                if near and near[0][0] < 0.45:
                    samples.append((letter, cands[near[0][1]].color))
                    found += 1
            print(f"caso {number}: colore preso per {found}/{len(truth)} pedine")
    if samples:
        merged = {**protos, **learn_colors(samples)}
        COLORS_FILE.write_text(json.dumps(merged, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print("colori salvati in", COLORS_FILE.name, {k: v["n"] for k, v in merged.items()})


def learn_from_drafts(min_conf: float = 80.0, min_margin: float = 0.2) -> dict[str, dict]:
    """Impara i colori del volume dalle pedine lette con sicurezza (lettera sicura, al centro della casella) nelle bozze già fatte:
    la lettera di una pedina letta bene dall'OCR è affidabile, il suo colore diventa il prototipo di quella lettera.
    Scrive `lavoro/pawn_colors.json` e lo ritorna."""
    from . import draft as draft_mod

    samples: list[tuple[str, tuple[float, float, float]]] = []
    for path in sorted(draft_mod.drafts_dir().glob("*.json")):
        item = json.loads(path.read_text(encoding="utf-8"))
        for p in item.get("placements") or []:
            if p.get("color") and p.get("conf", 0) >= min_conf and p.get("margin", 1) <= min_margin and not p.get("via"):
                samples.append((p["letter"], tuple(p["color"])))
    protos = {k: v for k, v in learn_colors(samples).items() if v["n"] >= 3}  # con meno di tre pedine il prototipo è un caso
    (config.work_dir() / "pawn_colors.json").write_text(json.dumps(protos, indent=1, ensure_ascii=False) + chr(10), encoding="utf-8")
    return protos


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "learn":
        _learn_main(sys.argv[2:])
    elif len(sys.argv) > 1 and sys.argv[1] == "autolearn":
        print({k: v["n"] for k, v in learn_from_drafts().items()})
    else:
        print("uso: python -m reader.solution learn N [N…] | autolearn")
