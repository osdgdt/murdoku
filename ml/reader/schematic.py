"""Lettura della griglia schematica per le matite (in basso a sinistra nella pagina della mappa).

È la parte pulita della pagina: celle bianche, **caselle grigie** (occupate da un oggetto non occupabile: botte, tavolo…), **muri
spessi** fra le stanze, **rettangoli arrotondati** sulle caselle con un oggetto occupabile (sedia, cavallo; il letto è un rettangolo
alto su due caselle). Dà forma della griglia, stanze, caselle bloccate e occupabili; *non* dice di che oggetto si tratta (quello sta
nell'illustrazione).

Le foto hanno prospettiva forte (il passo delle colonne varia del 20%): invece di raddrizzare l'immagine si rilevano le singole
linee come rette (Hough), si costruiscono i vertici dalle intersezioni e si legge ogni cella nel suo quadrilatero.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class Schematic:
    rows: int
    cols: int
    inside: np.ndarray  # bool [rows, cols]: la casella fa parte della mappa
    blocked: np.ndarray  # bool: casella grigia
    wall_right: np.ndarray  # bool [rows, cols]: muro spesso fra (r,c) e (r,c+1)
    wall_down: np.ndarray  # bool [rows, cols]: muro spesso fra (r,c) e (r+1,c)
    marks: list[list[tuple[int, int]]] = field(default_factory=list)  # rettangoli arrotondati: le caselle che coprono
    issues: list[str] = field(default_factory=list)
    vertices: list = field(default_factory=list)  # (rows+1) x (cols+1) punti (x, y) nel ritaglio: il reticolo usato
    box: tuple = ()  # il ritaglio nella pagina

    def rooms(self) -> np.ndarray:
        """Etichetta ogni casella con la stanza (−1 = fuori dalla mappa): componenti connesse non separate da muri spessi."""
        label = -np.ones((self.rows, self.cols), int)
        n = 0
        for r in range(self.rows):
            for c in range(self.cols):
                if not self.inside[r, c] or label[r, c] >= 0:
                    continue
                stack = [(r, c)]
                label[r, c] = n
                while stack:
                    y, x = stack.pop()
                    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                        ny, nx = y + dy, x + dx
                        if not (0 <= ny < self.rows and 0 <= nx < self.cols) or not self.inside[ny, nx] or label[ny, nx] >= 0:
                            continue
                        wall = (
                            self.wall_right[y, x] if dx == 1 else self.wall_right[ny, nx] if dx == -1
                            else self.wall_down[y, x] if dy == 1 else self.wall_down[ny, nx]
                        )
                        if not wall:
                            label[ny, nx] = n
                            stack.append((ny, nx))
                n += 1
        return label


# ---------------------------------------------------------------- localizzare la griglia nella pagina

def locate(page: np.ndarray) -> tuple[int, int, int, int] | None:
    """Rettangolo (x0, y0, x1, y1) della griglia schematica, in coordinate della pagina. Sta nella metà bassa, quasi quadrata."""
    scale = 1400 / max(page.shape[:2])
    small = cv2.resize(page, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    ink = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 12)
    ink[: int(h * 0.45), :] = 0
    closed = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for contour in contours:
        area = cv2.contourArea(contour)
        x, y, bw, bh = cv2.boundingRect(contour)
        if area > 0.025 * w * h and 0.6 < bw / bh < 1.5 and bw < 0.75 * w and (best is None or area > best[0]):
            best = (area, (x, y, bw, bh))
    if best is None:
        return None
    x, y, bw, bh = (v / scale for v in best[1])
    margin = 0.03 * (bw + bh) / 2
    return (int(max(0, x - margin)), int(max(0, y - margin)), int(x + bw + margin), int(y + bh + margin))


# ---------------------------------------------------------------- linee della griglia

def _dark_mask(gray: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    background = cv2.medianBlur(blurred, 61)
    return ((background.astype(int) - blurred.astype(int)) > 14).astype(np.uint8) * 255


def _hough(mask: np.ndarray) -> list[tuple[float, float]]:
    h, w = mask.shape
    lines = cv2.HoughLines(mask, 1, np.pi / 1440, int(0.38 * min(w, h)))
    if lines is None:
        return []
    return [(float(r), float(t)) for r, t in lines.reshape(-1, lines.shape[-1])[:, :2]]


def _position(rho: float, theta: float, w: int, h: int, horizontal: bool) -> float:
    """Dove la retta attraversa il centro del ritaglio: y per le orizzontali, x per le verticali."""
    cx, cy = w / 2, h / 2
    if horizontal:
        return (rho - cx * np.cos(theta)) / np.sin(theta)
    return (rho - cy * np.sin(theta)) / np.cos(theta)


def _family(lines, w, h, horizontal: bool, min_gap: float = 70):
    """Le rette di una famiglia (orizzontali o verticali), una per gruppo: la più votata.

    `lines` arriva da Hough già in ordine di voti decrescenti: si tiene una retta solo se dista almeno `min_gap` px (al centro del
    ritaglio) da quelle già tenute. Tenere invece la prima per posizione sposterebbe le linee spesse anche di 10 px.
    """
    kept: list[tuple[float, float, float]] = []
    for rho, theta in lines:
        deg = np.degrees(theta)
        ok = abs(deg - 90) < 15 if horizontal else (deg < 15 or deg > 165)
        if not ok:
            continue
        pos = _position(rho, theta, w, h, horizontal)
        if all(abs(pos - p) >= min_gap for p, _, _ in kept):
            kept.append((pos, rho, theta))
    return sorted(kept)


def _intersect(h_line, v_line) -> tuple[float, float]:
    (_, r1, t1), (_, r2, t2) = h_line, v_line
    a = np.array([[np.cos(t1), np.sin(t1)], [np.cos(t2), np.sin(t2)]])
    x, y = np.linalg.solve(a, np.array([r1, r2]))
    return float(x), float(y)


def _sample_line(mask: np.ndarray, p0, p1, margin=0.15, band=6) -> float:
    """Quota di pixel scuri lungo il segmento p0-p1 (togliendo i margini), cercando entro ±band pixel."""
    n = 24
    hits = 0
    h, w = mask.shape
    for i in range(n):
        t = margin + (1 - 2 * margin) * i / (n - 1)
        x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
        x0, x1, y0, y1 = int(max(0, x - band)), int(min(w, x + band + 1)), int(max(0, y - band)), int(min(h, y + band + 1))
        if x1 > x0 and y1 > y0 and mask[y0:y1, x0:x1].any():
            hits += 1
    return hits / n


def _line_contrast(gray: np.ndarray, p0, p1, horizontal: bool, near: int, far: int, margin=0.2, threshold=6) -> float:
    """Quota di punti lungo il segmento dove c'è una linea scura: il grigio più scuro entro ±near è più scuro di quello a ±far."""
    n = 28
    hits = 0
    h, w = gray.shape
    for i in range(n):
        t = margin + (1 - 2 * margin) * i / (n - 1)
        x, y = int(p0[0] + (p1[0] - p0[0]) * t), int(p0[1] + (p1[1] - p0[1]) * t)
        if not (far < x < w - far and far < y < h - far):
            continue
        if horizontal:
            line = gray[y - near : y + near + 1, x].min()
            side = (int(gray[y - far, x]) + int(gray[y + far, x])) / 2
        else:
            line = gray[y, x - near : x + near + 1].min()
            side = (int(gray[y, x - far]) + int(gray[y, x + far])) / 2
        if side - line >= threshold:
            hits += 1
    return hits / n


def _groove_width(gray: np.ndarray, p0, p1, horizontal: bool, span: int, margin=0.25) -> float:
    """Larghezza (px) del solco scuro che attraversa il segmento p0-p1: ≈4 per una linea sottile, 12-20 per un muro.

    Per ogni punto si legge il profilo perpendicolare; la soglia è a metà fra il fondo del solco e il lato PIÙ SCURO, così il
    gradino fra una casella grigia e una bianca non conta come spessore. Si prende la mediana lungo il lato.
    """
    n = 16
    widths = []
    h, w = gray.shape
    for i in range(n):
        t = margin + (1 - 2 * margin) * i / (n - 1)
        x, y = int(p0[0] + (p1[0] - p0[0]) * t), int(p0[1] + (p1[1] - p0[1]) * t)
        if horizontal:
            if not (span <= y < h - span and 0 <= x < w):
                continue
            profile = gray[y - span : y + span + 1, x].astype(float)
        else:
            if not (span <= x < w - span and 0 <= y < h):
                continue
            profile = gray[y, x - span : x + span + 1].astype(float)
        dark_side = min(np.median(profile[:8]), np.median(profile[-8:]))
        bottom = profile.min()
        if dark_side - bottom < 12:  # nessun solco
            widths.append(0)
            continue
        threshold = (dark_side + bottom) / 2
        k = int(profile.argmin())
        lo = hi = k
        while lo > 0 and profile[lo - 1] < threshold:
            lo -= 1
        while hi < len(profile) - 1 and profile[hi + 1] < threshold:
            hi += 1
        widths.append(hi - lo + 1)
    return float(np.median(widths)) if widths else 0.0


def _axis_profile(gray: np.ndarray, centre, axis, length: float, other, half_band: float, span: float = 0.85) -> np.ndarray:
    """Luminosità lungo l'asse della casella (da -span a +span lunghezze dal centro), mediata su una fascia stretta."""
    n = 220
    offsets = np.linspace(-half_band, half_band, 5)
    h, w = gray.shape
    values = np.zeros(n)
    for i in range(n):
        s = -span + 2 * span * i / (n - 1)
        acc = []
        for o in offsets:
            x = centre[0] + axis[0] * s * length + other[0] * o
            y = centre[1] + axis[1] * s * length + other[1] * o
            if 0 <= int(x) < w and 0 <= int(y) < h:
                acc.append(float(gray[int(y), int(x)]))
        values[i] = np.mean(acc) if acc else 255.0
    return values


def _minima(profile: np.ndarray, span: float, depth: float) -> list[tuple[float, float]]:
    """Avvallamenti scuri del profilo: (posizione in lunghezze di casella dal centro, profondità)."""
    baseline = float(np.percentile(profile, 70))
    found = []
    for i in range(2, len(profile) - 2):
        if profile[i] <= profile[i - 1] and profile[i] < profile[i + 1] and baseline - profile[i] >= depth:
            if all(abs(i - j[0]) > 4 or profile[i] <= profile[j[0]] for j in [(k,) for k in []]):
                pass
            found.append((i, baseline - profile[i]))
    # tiene un solo minimo per avvallamento (i più profondi, distanti almeno ~0.06 di lunghezza)
    found.sort(key=lambda m: -m[1])
    kept: list[tuple[int, float]] = []
    min_gap = 0.06 / (2 * span) * len(profile)
    for i, d in found:
        if all(abs(i - j) > min_gap for j, _ in kept):
            kept.append((i, d))
    return sorted(((-span + 2 * span * i / (len(profile) - 1)), d) for i, d in kept)


def _has_pair(minima, low: float, high: float) -> bool:
    return any(low <= b[0] - a[0] <= high for i, a in enumerate(minima) for b in minima[i + 1 :])


def _rounded_rectangles(gray, P, inside, blocked, pitch) -> list[list[tuple[int, int]]]:
    """Caselle con un oggetto occupabile: il contorno arrotondato è un quadrato scuro (~0,6 della casella) dentro la casella.

    Il centro calcolato dal reticolo può essere sfasato di un quarto di casella (pagina curva), quindi non si cerca il contorno in
    una posizione fissa: si cerca, lungo l'asse orizzontale, una coppia di avvallamenti a distanza di ~0,6 caselle (i bordi della casella
    distano 1). Un rettangolo su una casella ha la coppia anche in verticale; quello su due caselle (il letto) ha in ciascuna
    casella un solo avvallamento verticale, con la coppia vera spezzata fra le due: si unisce in un oggetto solo.
    """
    rows, cols = inside.shape
    DEPTH = 28.0
    info: dict[tuple[int, int], tuple[bool, bool, int]] = {}  # coppia orizzontale, coppia verticale, avvallamenti verticali profondi
    for r in range(rows):
        for c in range(cols):
            if not inside[r, c] or blocked[r, c]:
                continue
            tl, tr, br, bl = (np.array(P[r][c], float), np.array(P[r][c + 1], float), np.array(P[r + 1][c + 1], float), np.array(P[r + 1][c], float))
            centre = (tl + tr + br + bl) / 4
            u = ((tr - tl) + (br - bl)) / 2
            v = ((bl - tl) + (br - tr)) / 2
            lu, lv = float(np.linalg.norm(u)), float(np.linalg.norm(v))
            if lu < 20 or lv < 20:
                continue
            hor = _minima(_axis_profile(gray, centre, u / lu, lu, v / lv, 0.06 * lv), 0.85, DEPTH)
            ver = _minima(_axis_profile(gray, centre, v / lv, lv, u / lu, 0.06 * lu), 0.85, DEPTH)
            info[(r, c)] = (_has_pair(hor, 0.48, 0.76), _has_pair(ver, 0.48, 0.76), len(ver))

    marks: list[list[tuple[int, int]]] = []
    used: set[tuple[int, int]] = set()
    for (r, c), (hpair, vpair, _) in sorted(info.items()):
        if (r, c) in used or not hpair:
            continue
        if vpair:
            marks.append([(r, c)])
            used.add((r, c))
        elif (r + 1, c) in info and info[(r + 1, c)][0] and not info[(r + 1, c)][1] and (r + 1, c) not in used:
            marks.append([(r, c), (r + 1, c)])  # rettangolo verticale su due caselle (il letto)
            used.update({(r, c), (r + 1, c)})
    return marks


# ---------------------------------------------------------------- lettura

def read(page: np.ndarray, box: tuple[int, int, int, int] | None = None) -> Schematic | None:
    box = box or locate(page)
    if box is None:
        return None
    x0, y0, x1, y1 = box
    crop = page[y0:y1, x0:x1]
    h, w = crop.shape[:2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    mask = _dark_mask(gray)
    lines = _hough(mask)
    H = _family(lines, w, h, True)
    V = _family(lines, w, h, False)
    if len(H) < 3 or len(V) < 3:
        return None

    # Vertici: intersezioni di ogni orizzontale con ogni verticale.
    P = [[_intersect(hl, vl) for vl in V] for hl in H]

    def line_support(i0, j0, i1, j1):
        return _sample_line(mask, P[i0][j0], P[i1][j1])

    # Si scartano le linee esterne che non delimitano celle vere (il bordo della pergamena, l'ombra):
    # una striscia è valida se le linee dell'altro verso la attraversano con inchiostro.
    def trim():
        nonlocal H, V, P
        changed = True
        while changed and len(H) > 2 and len(V) > 2:
            changed = False
            for side in ("left", "right"):
                j0, j1 = (0, 1) if side == "left" else (len(V) - 2, len(V) - 1)
                ok = sum(line_support(i, j0, i, j1) >= 0.5 for i in range(len(H)))
                if ok < max(2, 0.4 * len(H)):
                    V = V[1:] if side == "left" else V[:-1]
                    P = [[_intersect(hl, vl) for vl in V] for hl in H]
                    changed = True
                    break
            if changed:
                continue
            for side in ("top", "bottom"):
                i0, i1 = (0, 1) if side == "top" else (len(H) - 2, len(H) - 1)
                ok = sum(line_support(i0, j, i1, j) >= 0.5 for j in range(len(V)))
                if ok < max(2, 0.4 * len(V)):
                    H = H[1:] if side == "top" else H[:-1]
                    P = [[_intersect(hl, vl) for vl in V] for hl in H]
                    changed = True
                    break

    trim()
    rows, cols = len(H) - 1, len(V) - 1
    issues: list[str] = []
    if rows < 3 or cols < 3:
        return None

    # Caselle dentro: quasi tutti e quattro i lati hanno inchiostro (fuori dalla mappa non ci sono le linee sottili).
    smooth = cv2.GaussianBlur(gray, (3, 3), 0)
    # La pagina è curva: le linee vere si scostano da quelle ricostruite anche di 10-15 px. La finestra di ricerca è larga.
    pitch = (w / cols + h / rows) / 2
    near, far = max(6, int(0.06 * pitch)), max(14, int(0.14 * pitch))
    inside = np.zeros((rows, cols), bool)
    for r in range(rows):
        for c in range(cols):
            sides = (
                _line_contrast(smooth, P[r][c], P[r][c + 1], True, near, far),
                _line_contrast(smooth, P[r + 1][c], P[r + 1][c + 1], True, near, far),
                _line_contrast(smooth, P[r][c], P[r + 1][c], False, near, far),
                _line_contrast(smooth, P[r][c + 1], P[r + 1][c + 1], False, near, far),
            )
            inside[r, c] = sum(s >= 0.3 for s in sides) >= 3

    # Muri spessi: larghezza del solco su ogni lato fra due caselle; i muri sono molto più larghi delle linee sottili.
    widths_right = np.zeros((rows, cols))
    widths_down = np.zeros((rows, cols))
    for r in range(rows):
        for c in range(cols):
            widths_right[r, c] = _groove_width(smooth, P[r][c + 1], P[r + 1][c + 1], False, far * 2)
            widths_down[r, c] = _groove_width(smooth, P[r + 1][c], P[r + 1][c + 1], True, far * 2)
    thin = np.concatenate([widths_right[inside], widths_down[inside]])
    thin = thin[(thin > 0) & (thin <= 8)]
    thin_ref = float(np.median(thin)) if thin.size else 4.0
    # Un muro è ~0,08 della cella, una linea sottile ~0,02: la soglia segue la dimensione della cella (le griglie grandi hanno tratti più fini).
    wall_threshold = max(0.06 * pitch, 2.5 * thin_ref)
    wall_right = widths_right >= wall_threshold
    wall_down = widths_down >= wall_threshold

    # Il bordo esterno della mappa è un muro: serve solo dove una casella dentro ne confina con una fuori.
    # Caselle grigie: si corregge la luce (piano di illuminazione) e si cercano le più scure.
    values = np.zeros((rows, cols))
    centers = np.zeros((rows, cols, 2))
    for r in range(rows):
        for c in range(cols):
            quad = np.array([P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]], np.float32)
            centre = quad.mean(axis=0)
            inner = (quad - centre) * 0.45 + centre
            patch = np.zeros(gray.shape, np.uint8)
            cv2.fillConvexPoly(patch, inner.astype(np.int32), 255)
            values[r, c] = float(np.median(gray[patch > 0])) if patch.any() else 0.0
            centers[r, c] = centre
    blocked = np.zeros((rows, cols), bool)
    cells = np.argwhere(inside)
    if len(cells) >= 6:
        v = np.array([values[r, c] for r, c in cells])
        xy = np.array([centers[r, c] for r, c in cells])
        design = np.column_stack([np.ones(len(cells)), xy[:, 0], xy[:, 1]])
        keep = np.ones(len(cells), bool)
        for _ in range(4):  # piano di illuminazione sulle caselle chiare (si scartano via via le grigie)
            coeff, *_ = np.linalg.lstsq(design[keep], v[keep], rcond=None)
            residual = v - design @ coeff
            keep = residual > -0.06 * np.median(v)
        ratio = v / np.maximum(design @ coeff, 1)
        for (r, c), q in zip(cells, ratio):
            blocked[r, c] = q < 0.92

    marks = _rounded_rectangles(smooth, P, inside, blocked, pitch)
    return Schematic(rows, cols, inside, blocked, wall_right, wall_down, marks, issues, P, box)
