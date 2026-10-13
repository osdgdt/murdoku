"""Enigma 8, 'Quante forme?': conteggi di quadrati, rettangoli e triangoli che danno una parola.

Quattro metodi per passare dai numeri alle lettere (da confrontare):
  scelta_multipla  stessa coppia di figure dell'originale (30 + 13 = 43); si cerchia la riga del totale
                   in una lista "totale -> parola"
  mini_figure      5 figure piccole, 3 opzioni "numero = lettera" accanto a ciascuna
  coordinate       5 coppie di figure danno riga e colonna di una griglia di lettere (battaglia navale)
  tabella_a1       5 figure piccole, conteggi 1-21 convertiti con l'alfabeto A=1, B=2...
"""
import math
import random

from reportlab.lib.colors import black, white

from .alfabeto import ALFABETO, valida_parola
from .base import Enigma, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I

CATEGORIA = "Enigmi visivi"
METODI = ["scelta_multipla", "mini_figure", "coordinate", "tabella_a1"]


# --------------------------------------------------------------------------- conteggi
def quadrati_in_griglia(n):
    return sum(k * k for k in range(1, n + 1))


def rettangoli_in_griglia(a, b):
    """Tutti i rettangoli (quadrati compresi) in una griglia a x b."""
    return a * (a + 1) * b * (b + 1) // 4


def triangoli_in_triangolo(n):
    """Triangoli (dritti e rovesciati) in un triangolo suddiviso in n righe con le parallele ai tre lati."""
    su = sum((n - k + 1) * (n - k + 2) // 2 for k in range(1, n + 1))
    giu = sum((n - 2 * k + 1) * (n - 2 * k + 2) // 2 for k in range(1, n // 2 + 1))
    return su + giu


def conta(fig):
    tipo = fig[0]
    if tipo == "quadrati":
        return quadrati_in_griglia(fig[1])
    if tipo == "rettangoli":
        return rettangoli_in_griglia(fig[1], fig[2])
    return triangoli_in_triangolo(fig[1])


def conta_a_forza_bruta(fig):
    """Controllo indipendente, enumerando tutte le forme possibili sulle linee disegnate."""
    tipo = fig[0]
    if tipo in ("quadrati", "rettangoli"):
        a, b = (fig[1], fig[1]) if tipo == "quadrati" else (fig[1], fig[2])
        tot = 0
        for y1 in range(a + 1):
            for y2 in range(y1 + 1, a + 1):
                for x1 in range(b + 1):
                    for x2 in range(x1 + 1, b + 1):
                        if tipo == "rettangoli" or (y2 - y1) == (x2 - x1):
                            tot += 1
        return tot
    # triangoli: tre rette di famiglie diverse (i=a, j=b, k=c) che si incontrano a due a due dentro la figura
    n = fig[1]
    tot = 0
    for a in range(n + 1):
        for b in range(n + 1):
            for cc in range(n + 1):
                if a + b <= n and a + cc <= n and b + cc <= n and a + b + cc != n:
                    tot += 1
    return tot


def etichetta(fig):
    return {"quadrati": "quadrati", "rettangoli": "rettangoli", "triangoli": "triangoli"}[fig[0]]


# catalogo: conteggio -> figura (usato per fare in modo che ogni lettera abbia una figura)
FIGURA_PER_CONTO = {
    1: ("rettangoli", 1, 1),
    3: ("rettangoli", 1, 2),
    5: ("triangoli", 2),
    6: ("rettangoli", 1, 3),
    9: ("rettangoli", 2, 2),
    10: ("rettangoli", 1, 4),
    13: ("triangoli", 3),
    14: ("quadrati", 3),
    18: ("rettangoli", 2, 3),
}
CATALOGO = list(FIGURA_PER_CONTO.values()) + [("quadrati", 2), ("quadrati", 4), ("triangoli", 4)]
VALORI_COORDINATE = [1, 3, 5, 6, 9, 10]
PAROLE_TABELLA = ["FALCO", "PALCO", "SCOPA", "FALCE", "COPIA", "PIACE"]


# --------------------------------------------------------------------------- disegno
def disegna_figura(c, fig, x, y, lato, spessore=2.4):
    """Disegna la figura dentro il quadrato di lato `lato` con angolo in basso a sinistra (x, y)."""
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(spessore)
    tipo = fig[0]
    if tipo in ("quadrati", "rettangoli"):
        a, b = (fig[1], fig[1]) if tipo == "quadrati" else (fig[1], fig[2])
        cella = lato / max(a, b)
        w, h = cella * b, cella * a
        ox, oy = x + (lato - w) / 2, y + (lato - h) / 2
        for i in range(a + 1):
            c.line(ox, oy + i * cella, ox + w, oy + i * cella)
        for j in range(b + 1):
            c.line(ox + j * cella, oy, ox + j * cella, oy + h)
        return
    n = fig[1]
    alt = lato * math.sqrt(3) / 2
    A = (x + lato / 2, y + (lato + alt) / 2)
    B = (x, y + (lato - alt) / 2)
    C = (x + lato, y + (lato - alt) / 2)

    def pt(i, j, k):
        return ((i * A[0] + j * B[0] + k * C[0]) / n, (i * A[1] + j * B[1] + k * C[1]) / n)

    p = c.beginPath()
    p.moveTo(*A)
    p.lineTo(*B)
    p.lineTo(*C)
    p.close()
    c.drawPath(p, stroke=1, fill=0)
    for t in range(1, n):
        c.line(*pt(t, n - t, 0), *pt(t, 0, n - t))
        c.line(*pt(n - t, t, 0), *pt(0, t, n - t))
        c.line(*pt(n - t, 0, t), *pt(0, n - t, t))


def _casella(c, x, y, w, h, testo=None, grassetto=True, size=16, fill=None):
    c.setLineWidth(1.6)
    c.setStrokeColor(black)
    c.setFillColor(fill if fill is not None else white)
    c.rect(x, y, w, h, stroke=1, fill=1)
    if testo is not None:
        c.setFillColor(black)
        c.setFont(FONT_B if grassetto else FONT, size)
        c.drawCentredString(x + w / 2, y + h / 2 - size * 0.33, str(testo))


# --------------------------------------------------------------------------- metodo 1: scelta multipla
FIG_A, FIG_B = ("quadrati", 4), ("triangoli", 3)
PAROLE_ESCA = ["NAVE", "FARO", "LAGO", "RUOTA", "TORRE", "BOSCO", "PIUMA", "CIELO", "SABBIA", "NEVE"]
TOTALI_ESCA = [29, 39, 40, 42, 44, 47]  # errori tipici: solo quadrati piccoli, solo triangoli dritti, +-1...


def disegna_scelta_multipla(c, box, d, soluzione):
    x0, y0, w, h = box
    lato = 150
    y_fig = y0 + h - 28 - lato
    for k, (fig, titolo, dom) in enumerate(((FIG_A, "FIGURA A", "Quanti QUADRATI vedi?"),
                                            (FIG_B, "FIGURA B", "Quanti TRIANGOLI vedi?"))):
        cx = x0 + w * (0.25 + 0.5 * k)
        c.setFillColor(black)
        c.setFont(FONT_B, 14)
        c.drawCentredString(cx, y_fig + lato + 10, titolo)
        disegna_figura(c, fig, cx - lato / 2, y_fig, lato)
        c.setFont(FONT, 12)
        c.drawCentredString(cx, y_fig - 18, dom)
        c.setFont(FONT_I, 10.5)
        c.drawCentredString(cx, y_fig - 31, "(contali tutti: piccoli, medi e grandi" + (", anche capovolti)" if k else ")"))
        _casella(c, cx - 27, y_fig - 72, 54, 32, conta(fig) if soluzione else None, size=20)
    yt = y_fig - 100
    c.setFillColor(black)
    c.setFont(FONT_B, 12.5)
    c.drawCentredString(x0 + w / 2, yt, "Somma i due numeri: trova il tuo totale nella tabella e leggi la parola.")
    righe = d["righe"]
    cw1, cw2, rh = 90, 170, 25
    tx = x0 + (w - cw1 - cw2) / 2
    ty = yt - 22
    _casella(c, tx, ty - rh, cw1, rh, "TOTALE", size=11, fill=GRIGIO)
    _casella(c, tx + cw1, ty - rh, cw2, rh, "PAROLA", size=11, fill=GRIGIO)
    for k, (tot, parola) in enumerate(righe):
        yy = ty - (k + 2) * rh
        giusta = soluzione and tot == d["totale"]
        _casella(c, tx, yy, cw1, rh, tot, size=15, fill=GRIGIO if giusta else None)
        _casella(c, tx + cw1, yy, cw2, rh, parola, size=15, fill=GRIGIO if giusta else None)


def forme_scelta_multipla(parola, rng):
    totale = conta(FIG_A) + conta(FIG_B)
    esche = [p for p in PAROLE_ESCA if p != parola]
    rng.shuffle(esche)
    righe = [(totale, parola)] + list(zip(TOTALI_ESCA, esche))
    righe.sort()
    d = {"righe": righe, "totale": totale, "parola": parola}
    spieg = (
        f"Quadrati nella griglia 4×4: 16 + 9 + 4 + 1 = {conta(FIG_A)}. Triangoli nella figura B: {conta(FIG_B)} "
        f"(10 con la punta in alto e 3 rovesciati). Totale {totale}: nella tabella la riga {totale} dice {parola}."
    )
    return d, (
        "Nella figura A conta tutti i quadrati nascosti nella griglia: non solo quelli piccoli, anche quelli "
        "formati da più caselle. Nella figura B conta tutti i triangoli, anche quelli grandi o capovolti. "
        "Somma i due risultati e cerca il totale nella tabella: accanto c'è la parola che cerchi."
    ), spieg, disegna_scelta_multipla


# --------------------------------------------------------------------------- metodo 2: mini-figure con opzioni
def _numeri_esca(fig, vero, rng):
    tipo = fig[0]
    candidati = set()
    if tipo == "quadrati":
        candidati.add(fig[1] ** 2)
    elif tipo == "rettangoli":
        candidati.add(fig[1] * fig[2])
    else:
        candidati.add(fig[1] ** 2)
    candidati |= {vero - 1, vero + 1, vero + 2, vero - 2}
    candidati = sorted(x for x in candidati if x >= 1 and x != vero)
    rng.shuffle(candidati)
    return candidati[:2]


def forme_mini_figure(parola, rng):
    assert len(parola) == 5
    prove = []
    for lettera in parola:
        fig = rng.choice(CATALOGO)
        vero = conta(fig)
        esche_n = _numeri_esca(fig, vero, rng)
        lettere_esca = [ch for ch in ALFABETO if ch != lettera]
        rng.shuffle(lettere_esca)
        opzioni = [(vero, lettera)] + [(n, lettere_esca[i]) for i, n in enumerate(esche_n)]
        opzioni.sort()
        prove.append({"fig": fig, "vero": vero, "lettera": lettera, "opzioni": opzioni})
    d = {"prove": prove, "parola": parola}
    spieg = "Conteggi giusti e lettere: " + "; ".join(
        f"figura {i + 1}: {p['vero']} = {p['lettera']}" for i, p in enumerate(prove)) + "."
    return d, (
        "Per ogni figura conta quello che ti chiede la domanda (per le griglie: tutti i rettangoli, anche "
        "i quadrati; per i triangoli: tutti, anche quelli capovolti). Accanto trovi tre opzioni «numero = "
        "lettera»: cerchia quella con il TUO numero. Le cinque lettere, in ordine, formano la parola."
    ), spieg, disegna_mini_figure


def _domanda(fig):
    return {"quadrati": "Quanti QUADRATI?", "rettangoli": "Quanti RETTANGOLI? (anche i quadrati)",
            "triangoli": "Quanti TRIANGOLI?"}[fig[0]]


def disegna_mini_figure(c, box, d, soluzione):
    x0, y0, w, h = box
    prove = d["prove"]
    passo = min(104, (h - 10) / len(prove))
    lato = 72
    for k, pr in enumerate(prove):
        yy = y0 + h - 8 - k * passo - lato
        c.setFillColor(black)
        c.setFont(FONT_B, 13)
        c.drawString(x0, yy + lato / 2 - 4, str(k + 1))
        disegna_figura(c, pr["fig"], x0 + 18, yy, lato)
        c.setFont(FONT, 9.5)
        c.setFillColor(black)
        c.drawString(x0 + 8, yy - 12, _domanda(pr["fig"]))
        x = x0 + 220
        for n, lettera in pr["opzioni"]:
            giusta = n == pr["vero"]
            _casella(c, x, yy + lato / 2 - 18, 82, 36, f"{n}  =  {lettera}", size=17,
                     fill=GRIGIO if (soluzione and giusta) else None)
            x += 96


# --------------------------------------------------------------------------- metodo 3: coordinate
def forme_coordinate(parola, rng):
    assert len(parola) == 5
    celle = [(r, c) for r in range(6) for c in range(6)]
    rng.shuffle(celle)
    scelte = celle[:5]
    griglia = [[None] * 6 for _ in range(6)]
    for (r, c), ch in zip(scelte, parola):
        griglia[r][c] = ch
    for r in range(6):
        for c in range(6):
            if griglia[r][c] is None:
                griglia[r][c] = rng.choice([x for x in ALFABETO])
    coppie = [(VALORI_COORDINATE[r], VALORI_COORDINATE[c], FIGURA_PER_CONTO[VALORI_COORDINATE[r]],
               FIGURA_PER_CONTO[VALORI_COORDINATE[c]]) for r, c in scelte]
    d = {"griglia": griglia, "scelte": scelte, "coppie": coppie, "parola": parola}
    spieg = "Coordinate (riga, colonna) → lettera: " + "; ".join(
        f"({VALORI_COORDINATE[r]}, {VALORI_COORDINATE[c]}) → {ch}" for (r, c), ch in zip(scelte, parola)) + "."
    return d, (
        "Ogni coppia di figure indica una casella della griglia di lettere: il numero della prima figura dice "
        "la RIGA, quello della seconda la COLONNA (i numeri sono quelli scritti ai bordi della griglia). Per le "
        "griglie conta tutti i rettangoli, anche i quadrati; per i triangoli conta tutti i triangoli, anche "
        "quelli capovolti. Le lettere trovate, in ordine, formano la parola."
    ), spieg, disegna_coordinate


def disegna_coordinate(c, box, d, soluzione):
    x0, y0, w, h = box
    coppie = d["coppie"]
    passo = min(104, (h - 10) / len(coppie))
    lato = 60
    for k, (vr, vc, fr, fc) in enumerate(coppie):
        yy = y0 + h - 14 - k * passo - lato
        c.setFillColor(black)
        c.setFont(FONT_B, 13)
        c.drawString(x0, yy + lato / 2 - 4, str(k + 1))
        for m, (fig, nome, valore) in enumerate(((fr, "RIGA", vr), (fc, "COLONNA", vc))):
            fx = x0 + 18 + m * 128
            disegna_figura(c, fig, fx, yy, lato)
            c.setFont(FONT_B, 9.5)
            c.setFillColor(black)
            c.drawString(fx + 2, yy - 12, nome + ":")
            _casella(c, fx + (50 if m == 0 else 70), yy - 22, 30, 20, valore if soluzione else None, size=12)
    # griglia di lettere con intestazioni
    cella = 31
    gx = x0 + w - 6 * cella - 34
    gy = y0 + h - 40 - 6 * cella
    c.setFont(FONT_B, 11)
    c.setFillColor(black)
    c.drawString(gx - 28, gy + 6 * cella + 24, "LA GRIGLIA")
    for i, v in enumerate(VALORI_COORDINATE):
        _casella(c, gx + i * cella, gy + 6 * cella, cella, 22, v, size=12, fill=GRIGIO)
        _casella(c, gx - 28, gy + (5 - i) * cella, 28, cella, v, size=12, fill=GRIGIO)
    for r in range(6):
        for col in range(6):
            giusta = soluzione and (r, col) in d["scelte"]
            _casella(c, gx + col * cella, gy + (5 - r) * cella, cella, cella, d["griglia"][r][col], size=15,
                     fill=GRIGIO if giusta else None)


# --------------------------------------------------------------------------- metodo 4: tabella A=1
def parola_per_tabella(parola):
    """Parola con le sole lettere ottenibili dalle figure del catalogo (conteggi con una figura disponibile)."""
    ok = {ALFABETO[n - 1] for n in FIGURA_PER_CONTO}
    if len(parola) == 5 and all(ch in ok for ch in parola):
        return parola
    return next(p for p in PAROLE_TABELLA if all(ch in ok for ch in p))


def forme_tabella_a1(parola, rng):
    parola = parola_per_tabella(parola)
    assert len(parola) == 5
    prove = []
    for lettera in parola:
        n = ALFABETO.index(lettera) + 1
        prove.append({"fig": FIGURA_PER_CONTO[n], "vero": n, "lettera": lettera})
    d = {"prove": prove, "parola": parola}
    spieg = "Conteggi e lettere (A=1, B=2, ...): " + "; ".join(
        f"{p['vero']} = {p['lettera']}" for p in prove) + "."
    return d, (
        "Conta quello che ti chiede la domanda sotto ogni figura (per le griglie: tutti i rettangoli, anche i "
        "quadrati; per i triangoli: tutti, anche quelli capovolti). Scrivi il numero nella casella e "
        "trasformalo in lettera con la tabella A=1, B=2... Le cinque lettere formano la parola."
    ), spieg, disegna_tabella_a1


def disegna_tabella_a1(c, box, d, soluzione):
    x0, y0, w, h = box
    cw, chh = 44, 44
    y = y0 + h - 14
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawString(x0, y - 4, "LA TABELLA")
    for riga, (inizio, fine) in enumerate(((0, 11), (11, 21))):
        n = fine - inizio
        gx = x0 + (w - 11 * cw) / 2
        for i in range(inizio, fine):
            x = gx + (i - inizio) * cw
            yy = y - 16 - (riga + 1) * chh
            _casella(c, x, yy, cw, chh, None, fill=GRIGIO if riga == 0 else None)
            c.setFillColor(black)
            c.setFont(FONT_B, 17)
            c.drawCentredString(x + cw / 2, yy + 22, ALFABETO[i])
            c.setFont(FONT, 12)
            c.drawCentredString(x + cw / 2, yy + 6, str(i + 1))
    yf = y - 16 - 2 * chh - 40
    prove = d["prove"]
    lato = 78
    passo = (w - 10) / len(prove)
    for k, pr in enumerate(prove):
        cx = x0 + 5 + (k + 0.5) * passo
        c.setFont(FONT_B, 13)
        c.setFillColor(black)
        c.drawString(cx - lato / 2 - 6, yf - 4, str(k + 1))
        disegna_figura(c, pr["fig"], cx - lato / 2, yf - lato - 8, lato)
        c.setFont(FONT, 9)
        c.setFillColor(black)
        base = {"quadrati": "Quanti QUADRATI?", "rettangoli": "Quanti RETTANGOLI?", "triangoli": "Quanti TRIANGOLI?"}
        c.drawCentredString(cx, yf - lato - 22, base[pr["fig"][0]])
        if pr["fig"][0] == "rettangoli":
            c.setFont(FONT_I, 8.5)
            c.drawCentredString(cx, yf - lato - 32, "(anche i quadrati)")
        c.setFont(FONT, 10)
        c.drawString(cx - 40, yf - lato - 56, "n°")
        _casella(c, cx - 22, yf - lato - 64, 34, 24, pr["vero"] if soluzione else None, size=13)
        c.setFont(FONT, 10)
        c.setFillColor(black)
        c.drawString(cx - 40, yf - lato - 90, "lett.")
        _casella(c, cx - 22, yf - lato - 98, 34, 24, pr["lettera"] if soluzione else None, size=15)


# --------------------------------------------------------------------------- enigma
def forme_medio(metodo, parola, seed):
    valida_parola(parola)
    rng = random.Random(seed * 100 + 8)
    if metodo == "scelta_multipla":
        d, consegna, spieg, disegna = forme_scelta_multipla(parola, rng)
    elif metodo == "mini_figure":
        d, consegna, spieg, disegna = forme_mini_figure(parola, rng)
    elif metodo == "coordinate":
        d, consegna, spieg, disegna = forme_coordinate(parola, rng)
    elif metodo == "tabella_a1":
        d, consegna, spieg, disegna = forme_tabella_a1(parola, rng)
    else:
        raise ValueError(f"metodo sconosciuto: {metodo}")
    d["metodo"] = metodo
    parola_finale = d["parola"]
    return Enigma(
        titolo="Quante forme?",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=consegna,
        prompt_risposta="Scrivi la parola che hai trovato:",
        risposta=parola_finale,
        spiegazione=spieg,
        disegna=lambda c, box, sol: disegna(c, box, d, sol),
    ), d
