"""Inventario delle foto: tipo di pagina e caso di ognuna, poi l'abbinamento dei casi (personaggi + mappa + passaggi).

Il risultato è `MURDOKU_DATA/lavoro/manifest.json`. La classificazione di ogni foto è messa in cache (`lavoro/pagine/<foto>.json`):
l'OCR di 235 foto richiede minuti, non si rifà.

    python -m reader.inventory            # dalla cartella ml/, con MURDOKU_DATA impostata
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import re
from difflib import SequenceMatcher

from . import config
from .pages import PageInfo, classify
from .progress import Progress


def _cache_path(photo: Path) -> Path:
    folder = config.work_dir() / "pagine"
    folder.mkdir(exist_ok=True)
    return folder / (photo.stem + ".json")


def classify_cached(photo: Path) -> PageInfo:
    cache = _cache_path(photo)
    if cache.exists():
        data = json.loads(cache.read_text(encoding="utf-8"))
        data["titles"] = [tuple(t) for t in data["titles"]]
        return PageInfo(**data)
    info = classify(photo)
    cache.write_text(json.dumps(info.as_dict(), ensure_ascii=False), encoding="utf-8")
    return info


def classify_all(workers: int = 4, progress: bool = True) -> list[PageInfo]:
    """Classifica tutte le foto in `workers` processi. La barra avanza a ogni foto finita (in qualunque ordine); le foto già in cache
    contano subito come fatte e non entrano nel calcolo del tempo che manca."""
    photos = config.photos()
    cached = sum(1 for photo in photos if _cache_path(photo).exists())
    bar = Progress(len(photos), "Foto", done_already=cached) if progress else None
    results: dict[int, PageInfo] = {}
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(classify_cached, photo): i for i, photo in enumerate(photos) if not _cache_path(photo).exists()}
        for i, photo in enumerate(photos):
            if i not in futures.values():
                results[i] = classify_cached(photo)  # già in cache: lettura immediata
        for future in as_completed(futures):
            results[futures[future]] = future.result()
            if bar:
                bar.step(photos[futures[future]].name)
    if bar:
        bar.done()
    return [results[i] for i in range(len(photos))]


def _norm(title: str) -> str:
    return re.sub(r"[^a-zà-ÿ ]", "", title.lower()).strip()


def _match_title(title: str, known: dict[int, str]) -> tuple[int | None, float]:
    """Il caso il cui titolo (letto dai personaggi) somiglia di più a `title`."""
    best, best_ratio = None, 0.0
    for number, other in known.items():
        ratio = SequenceMatcher(None, _norm(title), _norm(other)).ratio()
        if ratio > best_ratio:
            best, best_ratio = number, ratio
    return best, best_ratio


def _shot_seconds(name: str) -> int:
    """Secondi dall'inizio del giorno, dal nome del file (AAAAMMGG_HHMMSS)."""
    match = re.search(r"_(\d{2})(\d{2})(\d{2})", name)
    return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3)) if match else -10**6


RETAKE_SECONDS = 8  # due scatti dello stesso tipo a meno di 8 s sono la stessa pagina ripresa due volte


def _label_sequence(pages: list[PageInfo]) -> list[str]:
    """Assegna P (personaggi), M (mappa), X (pagina estranea ai casi, es. regole), S (passaggi) a ogni foto.

    Le pagine dei casi si alternano P, M, P, M: l'OCR del titolo fallisce spesso, il numero di parole italiane è un indizio
    più stabile (i personaggi ne hanno ≥13, le mappe pochissime). Un Viterbi tiene l'alternazione e lascia a X le pagine che
    non c'entrano.
    """
    INF = 1e9
    states = ("P", "M", "X")

    def emission(page: PageInfo, s: str) -> float:
        w = page.words
        if s == "P":
            return max(0, 13 - w) * 0.5 - (3 if page.titles else 0)
        if s == "M":
            return max(0, w - 12) * 0.5
        return 10.0  # più di qualunque P/M sbagliata (max ~6,5): l'alternazione deve vincere, X è per pagine davvero estranee

    def transition(a: str, b: str) -> float:
        if a == "X" or b == "X":
            return 0.0
        return 0.0 if a != b else 4.0

    case_idx = [i for i, p in enumerate(pages) if p.kind != "passaggi"]
    labels = ["S"] * len(pages)
    if not case_idx:
        return labels
    cost = {s: emission(pages[case_idx[0]], s) for s in states}
    back: list[dict[str, str]] = []
    for i in case_idx[1:]:
        new_cost, ptr = {}, {}
        for s in states:
            prev = min(states, key=lambda a: cost[a] + transition(a, s))
            new_cost[s] = cost[prev] + transition(prev, s) + emission(pages[i], s)
            ptr[s] = prev
        back.append(ptr)
        cost = new_cost
    state = min(states, key=lambda s: cost[s])
    path = [state]
    for ptr in reversed(back):
        state = ptr[state]
        path.append(state)
    for i, s in zip(case_idx, reversed(path)):
        labels[i] = s
    return labels


def assign_passaggi(pages: list[PageInfo], labels: list[str], known: dict[int, str], notes: list[str], last_case: int) -> dict[str, int]:
    """Foto di passaggi → indice di pagina g (0-based; la pagina g ha i casi 2g+1 e 2g+2).

    Viterbi sulla sequenza delle foto: g non decresce; resta uguale se la foto è una ripresa della stessa pagina (pochi secondi),
    sale di uno se è la pagina dopo. Il numero del caso letto dal titolo è un'ancora debole (l'OCR sbaglia spesso le cifre del
    gotico); la prima foto è la pagina 0 e l'ultima l'ultima pagina."""
    photos = [p for p, l in zip(pages, labels) if l == "S"]
    if not photos:
        return {}
    n_pages = (last_case + 1) // 2
    INF = 1e9
    anchors: list[set[int]] = []
    for page in photos:
        found: set[int] = set()
        for number, title in page.titles:
            guess, ratio = _match_title(title, known)
            if guess is not None and ratio >= 0.75:
                found.add((guess - 1) // 2)
            elif 1 <= number <= last_case:
                found.add((number - 1) // 2)
        anchors.append(found)

    def emission(i: int, g: int) -> float:
        cost = 0.0
        if i == 0 and g != 0:
            cost += 30
        if i == len(photos) - 1 and g != n_pages - 1:
            cost += 30
        if anchors[i] and g not in anchors[i]:
            cost += 4
        return cost

    def transition(delta: int, gap: int) -> float:
        if delta == 0:
            return 0.0 if gap <= 12 else 2.5
        if delta == 1:
            return 0.0 if gap >= 4 else 2.0
        return {2: 5.0, 3: 9.0}.get(delta, INF)

    cost = [emission(0, g) for g in range(n_pages)]
    back: list[list[int]] = []
    for i in range(1, len(photos)):
        gap = _shot_seconds(photos[i].file) - _shot_seconds(photos[i - 1].file)
        new_cost, ptr = [], []
        for g in range(n_pages):
            best, arg = INF, 0
            for prev in range(max(0, g - 3), g + 1):
                c = cost[prev] + transition(g - prev, gap)
                if c < best:
                    best, arg = c, prev
            new_cost.append(best + emission(i, g))
            ptr.append(arg)
        back.append(ptr)
        cost = new_cost
    g = min(range(n_pages), key=lambda x: cost[x])
    path = [g]
    for ptr in reversed(back):
        g = ptr[g]
        path.append(g)
    path.reverse()
    out = {}
    for page, g, found in zip(photos, path, anchors):
        out[page.file] = g
        if found and g not in found:
            notes.append(f"{page.file}: passaggi assegnati ai casi {2 * g + 1}-{2 * g + 2}, il titolo letto diceva {sorted(2 * f + 1 for f in found)}")
    return out


def build_manifest(pages: list[PageInfo]) -> dict:
    """Abbina le foto ai casi.

    - personaggi/mappa: alternano; il numero del caso è la posizione nella sequenza, ancorata ai numeri letti nei titoli quando
      sono coerenti (il numero letto dall'OCR è spesso sbagliato: «2.» letto «>.», «56.» letto «6.»);
    - passaggi: i titoli in maiuscolo dicono quali casi contiene (due per pagina); la stessa pagina è spesso fotografata più volte.
    """
    labels = _label_sequence(pages)
    cases: dict[int, dict] = {}
    notes: list[str] = []

    def entry(number: int, title: str = "") -> dict:
        e = cases.setdefault(number, {"number": number, "title": title, "personaggi": [], "mappa": [], "passaggi": []})
        if title and not e["title"]:
            e["title"] = title
        return e

    # I casi cominciano alla prima pagina di personaggi con titolo «1.»: prima ci sono la prefazione e le regole del capitolo.
    first = next((i for i, (p, l) in enumerate(zip(pages, labels)) if l == "P" and p.titles and p.titles[0][0] == 1), None)
    if first is None:
        notes.append("nessuna pagina di personaggi con il titolo «1.»: non si sa dove cominciano i casi")
        first = len(pages)
    current = 0
    prev_label, prev_file = "", ""
    mismatches: list[tuple[str, int, int]] = []
    for index, (page, label) in enumerate(zip(pages, labels)):
        if index < first:
            continue
        if label == "P":
            retake = (
                prev_label == "P" and current > 0 and _shot_seconds(page.file) - _shot_seconds(prev_file) <= RETAKE_SECONDS
            )
            prev_label, prev_file = label, page.file
            if retake:
                cases[current]["personaggi"].append(page.file)
                continue
            if current >= 80:
                notes.append(f"{page.file}: pagina di personaggi oltre il caso 80, ignorata")
                continue
            current += 1
            digit = page.titles[0][0] if page.titles else None
            if digit is not None and digit != current:
                mismatches.append((page.file, current, digit))
            entry(current, page.titles[0][1] if page.titles else "")["personaggi"].append(page.file)
        elif label == "M":
            prev_label, prev_file = label, page.file
            if 0 < current <= 80:
                entry(current)["mappa"].append(page.file)

    # Controllo: i numeri letti dall'OCR sono spesso sbagliati ma non dovrebbero sfasarsi sistematicamente (sfasamento = una pagina in più o in meno).
    read_ok = sum(1 for p, l in zip(pages, labels) if l == "P" and p.titles) - len(mismatches)
    notes.append(f"controllo numeri dei titoli: {read_ok} coerenti, {len(mismatches)} diversi dalla sequenza")
    for name, k, digit in mismatches:
        if abs(digit - k) <= 4:  # gli sfasamenti piccoli indicano una pagina contata male; i grandi sono numeri letti male
            notes.append(f"{name}: sequenza {k}, titolo letto {digit}")

    # Passaggi: due casi per pagina, nell'ordine del libro (pagina g = casi 2g+1 e 2g+2). I titoli in gotico si leggono male,
    # quindi i numeri servono da ancora e la sequenza (con le foto ripetute della stessa pagina) fa il resto.
    known = {n: e["title"] for n, e in cases.items() if e["title"]}
    for photo, g in assign_passaggi(pages, labels, known, notes, max(cases) if cases else 80).items():
        for number in (2 * g + 1, 2 * g + 2):
            if number in cases:
                cases[number]["passaggi"].append(photo)

    for e in cases.values():
        for key in ("personaggi", "mappa", "passaggi"):
            e[key] = sorted(set(e[key]))
    return {"cases": [cases[n] for n in sorted(cases)], "notes": notes, "labels": labels}


def main() -> None:
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    pages = classify_all(workers)
    manifest = build_manifest(pages)
    out = config.work_dir() / "manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    kinds: dict[str, int] = {}
    for label in manifest["labels"]:
        kinds[label] = kinds.get(label, 0) + 1
    print("foto per tipo (P personaggi, M mappa, S passaggi, X altro):", kinds, "| ruotate:", sum(1 for p in pages if p.rotation))
    print("casi:", len(manifest["cases"]), "→", out)
    for note in manifest["notes"]:
        print("nota:", note)


if __name__ == "__main__":
    main()
