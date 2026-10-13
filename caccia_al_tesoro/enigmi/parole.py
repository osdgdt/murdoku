"""Logica con le parole: scala di parole (facile), mastermind di lettere (medio), pixel nascosti (medio)."""
import itertools

from reportlab.lib.colors import black, white

from .alfabeto import ALFABETO, valida_parola
from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I

CATEGORIA = "Logica con le parole"


# --------------------------------------------------------------------------- 2) scala di parole
# (parola, posizione cambiata 1-4, definizione). La prima riga è la parola di partenza.
SCALA = [
    ("PILA", None, "Parola di partenza: la mettono nel telecomando"),
    ("PALA", 2, "Attrezzo con cui si scava la terra"),
    ("SALA", 1, "Stanza grande dove si ricevono gli ospiti"),
    ("SALE", 4, "Lo butti nell'acqua della pasta"),
    ("MALE", 1, "È il contrario di bene"),
    ("MARE", 3, "Grande distesa d'acqua salata"),
]


def controlla_scala(scala):
    """Ogni passo cambia esattamente la lettera indicata; restituisce l'ultima parola."""
    for (prec, _, _), (parola, pos, _) in zip(scala, scala[1:]):
        diff = [i for i in range(len(parola)) if parola[i] != prec[i]]
        assert diff == [pos - 1], f"{prec} -> {parola}: differenze in {diff}, attesa {pos - 1}"
    return scala[-1][0]


def disegna_scala(c, box, d, soluzione):
    x0, y0, w, h = box
    scala = d["scala"]
    lato = 34
    passo = min(78, (h - 20) / len(scala))
    y = y0 + h - 24
    for k, (parola, pos, defin) in enumerate(scala):
        yy = y - k * passo - lato
        for i in range(len(parola)):
            xx = x0 + 6 + i * (lato + 4)
            c.setLineWidth(2)
            c.setStrokeColor(black)
            ultima = k == len(scala) - 1
            c.setFillColor(GRIGIO if k == 0 else white)
            c.rect(xx, yy, lato, lato, stroke=1, fill=1)
            mostra = k == 0 or soluzione
            if mostra:
                c.setFillColor(black)
                c.setFont(FONT_B, 22)
                c.drawCentredString(xx + lato / 2, yy + 9, parola[i])
        if pos is not None:
            c.setFillColor(black)
            c.setFont(FONT_B, 11)
            c.drawString(x0 + 160, yy + 22, f"Cambia la lettera n° {pos}")
            c.setFont(FONT, 12.5)
            c.drawString(x0 + 160, yy + 5, defin)
            # freccia dalla riga precedente
            ax = x0 + 6 + lato / 2
            c.setLineWidth(1.4)
            c.line(ax, yy + lato + 2, ax, yy + lato + passo - lato - 6)
            c.setFillColor(black)
            p = c.beginPath()
            p.moveTo(ax - 4, yy + lato + 6)
            p.lineTo(ax + 4, yy + lato + 6)
            p.lineTo(ax, yy + lato + 1)
            p.close()
            c.drawPath(p, stroke=0, fill=1)
        else:
            c.setFillColor(GRIGIO_SCURO)
            c.setFont(FONT_I, 12)
            c.drawString(x0 + 160, yy + 12, defin)


def scala_facile():
    parola = controlla_scala(SCALA)
    d = {"scala": SCALA, "parola": parola}
    return Enigma(
        titolo="La scala di parole",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "Parti dalla parola in alto. A ogni scalino cambia UNA sola lettera (quella indicata) per ottenere "
            "una nuova parola, aiutandoti con la definizione. Scendi tutta la scala: l'ultima parola è la risposta."
        ),
        prompt_risposta="Scrivi l'ultima parola della scala:",
        risposta=parola,
        spiegazione="La scala completa è: " + " → ".join(p for p, _, _ in SCALA) + ".",
        disegna=lambda c, box, sol: disegna_scala(c, box, d, sol),
    ), d


# --------------------------------------------------------------------------- 3) mastermind di lettere
def feedback(tentativo, segreta):
    """(lettere giuste al posto giusto, lettere giuste al posto sbagliato); lettere tutte diverse."""
    esatte = sum(1 for a, b in zip(tentativo, segreta) if a == b)
    comuni = len(set(tentativo) & set(segreta))
    return esatte, comuni - esatte


def _tentativo_casuale(segreta, rng):
    n = len(segreta)
    k_esatte = rng.choice([0, 1, 1, 2])
    k_sbagl = rng.choice([0, 1, 1, 2])
    posizioni = list(range(n))
    rng.shuffle(posizioni)
    tent = [None] * n
    for p in posizioni[:k_esatte]:
        tent[p] = segreta[p]
    libere = [p for p in posizioni[k_esatte:]]
    for p in libere[:k_sbagl]:
        scelte = [ch for ch in segreta if ch not in tent and ch != segreta[p]]
        if scelte:
            tent[p] = rng.choice(scelte)
    altre = [ch for ch in ALFABETO if ch not in segreta and ch not in tent]
    rng.shuffle(altre)
    for p in range(n):
        if tent[p] is None:
            tent[p] = altre.pop()
    return "".join(tent)


def crea_tentativi(segreta, rng, max_tentativi=8):
    """Aggiunge tentativi finché la parola segreta è l'unica sequenza di lettere diverse compatibile."""
    n = len(segreta)
    for _ in range(50):
        tentativi = []
        while len(tentativi) < 3:
            t = _tentativo_casuale(segreta, rng)
            if t != segreta and t not in tentativi:
                tentativi.append(t)
        fb = [feedback(t, segreta) for t in tentativi]
        candidati = [
            p for p in itertools.permutations(ALFABETO, n)
            if all(feedback(p, t) == f for t, f in zip(tentativi, fb))
        ]
        while len(candidati) > 1 and len(tentativi) < max_tentativi:
            migliore = None
            for _ in range(25):
                t = _tentativo_casuale(segreta, rng)
                if t == segreta or t in tentativi:
                    continue
                f = feedback(t, segreta)
                restanti = sum(1 for p in candidati if feedback(p, t) == f)
                if migliore is None or restanti < migliore[0]:
                    migliore = (restanti, t, f)
            if migliore is None:
                break
            _, t, f = migliore
            tentativi.append(t)
            fb.append(f)
            candidati = [p for p in candidati if feedback(p, t) == f]
        if len(candidati) == 1 and 4 <= len(tentativi) <= max_tentativi:
            return list(zip(tentativi, fb))
    raise RuntimeError("impossibile generare il mastermind")


def disegna_mastermind(c, box, d, soluzione):
    x0, y0, w, h = box
    tentativi = d["tentativi"]
    n = len(d["parola"])
    lato = 36
    passo = lato + 14
    y = y0 + h - 40
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, y + 8, "I TENTATIVI")
    c.setFont(FONT_B, 10)
    c.drawString(x0 + 6 + n * (lato + 4) + 28, y + 8, "AL POSTO GIUSTO")
    c.drawString(x0 + 6 + n * (lato + 4) + 28 + 140, y + 8, "AL POSTO SBAGLIATO")
    c.setFont(FONT, 8.5)
    for k, (t, (esatte, sbagl)) in enumerate(tentativi):
        yy = y - (k + 1) * passo - 6
        for i, ch in enumerate(t):
            xx = x0 + 6 + i * (lato + 4)
            c.setLineWidth(1.8)
            c.setStrokeColor(black)
            c.setFillColor(white)
            c.rect(xx, yy, lato, lato, stroke=1, fill=0)
            c.setFillColor(black)
            c.setFont(FONT_B, 22)
            c.drawCentredString(xx + lato / 2, yy + 9, ch)
        bx = x0 + 6 + n * (lato + 4) + 28
        for j in range(n):
            cx = bx + 10 + j * 20
            c.setLineWidth(1.4)
            c.setFillColor(black)
            c.circle(cx, yy + lato / 2, 7, stroke=1, fill=1 if j < esatte else 0)
        bx2 = bx + 140
        for j in range(n):
            cx = bx2 + 10 + j * 20
            c.setFillColor(black)
            c.circle(cx, yy + lato / 2, 7, stroke=1, fill=1 if j < sbagl else 0)
    # parola segreta da trovare
    yy = y - (len(tentativi) + 1) * passo - 30
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, yy + lato + 12, "LA PAROLA SEGRETA")
    for i in range(n):
        xx = x0 + 6 + i * (lato + 4)
        c.setLineWidth(2.2)
        c.setFillColor(GRIGIO)
        c.rect(xx, yy, lato, lato, stroke=1, fill=1)
        if soluzione:
            c.setFillColor(black)
            c.setFont(FONT_B, 22)
            c.drawCentredString(xx + lato / 2, yy + 9, d["parola"][i])
    # promemoria alfabeto
    ya = yy - 46
    c.setFillColor(black)
    c.setFont(FONT_B, 11)
    c.drawString(x0, ya + 28, "L'ALFABETO (cancella le lettere che non vanno bene):")
    cella = (w - 10) / len(ALFABETO)
    for i, ch in enumerate(ALFABETO):
        c.setLineWidth(1)
        c.setFillColor(white)
        c.rect(x0 + 5 + i * cella, ya, cella, 22, stroke=1, fill=0)
        c.setFillColor(black)
        c.setFont(FONT_B, 12)
        c.drawCentredString(x0 + 5 + (i + 0.5) * cella, ya + 6, ch)


def mastermind_medio(parola, rng):
    valida_parola(parola)
    assert len(set(parola)) == len(parola), "il mastermind richiede lettere tutte diverse"
    tentativi = crea_tentativi(parola, rng)
    d = {"parola": parola, "tentativi": tentativi}
    return Enigma(
        titolo="Mastermind di lettere",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            f"Ho pensato a una parola segreta di {len(parola)} lettere, tutte diverse tra loro. "
            "Ogni tentativo qui sotto mostra quante lettere sono giuste e al posto giusto (cerchi neri) e "
            "quante sono nella parola ma al posto sbagliato (cerchi vuoti). Con questi indizi esiste una "
            "sola parola possibile: trovala!"
        ),
        prompt_risposta="Scrivi la parola segreta:",
        risposta=parola,
        spiegazione=(
            f"Con tutti i tentativi l'unica sequenza di {len(parola)} lettere diverse compatibile è {parola} "
            "(verificato dal programma su tutte le combinazioni)."
        ),
        disegna=lambda c, box, sol: disegna_mastermind(c, box, d, sol),
    ), d


# --------------------------------------------------------------------------- 12) pixel nascosti
GLIFI = {
    "A": [".###.", "#...#", "#####", "#...#", "#...#"],
    "B": ["####.", "#...#", "####.", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "####.", "#....", "#####"],
    "F": ["#####", "#....", "####.", "#....", "#...."],
    "G": [".####", "#....", "#..##", "#...#", ".####"],
    "H": ["#...#", "#...#", "#####", "#...#", "#...#"],
    "I": ["#####", "..#..", "..#..", "..#..", "#####"],
    "L": ["#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "####.", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#..##", ".####"],
    "R": ["####.", "#...#", "####.", "#..#.", "#...#"],
    "S": [".####", "#....", ".###.", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "Z": ["#####", "...#.", "..#..", ".#...", "#####"],
}


def _indizi(righe):
    """Lunghezze dei blocchi consecutivi di 1 (lista vuota -> [0])."""
    blocchi, cur = [], 0
    for v in righe:
        if v:
            cur += 1
        elif cur:
            blocchi.append(cur)
            cur = 0
    if cur:
        blocchi.append(cur)
    return tuple(blocchi) or (0,)


_PATTERN_PER_INDIZIO = {}
for _bits in itertools.product((0, 1), repeat=5):
    _PATTERN_PER_INDIZIO.setdefault(_indizi(_bits), []).append(_bits)


def griglia_da_glifo(lettera):
    return [[1 if ch == "#" else 0 for ch in riga] for riga in GLIFI[lettera]]


def indizi_nonogram(griglia):
    righe = [_indizi(r) for r in griglia]
    colonne = [_indizi([griglia[r][c] for r in range(5)]) for c in range(5)]
    return righe, colonne


def risolvi_nonogram(righe, colonne, noti=None, limite=2):
    """Soluzioni del nonogram 5x5. noti: {(r,c): 0/1} celle già svelate."""
    noti = noti or {}
    soluzioni = []

    def ok_riga(r, pat):
        return all(noti.get((r, c), pat[c]) == pat[c] for c in range(5))

    candidati = [[p for p in _PATTERN_PER_INDIZIO[righe[r]] if ok_riga(r, p)] for r in range(5)]

    def rec(r, scelte):
        if len(soluzioni) >= limite:
            return
        if r == 5:
            if all(_indizi([scelte[i][c] for i in range(5)]) == colonne[c] for c in range(5)):
                soluzioni.append([list(x) for x in scelte])
            return
        for p in candidati[r]:
            rec(r + 1, scelte + [p])

    rec(0, [])
    return soluzioni


def crea_pixel_lettera(lettera):
    """Nonogram per la lettera; aggiunge il minimo di celle svelate perché la soluzione sia unica."""
    g = griglia_da_glifo(lettera)
    righe, colonne = indizi_nonogram(g)
    noti = {}
    while True:
        sol = risolvi_nonogram(righe, colonne, noti)
        if len(sol) == 1:
            break
        altra = [s for s in sol if s != g][0]
        diff = [(r, c) for r in range(5) for c in range(5) if g[r][c] != altra[r][c] and (r, c) not in noti]
        # preferisce svelare celle nere: aiutano di più i bambini
        diff.sort(key=lambda rc: -g[rc[0]][rc[1]])
        noti[diff[0]] = g[diff[0][0]][diff[0][1]]
    return {"lettera": lettera, "griglia": g, "righe": righe, "colonne": colonne, "noti": noti}


def disegna_pixel(c, box, d, soluzione):
    x0, y0, w, h = box
    blocchi = d["blocchi"]
    n = len(blocchi)
    per_riga = 3 if n > 4 else 2 if n == 4 else n
    cella = 26
    larg_ind = 30
    alt_ind = 40
    larg = larg_ind + 5 * cella
    alt = alt_ind + 5 * cella + 22
    righe_tot = (n + per_riga - 1) // per_riga
    gap_x = (w - per_riga * larg) / (per_riga + 1)
    passo_y = alt + 36
    for k, b in enumerate(blocchi):
        r_, c_ = divmod(k, per_riga)
        in_riga = min(per_riga, n - r_ * per_riga)
        x_inizio = x0 + (w - in_riga * larg - (in_riga - 1) * gap_x) / 2
        bx = x_inizio + c_ * (larg + gap_x) + larg_ind
        by = y0 + h - 36 - r_ * passo_y - alt_ind - 5 * cella
        c.setFillColor(black)
        c.setFont(FONT_B, 12)
        c.drawString(bx - larg_ind, by + 5 * cella + alt_ind + 8, f"Lettera {k + 1}")
        # indizi colonne (impilati dal basso) e righe
        c.setFont(FONT_B, 10.5)
        for col in range(5):
            for j, v in enumerate(reversed(b["colonne"][col])):
                c.drawCentredString(bx + (col + 0.5) * cella, by + 5 * cella + 5 + j * 11, str(v))
        for r in range(5):
            testo = "  ".join(str(v) for v in b["righe"][r])
            c.drawRightString(bx - 5, by + (4 - r + 0.5) * cella - 4, testo)
        for r in range(5):
            for col in range(5):
                x, y = bx + col * cella, by + (4 - r) * cella
                nero = (b["noti"].get((r, col)) == 1) or (soluzione and b["griglia"][r][col] == 1)
                c.setLineWidth(1.2)
                c.setStrokeColor(black)
                c.setFillColor(black if nero else white)
                c.rect(x, y, cella, cella, stroke=1, fill=1)
                if b["noti"].get((r, col)) == 0:
                    c.setFont(FONT_B, 13)
                    c.setFillColor(GRIGIO_SCURO)
                    c.drawCentredString(x + cella / 2, y + 6, "×")
        c.setLineWidth(2.4)
        c.rect(bx, by, 5 * cella, 5 * cella, stroke=1, fill=0)
        c.setFillColor(black)
        if soluzione:
            c.setFont(FONT_B, 18)
            c.drawCentredString(bx + 2.5 * cella, by - 22, b["lettera"])
    c.setFont(FONT_I, 10.5)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, y0 + 2, "Le crocette × indicano caselle che restano bianche; le caselle già nere sono un aiuto.")


def pixel_medio(parola):
    valida_parola(parola)
    assert 4 <= len(parola) <= 6, "i pixel nascosti reggono parole di 4-6 lettere"
    blocchi = [crea_pixel_lettera(ch) for ch in parola]
    d = {"parola": parola, "blocchi": blocchi}
    return Enigma(
        titolo="Pixel nascosti",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            "Ogni griglia 5×5 nasconde una lettera disegnata con quadratini neri. I numeri accanto alle righe "
            "e sopra le colonne dicono quanti quadratini neri consecutivi ci sono (es. '1 2' = un nero, "
            "almeno un bianco, poi due neri). Annerisci le caselle giuste, leggi le lettere in ordine e "
            "scopri la parola."
        ),
        prompt_risposta="Scrivi la parola formata dalle lettere:",
        risposta=parola,
        spiegazione="Ogni griglia ha una sola soluzione (verificata dal programma) che disegna la lettera: " + ", ".join(parola) + ".",
        disegna=lambda c, box, sol: disegna_pixel(c, box, d, sol),
    ), d
