"""Pagina dei personaggi: le schede (nome in gotico + frase d'indizio) lette con Tesseract.

La foto è binarizzata (soglia adattiva): le schede colorate e la prospettiva rendono illeggibile l'originale, il bianco/nero no.
Le frasi (carattere normale) si leggono bene e si ritrovano dall'attacco («Era …», «Non era …», «Uno tra …», «La vittima.»);
il nome è in carattere gotico, l'OCR lo sbaglia spesso: si legge a parte, con una sua confidenza, nella fascia sopra la frase.
Le lettere dei personaggi sono l'ordine alfabetico dei nomi (A, B, C…, la vittima per ultima): il nome della scheda k
comincia con la k-esima lettera, e questo permette di correggere i nomi con quelli citati nelle altre frasi.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

import cv2
import numpy as np

from . import config

# Attacchi di frase (maiuscola iniziale: «era su un letto.» a capo dopo «Uno tra lui e Bella» è una continuazione).
_STRONG_START = re.compile(r"^[\W_]{0,2}(?:[EÉ]ra|Non era|C'era|Uno tra|Uno dei|Una tra|Nessuno|La vittima|Entrambi)\b")


@dataclass
class Card:
    name: str
    name_conf: float
    sentence: str
    sentence_conf: float
    box: tuple[int, int, int, int]  # x0, y0, x1, y1 della frase, a piena risoluzione
    victim: bool = False
    letter: str = ""  # A, B, C… (V per la vittima)
    by_name: bool = False  # la lettera viene dall'ordine alfabetico dei nomi letti (altrimenti dall'ordine di lettura della pagina)


@dataclass
class Word:
    text: str
    conf: float
    x: int
    y: int
    w: int
    h: int


def binarize(page: np.ndarray, scale: float = 0.7) -> np.ndarray:
    gray = cv2.cvtColor(page, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return cv2.adaptiveThreshold(cv2.GaussianBlur(gray, (3, 3), 0), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 41, 14)


def text_lines(binary: np.ndarray, scale: float, top_cut: float = 0.14) -> list[tuple[tuple[int, int, int, int], str, float]]:
    """Righe di testo: si fondono i caratteri con una dilatazione, ogni blocco con forma di riga si legge a parte (psm 7).

    Su tutta la pagina l'OCR perde intere frasi (l'analisi del layout si confonde con i ritratti); sulla riga ritagliata no.
    Restituisce (box a piena risoluzione, testo, confidenza).
    """
    pytesseract = config.setup_tesseract()
    height = binary.shape[0]
    ink = (binary == 0).astype(np.uint8) * 255
    ink[: int(top_cut * height)] = 0
    ink[int(0.97 * height) :] = 0
    dilated = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_RECT, (31, 5)))
    count, _, stats, _ = cv2.connectedComponentsWithStats(dilated)
    found = []
    for i in range(1, count):
        x, y, w, h, _ = stats[i]
        if not (20 <= h <= 90 and 60 <= w <= 480):
            continue
        fill = ink[y : y + h, x : x + w].sum() / 255 / (w * h)
        if not 0.07 <= fill <= 0.40:  # i ritratti sono linee sottili (fill basso), le targhette in gotico sono più dense
            continue
        crop = binary[max(0, y - 4) : y + h + 4, max(0, x - 6) : x + w + 6]
        crop = cv2.copyMakeBorder(crop, 8, 8, 8, 8, cv2.BORDER_CONSTANT, value=255)
        data = pytesseract.image_to_data(crop, lang="ita", config="--psm 7", output_type=pytesseract.Output.DICT)
        words = [(t.strip(), float(c)) for t, c in zip(data["text"], data["conf"]) if t.strip() and float(c) >= 0]
        if not words:
            continue
        text = " ".join(t for t, _ in words)
        conf = float(np.mean([c for _, c in words]))
        found.append(((int(x / scale), int(y / scale), int((x + w) / scale), int((y + h) / scale)), text, conf))
    return sorted(found, key=lambda f: (f[0][1], f[0][0]))


def _read_region(binary: np.ndarray, scale: float, anchor: tuple[int, int, int, int], span: tuple[int, int] | None = None) -> tuple[str, float, tuple[int, int, int, int]]:
    """La frase intera, a partire dalla riga d'attacco: il testo è centrato sotto la targhetta, si ritaglia una fascia attorno
    al centro dell'attacco e si legge a righe (psm 6); si tengono le righe che sembrano testo, fino alla targhetta successiva."""
    pytesseract = config.setup_tesseract()
    x0, y0, x1, y1 = anchor
    line_h = max(24, y1 - y0)
    cx = (x0 + x1) / 2
    span = span or (int(cx - 330), int(cx + 330))
    left, right = int(span[0] * scale), int(span[1] * scale)
    top, bottom = int((y0 - 0.25 * line_h) * scale), int((y0 + 4.6 * line_h) * scale)
    crop = binary[max(0, top) : bottom, max(0, left) : right]
    crop = cv2.copyMakeBorder(crop, 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=255)
    data = pytesseract.image_to_data(crop, lang="ita", config="--psm 6", output_type=pytesseract.Output.DICT)
    rows: dict[tuple[int, int, int], list[tuple[str, float, int, int, int, int]]] = {}
    for i, text in enumerate(data["text"]):
        if text.strip() and float(data["conf"][i]) >= 0:
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            rows.setdefault(key, []).append(
                (text.strip(), float(data["conf"][i]), data["left"][i], data["top"][i], data["width"][i], data["height"][i])
            )
    kept: list[str] = []
    confs: list[float] = []
    ys: list[int] = []
    for key in sorted(rows, key=lambda k: min(w[3] for w in rows[k])):
        words = sorted(rows[key], key=lambda w: w[2])
        text = " ".join(w[0] for w in words)
        conf = float(np.mean([w[1] for w in words]))
        letters = len(re.findall(r"[A-Za-zÀ-ÿ]", text))
        if kept and (conf < 35 or letters < 3 or _STRONG_START.match(text)):
            break  # targhetta del personaggio successivo (gotico) o rumore
        if not kept and not _STRONG_START.match(text):
            continue
        kept.append(text)
        confs.append(conf)
        ys.append(max(w[3] + w[5] for w in words))
    if not kept:
        return "", 0.0, anchor
    bottom_y = int((max(0, top) + ys[-1]) / scale)
    return " ".join(kept), float(np.mean(confs)), (x0, y0, x1, max(y1, bottom_y))


def anchors(lines) -> list[tuple[tuple[int, int, int, int], tuple[int, int] | None]]:
    """(riga d'attacco, fascia orizzontale della frase o None = centrata sull'attacco)."""
    return [(box, None) for box, text, _ in lines if _STRONG_START.match(text.strip())]


_WORD_STARTS = re.compile(r"^(?:[EÉ]ra|Non|Uno|Una|C'era)$")


def word_anchors(binary: np.ndarray, scale: float, top_cut: float = 0.14) -> list[tuple[tuple[int, int, int, int], tuple[int, int] | None]]:
    """Attacchi trovati dall'OCR sull'intera pagina: aggiungono quelli che la ricerca per righe perde (es. «La vittima.» in grassetto).

    La parola è il primo pezzo della frase: la frase sta a destra e un po' a sinistra (testo centrato, riga più larga)."""
    pytesseract = config.setup_tesseract()
    data = pytesseract.image_to_data(binary, lang="ita", config="--psm 11", output_type=pytesseract.Output.DICT)
    height = binary.shape[0]
    texts = data["text"]
    found = []
    for i, text in enumerate(texts):
        text = text.strip()
        if not text or float(data["conf"][i]) < 40 or data["top"][i] < top_cut * height:
            continue
        nxt = next((t.strip() for t in texts[i + 1 : i + 3] if t.strip()), "")
        if _WORD_STARTS.match(text) or (text == "La" and nxt.lower().startswith("vitti")):
            x, y, w, h = (int(data[k][i] / scale) for k in ("left", "top", "width", "height"))
            found.append(((x, y, x + w, y + h), (x - 150, x + 520)))
    return found


def _read_name(binary: np.ndarray, scale: float, sentence_box: tuple[int, int, int, int]) -> tuple[str, float]:
    """Il nome in gotico sta in una fascia sopra la frase."""
    pytesseract = config.setup_tesseract()
    x0, y0, x1, y1 = sentence_box
    line_h = max(20, (y1 - y0) // 2)
    cx = (x0 + x1) / 2
    half = max(0.65 * (x1 - x0), 3.2 * line_h)
    top, bottom = int((y0 - 3.6 * line_h) * scale), int((y0 - 0.3 * line_h) * scale)
    left, right = int((cx - half) * scale), int((cx + half) * scale)
    crop = binary[max(0, top) : max(0, bottom), max(0, left) : max(0, right)]
    if crop.size == 0:
        return "", 0.0
    crop = cv2.copyMakeBorder(cv2.resize(crop, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC), 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=255)
    data = pytesseract.image_to_data(crop, lang="ita", config="--psm 7", output_type=pytesseract.Output.DICT)
    best = ("", 0.0)
    for text, conf in zip(data["text"], data["conf"]):
        text = re.sub(r"[^A-Za-zÀ-ÿ]", "", text)
        if len(text) >= 3 and float(conf) > best[1]:
            best = (text, float(conf))
    return best


def read_cards(page: np.ndarray, scale: float = 0.7, by_name: bool = True) -> list[Card]:
    binary = binarize(page, scale)
    height = page.shape[0]
    cards = []
    seen: list[tuple[int, int, int, int]] = []
    found = anchors(text_lines(binary, scale))
    for extra in word_anchors(binary, scale):
        e = extra[0]
        if not any(abs(e[1] - a[0][1]) < 50 and abs(e[0] - a[0][0]) < 450 for a in found):
            found.append(extra)
    for anchor, span in found:
        sentence, conf, box = _read_region(binary, scale, anchor, span)
        if not sentence:
            continue
        if any(abs(box[1] - o[1]) < 40 and abs(box[0] - o[0]) < 450 for o in seen):
            continue
        seen.append(box)
        name, name_conf = _read_name(binary, scale, box)
        cards.append(
            Card(
                name=name,
                name_conf=name_conf,
                sentence=sentence,
                sentence_conf=conf,
                box=box,
                victim=bool(re.match(r"(?i)la vittima", sentence)),
            )
        )
    # «La vittima. Era nell'ultima casella rimasta.»: la seconda riga della targhetta della vittima non è una scheda a parte
    for victim in [c for c in cards if c.victim]:
        for other in [c for c in cards if c is not victim and not c.victim]:
            if 0 <= other.box[1] - victim.box[1] <= 0.04 * height and abs((other.box[0] + other.box[2]) / 2 - (victim.box[0] + victim.box[2]) / 2) < 450:
                victim.sentence = (victim.sentence + " " + other.sentence).strip()
                victim.box = (victim.box[0], victim.box[1], max(victim.box[2], other.box[2]), max(victim.box[3], other.box[3]))
                cards.remove(other)
    # ordine di lettura: file di schede (la «y» della frase raggruppa a ±150 px), poi da sinistra
    cards.sort(key=lambda c: c.box[1])
    rows: list[list[Card]] = []
    for card in cards:
        if rows and abs(card.box[1] - rows[-1][0].box[1]) < 0.06 * height:
            rows[-1].append(card)
        else:
            rows.append([card])
    ordered = [c for row in rows for c in sorted(row, key=lambda c: c.box[0])]
    # la vittima è l'ultima scheda e porta la «V»
    letter = 0
    for card in ordered:
        if card.victim:
            card.letter = "V"
        else:
            card.letter = chr(ord("A") + letter)
            letter += 1
    if by_name:
        # le polaroid non stanno in ordine alfabetico sulla pagina (secondo volume): le lettere sono l'ordine alfabetico dei NOMI
        from . import names

        names.assign_names(page, ordered, mentioned(ordered)[0])
        if names.letters_from_names(ordered):
            for card in ordered:
                card.by_name = True
            ordered.sort(key=lambda c: (c.letter == "V", c.letter))
    return ordered


def resolve_names(cards: list[Card], mentioned: list[str]) -> None:
    """Corregge i nomi gotici con i nomi citati nelle frasi: stessa iniziale della scheda e somiglianza ≥ 0.5."""
    for card in cards:
        if card.victim:
            continue
        candidates = [m for m in mentioned if m[:1].upper() == card.letter]
        best, best_ratio = None, 0.0
        for cand in candidates:
            ratio = SequenceMatcher(None, card.name.lower(), cand.lower()).ratio()
            if ratio > best_ratio:
                best, best_ratio = cand, ratio
        if best and (best_ratio >= 0.5 or not card.name):
            card.name = best
            card.name_conf = max(card.name_conf, 90.0)


_NOT_NAMES = {"Era", "Éra", "Non", "Uno", "Una", "La", "Nessuno", "Entrambi", "Sala", "Cella", "Stanza"}


def mentioned(cards: list[Card]) -> tuple[list[str], list[str]]:
    """(nomi di personaggio, nomi di stanza) citati nelle frasi: le maiuscole a metà frase.

    Una maiuscola dopo «nella/nel/in/alla» è una stanza («Era nella Cucina»); le altre sono personaggi («a sud di Clemenza»)."""
    names: list[str] = []
    rooms: list[str] = []
    for card in cards:
        text = card.sentence
        for match in re.finditer(r"(?:\b(nell[ao]|nel|nell'|alla|in|nella)\s+(?:la\s+|il\s+)?)?((?:Sala|Cella|Stanza|Camera)\s+[A-Z][a-zà-ÿ]+|[A-Z][a-zà-ÿ]{2,})", text):
            word = match.group(2)
            if match.start() == 0 or word.split()[0] in _NOT_NAMES and " " not in word:
                continue
            (rooms if match.group(1) else names).append(word)
    uniq = lambda items: list(dict.fromkeys(items))
    return uniq(names), uniq(rooms)
