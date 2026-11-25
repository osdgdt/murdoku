"""Riconoscimento delle pagine: raddrizza (4 rotazioni, OCR), dice se è una pagina di personaggi, di mappa o di passaggi, e di quale caso.

Il testo è la prova: una pagina è letta nella rotazione che dà più parole italiane comuni. Il tipo si decide da quello che c'è scritto:
- **passaggi**: tanti «R3 C2» e «L'ASSASSINO È» (due casi per pagina, titoli in maiuscolo), oppure — nei volumi con la soluzione
  stampata sulla mappa — i passi «Questo isola…» con «è l'assassino!» e due titoli in grassetto «N. Titolo» (due casi per pagina);
- **personaggi**: un titolo «N. Titolo» in alto e frasi «Era …»;
- **mappa**: niente titolo, pochissimo testo (la mappa e la griglia per le matite);
- altro: prefazioni, regole dei capitoli.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import asdict, dataclass, field
from pathlib import Path

import cv2

from . import config, imageio

# Parole italiane molto comuni: servono solo a scegliere la rotazione giusta (non a leggere).
COMMON_WORDS = frozenset(
    "il lo la le gli un una di da in con su per tra fra e è era sono non che chi del della dei delle al alla ai alle nel nella "
    "accanto sedia sedie seduto seduta stanza colonna riga casella caselle persona assassino vittima ogni solo quindi dato "
    "ma o se come più meno una uno due tre dove cosa".split()
)

_TITLE_RE = re.compile(r"(?<!\d)(\d{1,2})\s*[.,«]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ,'’!?\-]{3,60})")
_RC_RE = re.compile(r"\bR\s?\d\s?[,;]?\s?C\s?\d", re.IGNORECASE)
_ISOLA_RE = re.compile(r"\bisol[ae]\b|\bisolano\b")
_BIG_TITLE_RE = re.compile(r"^\W{0,3}(\d{1,2})\s*[.,]\s*([A-Za-zÀ-ÿ][^\n]{3,60})$")
_WORD_RE = re.compile(r"[a-zà-ÿ']+")


@dataclass
class PageInfo:
    file: str
    kind: str  # personaggi | mappa | passaggi | altro
    rotation: int  # quarti di giro orari applicati per leggerla dritta
    words: int  # parole italiane comuni trovate (misura della leggibilità)
    rc_count: int  # quanti «R3 C2» nel testo
    titles: list[tuple[int, str]] = field(default_factory=list)  # (numero del caso, titolo)

    def as_dict(self) -> dict:
        data = asdict(self)
        data["titles"] = [list(t) for t in self.titles]
        return data


def _common_words(text: str) -> int:
    return sum(1 for w in _WORD_RE.findall(text.lower()) if w in COMMON_WORDS)


OSD_MIN_CONFIDENCE = 8.0  # sulle foto di Murdoku1: 12-24 sulle pagine di testo/schede, < 2 sulle mappe (dove non si fida)


def osd_rotation(pytesseract, image) -> tuple[int, float]:
    """(quarti di giro orari per raddrizzare, confidenza) secondo l'OSD di Tesseract; (0, 0) se non risponde."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    try:
        text = pytesseract.image_to_osd(gray, config="--psm 0")
        degrees = int(re.search(r"Rotate:\s*(\d+)", text).group(1))
        confidence = float(re.search(r"Orientation confidence:\s*([\d.]+)", text).group(1))
    except Exception:  # pagina senza testo: l'OSD fallisce
        return 0, 0.0
    return (degrees // 90) % 4, confidence


def _ocr(pytesseract, image, *, psm: int, scale: float, clahe: bool = False) -> str:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if scale != 1:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    if clahe:
        gray = cv2.createCLAHE(2.0, (8, 8)).apply(gray)
    return pytesseract.image_to_string(gray, lang="ita", config=f"--psm {psm}")


def _top_titles(pytesseract, path: Path, rotation: int) -> list[tuple[int, str]]:
    """Il titolo è piccolo: si legge sulla foto a piena risoluzione (ridotta, il numero si perde)."""
    full = imageio.load(path)
    if rotation:
        full = imageio.rotate(full, rotation)
    top = full[: int(full.shape[0] * 0.16), :]
    text = _ocr(pytesseract, top, psm=6, scale=0.7, clahe=True)
    return _titles_in(text)


def _titles_in(text: str) -> list[tuple[int, str]]:
    found = []
    for number, title in _TITLE_RE.findall(text):
        n = int(number)
        if 1 <= n <= 99 and len(title.strip()) >= 4:
            found.append((n, title.strip(" ,.'’-")))
    return found


def _passaggi_titles(text: str) -> list[tuple[int, str]]:
    """Titoli in maiuscolo («52. AL LAGO DEI MAMMUT»): più sicuri dei titoli in minuscolo, che nel testo corrono con altre frasi."""
    found = []
    for number, title in re.findall(r"(?<!\d)(\d{1,2})\s*[.,]\s*([A-ZÀ-Ý][A-ZÀ-Ý ,'’!?\-]{5,60})", text):
        n = int(number)
        if 1 <= n <= 99:
            found.append((n, title.strip(" ,.'’-")))
    return found


def bold_title_lines(pytesseract, image) -> list[tuple[int, str, float]]:
    """Titoli «N. Titolo» in grassetto sans-serif (due per pagina) con la loro posizione: (numero, titolo, y/altezza della pagina).

    Il corpo è in serif e piccolo, i titoli sono alti 1,4-1,7 volte la riga mediana: l'altezza li separa dai passi numerati
    («1. Questo isola…»), che hanno la stessa forma «N. Parola». `image` è BGR o già in grigio."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    gray = cv2.resize(gray, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    data = pytesseract.image_to_data(gray, lang="ita", config="--psm 6", output_type=pytesseract.Output.DICT)
    lines: dict[tuple[int, int, int], list[tuple[int, int, int, str]]] = {}
    for i, word in enumerate(data["text"]):
        if word.strip():
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            lines.setdefault(key, []).append((data["left"][i], data["height"][i], data["top"][i], word))
    if not lines:
        return []
    rows = []
    for words in lines.values():
        words.sort()
        rows.append((statistics.median(w[1] for w in words), min(w[2] for w in words), " ".join(w[3] for w in words)))
    median = statistics.median(h for h, _, _ in rows)
    found = []
    for height, top, text in sorted(rows, key=lambda r: r[1]):
        match = _BIG_TITLE_RE.match(text.strip())
        if match and height >= 1.35 * median and 1 <= int(match.group(1)) <= 99:
            found.append((int(match.group(1)), match.group(2).strip(" ,.'’-|"), top / gray.shape[0]))
    return found


def _bold_titles(pytesseract, image) -> list[tuple[int, str]]:
    return [(n, t) for n, t, _ in bold_title_lines(pytesseract, image)]


def looks_like_passaggi(words: int, rc_count: int, has_assassino: bool, isola: int) -> bool:
    """Le pagine dei passaggi sono fitte di testo con i «R3 C2»; le pagine di regole e di prefazione hanno testo ma quasi nessun «R C».

    Nei volumi con la soluzione stampata sulla mappa non ci sono «R3 C2» ma i passi «Questo isola…» (le pagine dei personaggi
    non li hanno): bastano tre «isola», o due con «assassino»."""
    if words >= 50 and (rc_count >= 3 or (rc_count >= 1 and has_assassino)):
        return True
    return isola >= 3 or (isola >= 2 and has_assassino)


def classify(path: str | Path, *, data_root: Path | None = None) -> PageInfo:
    pytesseract = config.setup_tesseract()
    path = Path(path)
    image = imageio.load(path, max_side=2200)

    # La rotazione 0 è quasi sempre quella giusta (OpenCV applica l'EXIF). Un'altra vince solo se batte nettamente la prima:
    # sulle pagine con poche parole (le mappe) un confronto alla pari sarebbe rumore.
    best_text = _ocr(pytesseract, image, psm=3, scale=0.75)
    best_score, best_rotation = _common_words(best_text), 0
    # L'OSD di Tesseract riconosce l'orientamento anche sulle pagine con poco testo (le schede dei personaggi): il conteggio delle parole
    # no, perché psm 3 legge bene anche il testo di traverso e dà punteggi simili in due rotazioni. Se l'OSD è sicuro decide lui.
    osd_quarter, osd_conf = osd_rotation(pytesseract, image)
    if osd_conf >= OSD_MIN_CONFIDENCE:
        if osd_quarter:
            best_rotation = osd_quarter
            best_text = _ocr(pytesseract, imageio.rotate(image, osd_quarter), psm=3, scale=0.75)
            best_score = _common_words(best_text)
    elif best_score < 25:
        base = best_score
        for quarter in (1, 3, 2):
            text = _ocr(pytesseract, imageio.rotate(image, quarter), psm=3, scale=0.75)
            score = _common_words(text)
            if score >= 15 and score >= base + 8 and score > best_score:
                best_rotation, best_text, best_score = quarter, text, score

    rc_count = len(_RC_RE.findall(best_text))
    has_assassino = "assassin" in best_text.lower()
    isola = len(_ISOLA_RE.findall(best_text.lower()))
    titles: list[tuple[int, str]] = []

    # Le pagine dei passaggi sono fitte di testo con i «R3 C2»; le pagine di regole e di prefazione hanno testo ma quasi nessun «R C».
    if looks_like_passaggi(best_score, rc_count, has_assassino, isola):
        kind = "passaggi"
        # Con la soluzione stampata i «R3, C2» che l'OCR trova sono etichette della mappa («8, CUCINA» non è un titolo): si cercano
        # solo i titoli in grassetto; i titoli in maiuscolo sono dell'altro volume.
        if isola >= 2:
            full = imageio.load(path)
            titles = _bold_titles(pytesseract, imageio.rotate(full, best_rotation) if best_rotation else full)
        else:
            titles = _passaggi_titles(best_text)
    else:
        top = _top_titles(pytesseract, path, best_rotation)
        if top:
            kind, titles = "personaggi", top[:1]
        elif best_score < 12:
            kind = "mappa"
        else:
            kind = "altro"
    return PageInfo(file=path.name, kind=kind, rotation=best_rotation, words=best_score, rc_count=rc_count, titles=titles)
