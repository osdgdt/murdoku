"""I nomi in corsivo sulle polaroid (secondo volume) e le lettere dei personaggi che ne discendono.

Le lettere A, B, C… sono l'ordine alfabetico dei nomi (la vittima è la V). Sulla pagina le polaroid non stanno in ordine alfabetico, quindi
l'ordine di lettura dà le lettere sbagliate: bisogna leggere i nomi. Tesseract li legge solo se ritagliati stretti attorno all'inchiostro
(tutta la striscia sopra la frase no) e a volte sbaglia («Elsa» → «Hsa»): si confrontano con un elenco di nomi italiani
(`names_it.txt`, più i nomi citati nelle frasi) e, se il nome non si legge, la lettera resta da assegnare a mano — meglio di una lettera falsa.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

import cv2
import numpy as np

from . import config

NAMES_FILE = Path(__file__).with_name("names_it.txt")
_NAME = re.compile(r"^[A-ZÀ-Ý][a-zà-ÿ]{2,14}$")
_SENTENCE_WORDS = {"era", "non", "uno", "una", "la", "nessuno", "entrambi", "c'era"}


@dataclass
class Blob:
    box: tuple[int, int, int, int]  # x0, y0, x1, y1 a piena risoluzione
    text: str
    conf: float
    variants: list = field(default_factory=list)


def known_names() -> list[str]:
    return [line.strip() for line in NAMES_FILE.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


def _read_variants(gray: np.ndarray, box: tuple[int, int, int, int]) -> list[tuple[str, float]]:
    """Tutte le letture di una parola in corsivo ritagliata stretta (due binarizzazioni × più scale × due modi di Tesseract):
    il corsivo si legge bene solo con una preparazione fortunata, che si riconosce dopo, confrontandola con i nomi noti."""
    pytesseract = config.setup_tesseract()
    x0, y0, x1, y1 = box
    crop = gray[y0:y1, x0:x1]
    out: list[tuple[str, float]] = []
    for kind in ("otsu", "adaptive"):
        blur = cv2.GaussianBlur(crop, (3, 3), 0)
        if kind == "otsu":
            binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        else:
            binary = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 41, 12)
        for scale in (0.4, 0.5, 0.7):
            img = cv2.copyMakeBorder(cv2.resize(binary, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA), 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=255)
            for psm in (7, 8):
                data = pytesseract.image_to_data(img, lang="ita", config=f"--psm {psm}", output_type=pytesseract.Output.DICT)
                words = [(t.strip(), float(c)) for t, c in zip(data["text"], data["conf"]) if t.strip() and float(c) >= 0]
                if not words:
                    continue
                text = words[0][0] if len(words) == 1 else " ".join(w for w, _ in words)
                text = text.strip("()[]{}|.,;:_ ")
                text = re.sub(r"^[^A-Za-zÀ-ÿ]+", "", text)
                if text:
                    out.append((text, float(np.mean([c for _, c in words]))))
    return out


def find_blobs(gray: np.ndarray, region: tuple[int, int, int, int], threshold: int, unit: float) -> list[Blob]:
    """Le parole scure e larghe in una regione: l'inchiostro più scuro di `threshold`, dilatato in orizzontale (nomi, ma anche righe di frasi).
    I nomi chiari sulla targhetta (grigio pallido) escono solo con soglie alte: per questo si provano più soglie."""
    x0, y0, x1, y1 = region
    ink = (cv2.GaussianBlur(gray[y0:y1, x0:x1], (5, 5), 0) < threshold).astype(np.uint8)
    dilated = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, int(41 * unit)), max(3, int(7 * unit)))))
    count, _, stats, _ = cv2.connectedComponentsWithStats(dilated)
    blobs = []
    for i in range(1, count):
        x, y, w, h, _ = stats[i]
        if not (50 * unit <= h <= 200 * unit and 150 * unit <= w <= 900 * unit and 1.8 < w / h < 9):
            continue
        blobs.append(Blob((int(x0 + x), int(y0 + y), int(x0 + x + w), int(y0 + y + h)), "", 0.0))
    return blobs


def match_name(raw: str, candidates: list[str]) -> tuple[str, float]:
    """Il nome più somigliante a `raw` fra i candidati (0..1)."""
    best, best_ratio = "", 0.0
    for name in candidates:
        ratio = SequenceMatcher(None, raw.lower(), name.lower()).ratio()
        if ratio > best_ratio:
            best, best_ratio = name, ratio
    return best, best_ratio


def best_reading(variants: list[tuple[str, float]], candidates: list[str]) -> tuple[str, float]:
    """(nome, confidenza 0..100) fra tutte le letture di una parola: la lettura che somiglia di più a un nome noto (≥ 0.72) vince e il nome è
    quello noto; senza un nome noto resta la lettura grezza più sicura, con confidenza bassa (non basta per assegnare le lettere)."""
    best, best_score = "", 0.0
    for text, conf in variants:
        text = text[:1].upper() + text[1:]  # la «A» maiuscola in corsivo si legge «q» o «a»
        if not _NAME.match(text):
            continue
        name, ratio = match_name(text, candidates)
        if ratio > best_score:
            best, best_score = name, ratio
    if best_score >= 0.72:
        return best, 100.0 * best_score
    raw = max(variants, key=lambda v: v[1], default=("", 0.0))
    return raw[0], min(raw[1], 50.0)


THRESHOLDS = (80, 105, 130, 155)


def assign_names(page: np.ndarray, cards: list, mentioned: list[str] | None = None) -> None:
    """Per ogni scheda con frase, trova il nome in corsivo appena sopra e lo scrive in `card.name`/`card.name_conf`.

    Il nome sta sopra la frase, centrato (|Δx| < 400 px, fino a 330 px più in alto). Si cercano parole scure e larghe nella fascia con soglie
    sempre più alte (il corsivo grigio pallido esce solo così) e vince la lettura che somiglia di più a un nome noto; le righe delle frasi
    (della scheda sopra) non somigliano a nessun nome e perdono."""
    if not cards:
        return
    gray = cv2.cvtColor(page, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    unit = width / 3060.0
    candidates = list(dict.fromkeys(known_names() + (mentioned or [])))
    claimed: list[tuple[int, int, int, int]] = []
    for card in sorted(cards, key=lambda c: c.box[1]):
        x0, y0, x1, _ = card.box
        cx = (x0 + x1) / 2
        region = (max(0, int(cx - 400 * unit)), max(int(0.1 * height), int(y0 - 340 * unit)), min(width, int(cx + 400 * unit)), max(1, int(y0 + 10 * unit)))
        best: tuple[str, float] = ("", 0.0)
        best_score = -1.0
        seen: list[tuple[int, int, int, int]] = []
        for threshold in THRESHOLDS:
            for blob in find_blobs(gray, region, threshold, unit):
                if any(_overlap(blob.box, other) > 0.5 for other in seen + claimed):
                    continue
                seen.append(blob.box)
                variants = _read_variants(gray, blob.box)
                name, conf = best_reading(variants, candidates)
                score = conf if conf >= 72 else 0.0
                if score > best_score:
                    best, best_score = (name, conf), score
                    best_box = blob.box
            if best_score >= 90:
                break
        card.name, card.name_conf = best
        if best_score > 0:
            claimed.append(best_box)


def _overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    """Quota dell'area di `a` coperta da `b`."""
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return max(0, w) * max(0, h) / max(1, (a[2] - a[0]) * (a[3] - a[1]))


def letters_from_names(cards: list) -> bool:
    """Assegna A, B, C… ai personaggi per ordine alfabetico dei nomi (la vittima è V). Se manca un nome o due sono uguali non si può:
    le lettere restano quelle di lettura e si ritorna False."""
    others = [c for c in cards if not c.victim]
    keys = [c.name.lower() for c in others]
    if not others or any(not _NAME.match(c.name) or c.name_conf < 55 for c in others) or len(set(keys)) != len(keys):
        return False
    for letter, card in zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", sorted(others, key=lambda c: c.name.lower())):
        card.letter = letter
    for card in cards:
        if card.victim:
            card.letter = "V"
    return True
