"""Enigmi di logica e numeri: sudoku 4x4 (simboli) e 6x6, sequenze, futoshiki 5x5."""
import math
import random

from reportlab.lib.colors import black, white

from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I, a_capo, stella

CATEGORIA = "Logica e numeri"


# --------------------------------------------------------------------------- sudoku
def _opzioni(g, n, br, bc, r, c):
    usati = set(g[r]) | {g[i][c] for i in range(n)}
    r0, c0 = r // br * br, c // bc * bc
    for i in range(br):
        for j in range(bc):
            usati.add(g[r0 + i][c0 + j])
    return [v for v in range(1, n + 1) if v not in usati]


def conta_soluzioni_sudoku(g, n, br, bc, limite=2):
    """Conta le soluzioni di una griglia sudoku (fermandosi a `limite`). Non modifica g."""
    g = [riga[:] for riga in g]

    def rec():
        migliore = None
        for r in range(n):
            for c in range(n):
                if g[r][c] == 0:
                    o = _opzioni(g, n, br, bc, r, c)
                    if not o:
                        return 0
                    if migliore is None or len(o) < len(migliore[2]):
                        migliore = (r, c, o)
        if migliore is None:
            return 1
        r, c, o = migliore
        tot = 0
        for v in o:
            g[r][c] = v
            tot += rec()
            g[r][c] = 0
            if tot >= limite:
                break
        return tot

    return rec()


def _griglia_piena(n, br, bc, rng):
    g = [[0] * n for _ in range(n)]

    def rec():
        for r in range(n):
            for c in range(n):
                if g[r][c] == 0:
                    o = _opzioni(g, n, br, bc, r, c)
                    rng.shuffle(o)
                    for v in o:
                        g[r][c] = v
                        if rec():
                            return True
                    g[r][c] = 0
                    return False
        return True

    rec()
    return g


def genera_sudoku(n, br, bc, indizi, n_evidenziate, rng):
    sol = _griglia_piena(n, br, bc, rng)
    p = [riga[:] for riga in sol]
    celle = [(r, c) for r in range(n) for c in range(n)]
    rng.shuffle(celle)
    for r, c in celle:
        if sum(1 for rr in range(n) for cc in range(n) if p[rr][cc]) <= indizi:
            break
        v = p[r][c]
        p[r][c] = 0
        if conta_soluzioni_sudoku(p, n, br, bc) != 1:
            p[r][c] = v
    vuote = [(r, c) for r in range(n) for c in range(n) if p[r][c] == 0]
    rng.shuffle(vuote)
    evid, righe_usate = [], set()
    for r, c in vuote:
        if r not in righe_usate:
            evid.append((r, c))
            righe_usate.add(r)
        if len(evid) == n_evidenziate:
            break
    evid.sort()
    return {"n": n, "br": br, "bc": bc, "puzzle": p, "soluzione": sol, "evidenziate": evid}


def _simbolo(c, k, cx, cy, r, spessore=2.2):
    """Simboli semplici per il sudoku dei bambini: cerchio, quadrato pieno, triangolo, stella piena."""
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(spessore)
    if k == 1:
        c.circle(cx, cy, r, stroke=1, fill=0)
    elif k == 2:
        c.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, stroke=1, fill=1)
    elif k == 3:
        p = c.beginPath()
        p.moveTo(cx, cy + r * 1.05)
        p.lineTo(cx - r * 1.05, cy - r * 0.8)
        p.lineTo(cx + r * 1.05, cy - r * 0.8)
        p.close()
        c.drawPath(p, stroke=1, fill=0)
    else:
        stella(c, cx, cy, r * 1.15, pieno=True)


def disegna_sudoku(c, box, d, soluzione, simboli=False):
    x0, y0, w, h = box
    n, br, bc = d["n"], d["br"], d["bc"]
    cella = min(78, (w - 20) / n, (h - 110) / n)
    gx = x0 + (w - cella * n) / 2
    gy = y0 + h - 14  # alto della griglia

    def centro(r, col):
        return gx + (col + 0.5) * cella, gy - (r + 0.5) * cella

    for (r, col) in d["evidenziate"]:
        c.setFillColor(GRIGIO)
        c.rect(gx + col * cella, gy - (r + 1) * cella, cella, cella, stroke=0, fill=1)
    for i in range(n + 1):
        spesso = i % br == 0
        c.setStrokeColor(black)
        c.setLineWidth(3.2 if spesso else 0.9)
        c.line(gx, gy - i * cella, gx + n * cella, gy - i * cella)
        spesso = i % bc == 0
        c.setLineWidth(3.2 if spesso else 0.9)
        c.line(gx + i * cella, gy, gx + i * cella, gy - n * cella)
    for r in range(n):
        for col in range(n):
            dato = d["puzzle"][r][col]
            if not dato and not soluzione:
                continue
            v = d["soluzione"][r][col]
            cx, cy = centro(r, col)
            if simboli:
                _simbolo(c, v, cx, cy, cella * 0.27)
            else:
                c.setFillColor(black if dato else GRIGIO_SCURO)
                c.setFont(FONT_B if dato else FONT_I, cella * 0.55)
                c.drawCentredString(cx, cy - cella * 0.19, str(v))
    yy = gy - n * cella - 34
    if simboli:
        # legenda simbolo = numero
        c.setFont(FONT_B, 13)
        c.setFillColor(black)
        c.drawCentredString(x0 + w / 2, yy + 12, "LEGENDA")
        passo = 105
        inizio = x0 + w / 2 - passo * 1.5
        for k in range(1, 5):
            cx = inizio + (k - 1) * passo
            _simbolo(c, k, cx, yy - 12, 11)
            c.setFillColor(black)
            c.setFont(FONT_B, 18)
            c.drawString(cx + 20, yy - 18, f"= {k}")
        yy -= 36
    c.setFillColor(black)
    c.setFont(FONT, 11)
    c.drawCentredString(
        x0 + w / 2, yy - 8,
        "Le caselle grigie sono quelle della risposta (leggile da sinistra a destra, dall'alto in basso).",
    )


def sudoku_facile(rng):
    d = genera_sudoku(4, 2, 2, 8, 3, rng)
    risposta = "".join(str(d["soluzione"][r][c]) for r, c in d["evidenziate"])
    return Enigma(
        titolo="Sudoku dei simboli",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "Completa la griglia con i 4 simboli: ogni simbolo deve comparire una sola volta in ogni riga, "
            "in ogni colonna e in ogni riquadro 2×2 (quelli con il bordo spesso). "
            "Aiutati con la legenda: ogni simbolo corrisponde a un numero. "
            "Per la risposta, trasforma in numeri i simboli nelle 3 caselle grigie."
        ),
        prompt_risposta="Scrivi i 3 numeri delle caselle grigie, in ordine:",
        risposta=risposta,
        spiegazione="Le soluzioni sono uniche (verificate dal programma). Il codice a 3 cifre si legge dalle caselle grigie.",
        disegna=lambda c, box, sol: disegna_sudoku(c, box, d, sol, simboli=True),
    ), d


def sudoku_medio(rng):
    d = genera_sudoku(6, 2, 3, 15, 4, rng)
    risposta = "".join(str(d["soluzione"][r][c]) for r, c in d["evidenziate"])
    return Enigma(
        titolo="Sudoku 6×6",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "Completa la griglia con i numeri da 1 a 6: ogni numero deve comparire una sola volta in ogni riga, "
            "in ogni colonna e in ogni riquadro (i riquadri sono larghi 3 caselle e alti 2, con il bordo spesso). "
            "Per la risposta leggi i numeri nelle 4 caselle grigie."
        ),
        prompt_risposta="Scrivi i 4 numeri delle caselle grigie, in ordine:",
        risposta=risposta,
        spiegazione="La soluzione è unica (verificata dal programma). Il codice a 4 cifre si legge dalle caselle grigie.",
        disegna=lambda c, box, sol: disegna_sudoku(c, box, d, sol),
    ), d


# --------------------------------------------------------------------------- sequenze
def _aritmetica(a0, passo, n):
    return [a0 + passo * i for i in range(n)]


def _geometrica(a0, q, n):
    return [a0 * q ** i for i in range(n)]


def _quadrati(n):
    return [(i + 1) ** 2 for i in range(n)]


def _fibonacci(n):
    s = [1, 1]
    while len(s) < n:
        s.append(s[-1] + s[-2])
    return s[:n]


def _zigzag(a0, su, giu, n):
    s = [a0]
    for i in range(1, n):
        s.append(s[-1] + (su if i % 2 else -giu))
    return s


# (sequenza, indice del numero nascosto, regola in parole)
SEQUENZE = [
    (_aritmetica(2, 3, 6), 4, "si aggiunge 3 ogni volta"),
    (_geometrica(3, 2, 6), 4, "ogni numero è il doppio del precedente"),
    (_quadrati(6), 4, "sono i quadrati: 1×1, 2×2, 3×3, ..."),
    (_fibonacci(7), 5, "ogni numero è la somma dei due precedenti"),
    (_aritmetica(50, -5, 5), 2, "si toglie 5 ogni volta"),
    (_zigzag(2, 2, 1, 7), 5, "si alterna +2 e −1"),
]


def disegna_sequenze(c, box, soluzione):
    x0, y0, w, h = box
    passo_y = min(78, h / len(SEQUENZE))
    y = y0 + h - 40
    for seq, nasc, regola in SEQUENZE:
        n = len(seq)
        lato = min(54, (w - 20) / n - 8)
        tot = n * lato + (n - 1) * 8
        x = x0 + (w - tot) / 2
        for i, v in enumerate(seq):
            c.setLineWidth(1.8)
            c.setStrokeColor(black)
            c.setFillColor(GRIGIO if i == nasc else white)
            c.roundRect(x, y - lato / 2, lato, lato, 6, stroke=1, fill=1)
            c.setFillColor(black)
            if i != nasc:
                c.setFont(FONT_B, 21)
                c.drawCentredString(x + lato / 2, y - 7, str(v))
            elif soluzione:
                c.setFont(FONT_B, 21)
                c.drawCentredString(x + lato / 2, y - 7, str(v))
            x += lato + 8
        if soluzione:
            c.setFont(FONT_I, 10)
            c.setFillColor(GRIGIO_SCURO)
            c.drawCentredString(x0 + w / 2, y - lato / 2 - 12, regola)
        y -= passo_y


def sequenze_facile():
    mancanti = [seq[i] for seq, i, _ in SEQUENZE]
    totale = sum(mancanti)
    spieg = "; ".join(f"{regola}: manca {seq[i]}" for seq, i, regola in SEQUENZE)
    spieg += f".\nSomma dei numeri mancanti: {' + '.join(map(str, mancanti))} = {totale}."
    return Enigma(
        titolo="Completa la serie",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "In ogni riga i numeri seguono una regola. Scopri la regola e scrivi il numero che manca nella "
            "casella grigia. Poi somma tutti i numeri che hai trovato: il totale è la risposta."
        ),
        prompt_risposta="Scrivi la somma dei 6 numeri mancanti:",
        risposta=str(totale),
        spiegazione=spieg,
        disegna=disegna_sequenze,
    )


# --------------------------------------------------------------------------- futoshiki
def conta_futoshiki(n, dati, vincoli, limite=2):
    """dati: {(r,c): v}; vincoli: insieme di coppie ((r,c),(r2,c2)) che significano cella1 < cella2."""
    g = [[0] * n for _ in range(n)]

    def rec(pos):
        if pos == n * n:
            return 1
        r, c = divmod(pos, n)
        tot = 0
        for v in range(1, n + 1):
            if (r, c) in dati and dati[(r, c)] != v:
                continue
            if any(g[r][j] == v for j in range(c)) or any(g[i][c] == v for i in range(r)):
                continue
            ok = True
            for nb in ((r, c - 1), (r - 1, c)):
                if nb[0] < 0 or nb[1] < 0:
                    continue
                if (nb, (r, c)) in vincoli and not g[nb[0]][nb[1]] < v:
                    ok = False
                if ((r, c), nb) in vincoli and not v < g[nb[0]][nb[1]]:
                    ok = False
            if not ok:
                continue
            g[r][c] = v
            tot += rec(pos + 1)
            g[r][c] = 0
            if tot >= limite:
                break
        return tot

    return rec(0)


def genera_futoshiki(n, rng, min_dati=4, n_evidenziate=4, min_segni=9):
    righe = list(range(n))
    colonne = list(range(n))
    simboli = list(range(1, n + 1))
    rng.shuffle(righe)
    rng.shuffle(colonne)
    rng.shuffle(simboli)
    sol = [[simboli[(righe[r] + colonne[c]) % n] for c in range(n)] for r in range(n)]
    dati = {(r, c): sol[r][c] for r in range(n) for c in range(n)}
    vincoli = set()
    for r in range(n):
        for c in range(n):
            for nb in ((r, c + 1), (r + 1, c)):
                if nb[0] < n and nb[1] < n:
                    a, b = (r, c), nb
                    vincoli.add((a, b) if sol[r][c] < sol[nb[0]][nb[1]] else (b, a))
    tutti = set(vincoli)
    elementi = [("v", v) for v in vincoli] + [("d", k) for k in dati]
    rng.shuffle(elementi)
    for tipo, el in elementi:
        if tipo == "d":
            if len(dati) <= min_dati:
                continue
            v = dati.pop(el)
            if conta_futoshiki(n, dati, vincoli) != 1:
                dati[el] = v
        else:
            vincoli.discard(el)
            if conta_futoshiki(n, dati, vincoli) != 1:
                vincoli.add(el)
    # il minimo assoluto di indizi e' troppo duro per un enigma "medio": rimetto qualche segno
    mancanti = [v for v in tutti if v not in vincoli]
    rng.shuffle(mancanti)
    while len(vincoli) < min_segni and mancanti:
        vincoli.add(mancanti.pop())
    vuote = [(r, c) for r in range(n) for c in range(n) if (r, c) not in dati]
    rng.shuffle(vuote)
    evid, righe_usate = [], set()
    for r, c in vuote:
        if r not in righe_usate:
            evid.append((r, c))
            righe_usate.add(r)
        if len(evid) == n_evidenziate:
            break
    evid.sort()
    return {"n": n, "dati": dati, "vincoli": vincoli, "soluzione": sol, "evidenziate": evid}


def _cuneo(c, cx, cy, orizzontale, punta_a_sinistra_o_in_alto):
    """Disegna il segno < o > (o ∧/∨) con la punta verso il numero più piccolo."""
    a, b = 5, 7
    c.setLineWidth(2.2)
    c.setStrokeColor(black)
    p = c.beginPath()
    if orizzontale:
        s = 1 if punta_a_sinistra_o_in_alto else -1  # s=1: punta a sinistra ('<')
        p.moveTo(cx + s * a, cy + b)
        p.lineTo(cx - s * a, cy)
        p.lineTo(cx + s * a, cy - b)
    else:
        s = 1 if punta_a_sinistra_o_in_alto else -1  # s=1: punta in alto ('∧')
        p.moveTo(cx - b, cy - s * a)
        p.lineTo(cx, cy + s * a)
        p.lineTo(cx + b, cy - s * a)
    c.drawPath(p, stroke=1, fill=0)


def disegna_futoshiki(c, box, d, soluzione):
    x0, y0, w, h = box
    n = d["n"]
    cella, gap = 56, 26
    tot = n * cella + (n - 1) * gap
    gx = x0 + (w - tot) / 2
    gy = y0 + h - 18

    def origine(r, col):
        return gx + col * (cella + gap), gy - r * (cella + gap) - cella

    for r in range(n):
        for col in range(n):
            ox, oy = origine(r, col)
            c.setStrokeColor(black)
            c.setLineWidth(2)
            c.setFillColor(GRIGIO if (r, col) in d["evidenziate"] else white)
            c.rect(ox, oy, cella, cella, stroke=1, fill=1)
            if (r, col) in d["dati"] or soluzione:
                dato = (r, col) in d["dati"]
                c.setFillColor(black if dato else GRIGIO_SCURO)
                c.setFont(FONT_B if dato else FONT_I, 30)
                c.drawCentredString(ox + cella / 2, oy + cella / 2 - 10, str(d["soluzione"][r][col]))
    for (a, b) in d["vincoli"]:
        # a < b, adiacenti
        if a[0] == b[0]:  # orizzontale
            sx = a if a[1] < b[1] else b
            ox, oy = origine(*sx)
            cx, cy = ox + cella + gap / 2, oy + cella / 2
            _cuneo(c, cx, cy, True, a[1] < b[1])  # il minore è a sinistra se a è a sinistra
        else:
            alto = a if a[0] < b[0] else b
            ox, oy = origine(*alto)
            cx, cy = ox + cella / 2, oy - gap / 2
            _cuneo(c, cx, cy, False, a[0] < b[0])
    c.setFillColor(black)
    c.setFont(FONT, 11)
    c.drawCentredString(
        x0 + w / 2, gy - tot - 24,
        "Il segno punta sempre verso il numero più piccolo. Le caselle grigie sono quelle della risposta.",
    )


def futoshiki_medio(rng):
    d = genera_futoshiki(5, rng)
    risposta = "".join(str(d["soluzione"][r][c]) for r, c in d["evidenziate"])
    return Enigma(
        titolo="Futoshiki",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "Riempi la griglia con i numeri da 1 a 5: in ogni riga e in ogni colonna ogni numero compare una "
            "sola volta. Tra due caselle vicine puoi trovare un segno: la sua punta indica il numero più "
            "piccolo, così '<' significa che il numero a sinistra è minore di quello a destra."
        ),
        prompt_risposta="Scrivi i 4 numeri delle caselle grigie, in ordine:",
        risposta=risposta,
        spiegazione="La soluzione è unica (verificata dal programma). Il codice a 4 cifre si legge dalle caselle grigie.",
        disegna=lambda c, box, sol: disegna_futoshiki(c, box, d, sol),
    ), d


def crea(rng_base):
    """Restituisce i 4 enigmi di logica (+ i dati grezzi per i test)."""
    r = lambda k: random.Random(rng_base * 100 + k)
    e1, d1 = sudoku_facile(r(1))
    e2 = sequenze_facile()
    e3, d3 = sudoku_medio(r(3))
    e4, d4 = futoshiki_medio(r(4))
    return [e1, e2, e3, e4], {"sudoku4": d1, "sudoku6": d3, "futoshiki": d4}
