"""Dieci mini enigmi che trasformano un NUMERO (la soluzione dell'enigma principale) in una PAROLA.

Ogni mini enigma è costruito dal programma per qualsiasi numero (1-99) e qualsiasi parola (3-7 lettere, alfabeto
italiano a 21 lettere): il giocatore conosce solo il numero, la parola è quella nascosta nel messaggio.
"""
import math
import random
from dataclasses import dataclass
from typing import Callable

from reportlab.lib.colors import black, white

from .alfabeto import ALFABETO, N as N_LETTERE, sposta, valida_parola
from .cifrari import _chiave_griglia, _chiave_x, _simbolo_pigpen, _specifiche_pigpen
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I, stella


# --------------------------------------------------------------------------- aritmetica sul numero
def cifre(n):
    return [int(ch) for ch in str(n)]


def somma_cifre(n):
    return sum(cifre(n))


def prodotto_cifre(n):
    p = 1
    for d in cifre(n):
        p *= d
    return p


def chiave_una_cifra(n):
    """Somma delle cifre ripetuta fino a una cifra; se viene 1 si usa 10 (così non è mai una chiave banale)."""
    r = n
    while r >= 10:
        r = somma_cifre(r)
    return 10 if r == 1 else r


def romano(n):
    valori = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, s in valori:
        while n >= v:
            out += s
            n -= v
    return out


def valida(numero, parola):
    if not 1 <= numero <= 99:
        raise ValueError("il numero deve essere tra 1 e 99")
    valida_parola(parola)
    if not 3 <= len(parola) <= 7 or " " in parola:
        raise ValueError("la parola deve avere 3-7 lettere, senza spazi")


@dataclass
class Mini:
    titolo: str
    livello: int  # 1-3 stelle
    consegna: str
    spiegazione: str
    disegna: Callable  # disegna(c, box, soluzione)
    dati: dict


# --------------------------------------------------------------------------- disegno: pezzi comuni
def _cas(c, x, y, w, h, testo=None, size=12, fill=None, grassetto=True, raggio=0, spessore=1.4):
    c.setLineWidth(spessore)
    c.setStrokeColor(black)
    c.setFillColor(fill if fill is not None else white)
    if raggio:
        c.roundRect(x, y, w, h, raggio, stroke=1, fill=1)
    else:
        c.rect(x, y, w, h, stroke=1, fill=1)
    if testo is not None:
        c.setFillColor(black)
        c.setFont(FONT_B if grassetto else FONT, size)
        c.drawCentredString(x + w / 2, y + h / 2 - size * 0.33, str(testo))
    c.setFillColor(black)


def _testo(c, x, y, s, size=10, font=FONT_B):
    c.setFillColor(black)
    c.setFont(font, size)
    c.drawString(x, y, s)


def _etichetta_casella(c, x, y, etichetta, valore, soluzione, w=34, h=22, size=12):
    """Etichetta + casella (col valore solo nella soluzione). Restituisce la x successiva."""
    _testo(c, x, y + 6, etichetta, 10)
    larg = c.stringWidth(etichetta, FONT_B, 10)
    _cas(c, x + larg + 5, y, w, h, valore if soluzione else None, size=size)
    return x + larg + 5 + w + 14


def _striscia(c, x, y, w, numeri=True, riga_alta=26):
    """Striscia dell'alfabeto (21 lettere) con i numeri sotto. y = basso della striscia."""
    cw = w / N_LETTERE
    for i, ch in enumerate(ALFABETO):
        _cas(c, x + i * cw, y, cw, riga_alta, ch, size=11, spessore=1.0, fill=GRIGIO if i % 2 == 0 else None)
        if numeri:
            c.setFillColor(GRIGIO_SCURO)
            c.setFont(FONT, 7)
            c.drawCentredString(x + (i + 0.5) * cw, y - 8, str(i + 1))
    c.setFillColor(black)


def _tabella_a1(c, x, y, w, ch=24, rovescia=False, size=11):
    """Alfabeto in due righe con il numero sotto ogni lettera. Restituisce l'altezza occupata. y = alto."""
    lettere = ALFABETO[::-1] if rovescia else ALFABETO
    cw = w / 11
    for riga, (a, b) in enumerate(((0, 11), (11, 21))):
        for i in range(a, b):
            xx = x + (i - a) * cw
            yy = y - (riga + 1) * ch
            _cas(c, xx, yy, cw, ch, fill=GRIGIO if riga == 0 else None, spessore=1.0)
            c.setFillColor(black)
            c.setFont(FONT_B, size)
            c.drawCentredString(xx + cw / 2, yy + ch - size, lettere[i])
            c.setFont(FONT, size * 0.7)
            c.drawCentredString(xx + cw / 2, yy + 3, str(i + 1))
    return 2 * ch


def _riga_lettere(c, x, y, lettere, lato=30, gap=6, fills=None, size=15, vuote=False):
    """Una riga di caselle con le lettere (vuote=True: caselle bianche da riempire)."""
    for k, ch in enumerate(lettere):
        _cas(c, x + k * (lato + gap), y, lato, lato, None if vuote else ch, size=size,
             fill=(fills[k] if fills else None), raggio=4)


def _x_centrato(w, n, lato, gap):
    return (w - (n * lato + (n - 1) * gap)) / 2


# --------------------------------------------------------------------------- 1) Cesare con chiave = somma delle cifre
def mini_cesare_somma(numero, parola, rng):
    k = somma_cifre(numero)
    cifrato = sposta(parola, k)

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        x = _etichetta_casella(c, x0, y, "Il tuo numero:", numero, sol, w=40)
        x = _etichetta_casella(c, x, y, "Somma delle cifre (CHIAVE):", k, sol, w=34)
        _testo(c, x0, y - 26, "L'ALFABETO", 10)
        _striscia(c, x0, y - 62, w)
        n = len(parola)
        lato, gap = 38, 8
        xm = x0 + _x_centrato(w, n, lato, gap)
        ym = y - 142
        _testo(c, x0, ym + lato + 18, "IL MESSAGGIO CIFRATO", 10)
        for i, ch in enumerate(cifrato):
            _cas(c, xm + i * (lato + gap), ym, lato, lato, ch, size=20, raggio=5)
            _cas(c, xm + i * (lato + gap), ym - lato - 8, lato, lato, parola[i] if sol else None, size=20,
                 fill=GRIGIO, raggio=5)
    return Mini(
        "Cesare con la somma delle cifre", 1,
        "Somma le cifre del tuo numero: il risultato è la CHIAVE. Ogni lettera del messaggio è stata spostata "
        "AVANTI di CHIAVE posti nell'alfabeto: per leggerlo torna INDIETRO di CHIAVE posti, lettera per lettera "
        "(dopo la A si ricomincia dalla Z). Aiutati con la striscia dell'alfabeto.",
        f"Cifre di {numero}: {' + '.join(map(str, cifre(numero)))} = {k}. {cifrato} spostato indietro di {k} dà {parola}.",
        disegna, {"chiave": k, "cifrato": cifrato},
    )


# --------------------------------------------------------------------------- 2) chiave a cifre (Cesare variabile)
def mini_chiave_cifre(numero, parola, rng):
    ds = cifre(numero)
    shifts = [ds[i % len(ds)] for i in range(len(parola))]
    cifrato = "".join(sposta(ch, s) for ch, s in zip(parola, shifts))

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        _etichetta_casella(c, x0, y, "Il tuo numero:", numero, sol, w=40)
        _testo(c, x0, y - 24, "L'ALFABETO", 10)
        _striscia(c, x0, y - 56, w)
        n = len(parola)
        lato, gap = 38, 8
        xm = x0 + 76 + _x_centrato(w - 76, n, lato, gap)
        ym = y - 116
        for riga, (t1, t2) in enumerate((("Messaggio", ""), ("Cifra della", "chiave"), ("Lettera vera", ""))):
            yy = ym - riga * 38
            c.setFillColor(black)
            c.setFont(FONT_B, 8.5)
            c.drawString(x0, yy + 16 if t2 else yy + 10, t1)
            if t2:
                c.drawString(x0, yy + 6, t2)
        for i in range(n):
            xx = xm + i * (lato + gap)
            _cas(c, xx, ym, lato, 30, cifrato[i], size=17, raggio=5)
            _cas(c, xx + 7, ym - 38, lato - 14, 26, shifts[i] if sol else None, size=14, raggio=4)
            _cas(c, xx, ym - 76, lato, 30, parola[i] if sol else None, size=17, fill=GRIGIO, raggio=5)
    return Mini(
        "Cesare con le cifre, una alla volta", 2,
        "Scrivi sotto ogni lettera del messaggio una cifra del tuo numero, ripetendo le cifre in ordine "
        "(es. con 27: 2, 7, 2, 7...). Ogni lettera è stata spostata AVANTI di quel numero di posti: per "
        "leggerla torna INDIETRO. Uno 0 vuol dire che la lettera non si è mossa.",
        f"Cifre di {numero}: {', '.join(map(str, ds))} (ripetute). Spostamenti: {', '.join(map(str, shifts))}. "
        f"{cifrato} -> {parola}.",
        disegna, {"shifts": shifts, "cifrato": cifrato},
    )


# --------------------------------------------------------------------------- 3) casella di partenza in una griglia 10x10
def mini_griglia(numero, parola, rng):
    riga, col = divmod(numero, 10)
    n = len(parola)
    griglia = [[rng.choice(ALFABETO) for _ in range(10)] for _ in range(10)]
    celle = [(riga, (col + i) % 10) for i in range(n)]
    for (r, cc), ch in zip(celle, parola):
        griglia[r][cc] = ch

    def disegna(c, box, sol):
        x0, y0, w, h = box
        cella = min(19.5, (h - 16) / 10)
        gx, gy = x0 + 20, y0 + h - 16
        c.setFillColor(black)
        c.setFont(FONT_B, 8.5)
        for k in range(10):
            c.drawCentredString(gx + (k + 0.5) * cella, gy + 4, str(k))
            c.drawRightString(gx - 5, gy - (k + 0.5) * cella - 3, str(k))
        for r in range(10):
            for cc in range(10):
                evid = sol and (r, cc) in celle
                _cas(c, gx + cc * cella, gy - (r + 1) * cella, cella, cella, griglia[r][cc], size=10,
                     fill=GRIGIO if evid else None, spessore=0.9)
        xr = gx + 10 * cella + 36
        y = y0 + h - 40
        _testo(c, xr, y + 30, "COORDINATE", 10)
        xx = _etichetta_casella(c, xr, y, "Il tuo numero:", numero, sol, w=38)
        _etichetta_casella(c, xr, y - 34, "RIGA (decine):", riga, sol, w=30)
        _etichetta_casella(c, xr, y - 68, "COLONNA (unità):", col, sol, w=30)
        c.setFont(FONT_I, 9)
        c.setFillColor(GRIGIO_SCURO)
        c.drawString(xr, y - 100, f"Poi leggi {n} lettere verso destra,")
        c.drawString(xr, y - 112, "una per casella.")
    return Mini(
        "La casella di partenza", 1,
        f"Le due cifre del tuo numero sono le coordinate di una casella: la prima (le decine) è la RIGA, la seconda "
        f"(le unità) è la COLONNA; un numero con una cifra sola ha riga 0. Parti da quella casella e leggi "
        f"{len(parola)} lettere verso DESTRA; se arrivi al bordo destro riparti dall'inizio della stessa riga.",
        f"Numero {numero}: riga {riga}, colonna {col}. Le {n} lettere lette verso destra formano {parola}.",
        disegna, {"riga": riga, "colonna": col, "griglia": griglia, "celle": celle},
    )


# --------------------------------------------------------------------------- 4) salti sulla ruota di lettere
RUOTA = 23  # primo: con qualsiasi salto da 1 a 10 le lettere della parola cadono su caselle diverse


def mini_ruota(numero, parola, rng):
    k = chiave_una_cifra(numero)
    n = len(parola)
    p0 = rng.randrange(RUOTA)
    posizioni = [(p0 + i * k) % RUOTA for i in range(n)]
    lettere = [rng.choice(ALFABETO) for _ in range(RUOTA)]
    for p, ch in zip(posizioni, parola):
        lettere[p] = ch

    def disegna(c, box, sol):
        x0, y0, w, h = box
        R = min(h / 2 - 30, 84)
        cx, cy = x0 + R + 26, y0 + h / 2
        for i, ch in enumerate(lettere):
            ang = math.radians(90 - i * 360 / RUOTA)
            px, py = cx + R * math.cos(ang), cy + R * math.sin(ang)
            evid = sol and i in posizioni
            c.setStrokeColor(black)
            c.setLineWidth(1.0)
            c.setFillColor(GRIGIO if evid else white)
            c.circle(px, py, 9.2, stroke=1, fill=1)
            c.setFillColor(black)
            c.setFont(FONT_B, 10)
            c.drawCentredString(px, py - 3.5, ch)
            if sol and i in posizioni:
                j = posizioni.index(i)
                c.setFont(FONT_B, 7.5)
                c.drawCentredString(cx + (R + 19) * math.cos(ang), cy + (R + 19) * math.sin(ang) - 2.5, str(j + 1))
        # stella di partenza
        ang = math.radians(90 - p0 * 360 / RUOTA)
        stella(c, cx + (R - 22) * math.cos(ang), cy + (R - 22) * math.sin(ang), 6.5, pieno=True)
        c.setFont(FONT_B, 9)
        c.drawCentredString(cx, cy + 4, "VIA")
        c.setFont(FONT, 8)
        c.drawCentredString(cx, cy - 7, "(la stella)")
        xr = cx + R + 60
        y = y0 + h - 38
        _etichetta_casella(c, xr, y, "Il tuo numero:", numero, sol, w=38)
        _etichetta_casella(c, xr, y - 34, "Salto:", k, sol, w=30)
        c.setFont(FONT_I, 9)
        c.setFillColor(GRIGIO_SCURO)
        for r_, riga in enumerate(("Salto = somma delle cifre;", "se ha due cifre, somma ancora;", "se viene 1, il salto è 10.")):
            c.drawString(xr, y - 62 - r_ * 12, riga)
    return Mini(
        "La ruota dei salti", 2,
        "Somma le cifre del tuo numero (se il risultato ha due cifre, somma ancora; se viene 1 usa 10): è il SALTO. "
        "Parti dalla stella: la sua lettera è la prima della parola. Poi salta di SALTO lettere in senso orario "
        "(non contare la lettera da cui parti): la lettera su cui atterri è la successiva.",
        f"Salto = {k}. Dalla stella si atterra sulle lettere {', '.join(parola)} in ordine: {parola}.",
        disegna, {"salto": k, "posizioni": posizioni, "lettere": lettere, "partenza": p0},
    )


# --------------------------------------------------------------------------- 5) calcoli con il numero
def espressione(j, n, rng):
    """Espressione con N, S (somma cifre), P (prodotto cifre) che vale esattamente j."""
    base = {"N": n, "S": somma_cifre(n), "P": prodotto_cifre(n)}
    opzioni = []
    for nome, v in base.items():
        if nome == "P" and v == 0:
            continue
        if v > j:
            opzioni.append(f"{nome} - {v - j}")
        if v < j:
            opzioni.append(f"{nome} + {j - v}")
        opzioni.append(f"{v + j} - {nome}")
    if 2 * n > j:
        opzioni.append(f"N x 2 - {2 * n - j}")
    return rng.choice(opzioni)


def valuta(espr, n):
    base = {"N": n, "S": somma_cifre(n), "P": prodotto_cifre(n)}
    t = espr.replace("N x 2", str(2 * n))
    for nome, v in base.items():
        t = t.replace(nome, str(v))
    return eval(t)  # espressioni generate qui: solo cifre, + e -


def mini_calcoli(numero, parola, rng):
    indici = [ALFABETO.index(ch) + 1 for ch in parola]
    espr = [espressione(j, numero, rng) for j in indici]
    assert [valuta(e, numero) for e in espr] == indici

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        x = _etichetta_casella(c, x0, y, "N (il tuo numero):", numero, sol, w=36)
        x = _etichetta_casella(c, x, y, "S (somma cifre):", somma_cifre(numero), sol, w=30)
        _etichetta_casella(c, x, y, "P (prodotto cifre):", prodotto_cifre(numero), sol, w=36)
        _tabella_a1(c, x0, y - 12, w, ch=26)
        righe = (len(parola) + 1) // 2
        for i, e in enumerate(espr):
            col, r = divmod(i, righe)
            xx = x0 + col * (w / 2)
            yy = y - 12 - 52 - 12 - (r + 1) * 28
            c.setFillColor(black)
            c.setFont(FONT_B, 10)
            c.drawString(xx, yy + 8, f"{i + 1})")
            c.setFont(FONT, 12)
            c.drawString(xx + 16, yy + 7, e + "  =")
            _cas(c, xx + 120, yy, 32, 24, indici[i] if sol else None, size=12)
            c.setFont(FONT_B, 12)
            c.drawString(xx + 158, yy + 7, "->")
            _cas(c, xx + 182, yy, 28, 24, parola[i] if sol else None, size=14, fill=GRIGIO)
    return Mini(
        "Calcoli con il tuo numero", 2,
        "N è il tuo numero, S la somma delle sue cifre e P il loro prodotto. Calcola ogni espressione: il "
        "risultato è un numero da 1 a 21. Trasformalo in lettera con la tabella A=1, B=2, C=3... e leggi la parola.",
        f"N = {numero}, S = {somma_cifre(numero)}, P = {prodotto_cifre(numero)}. "
        + "; ".join(f"{e} = {j}" for e, j in zip(espr, indici)) + f". Lettere: {parola}.",
        disegna, {"espressioni": espr, "indici": indici},
    )


# --------------------------------------------------------------------------- griglie di lettere lunghe (6 e 7)
def _griglia_sequenza(c, x0, w, y_alto, lettere, evid, colonne=15, numeri=True, gruppi=None):
    """Disegna una sequenza di lettere su più righe, con il numero di posizione sotto; evid = indici (0-based)."""
    lato = (w - 8) / colonne
    for k, ch in enumerate(lettere):
        r, cc = divmod(k, colonne)
        x = x0 + cc * lato
        y = y_alto - (r + 1) * (lato + 14)
        _cas(c, x, y, lato, lato, ch, size=11, fill=GRIGIO if k in evid else None, spessore=1.0)
        if numeri:
            c.setFillColor(GRIGIO_SCURO)
            c.setFont(FONT, 7)
            c.drawCentredString(x + lato / 2, y - 8, str(k + 1))
    if gruppi:
        for k in gruppi:  # barre tra i gruppi (prima della lettera k, 0-based)
            r, cc = divmod(k, colonne)
            x = x0 + cc * lato
            y = y_alto - (r + 1) * (lato + 14)
            c.setLineWidth(3)
            c.setStrokeColor(black)
            c.line(x, y - 2, x, y + lato + 2)
    c.setFillColor(black)
    return lato


# --------------------------------------------------------------------------- 6) tieni solo i multipli
def mini_multipli(numero, parola, rng):
    k = chiave_una_cifra(numero)
    n = len(parola)
    lettere = [rng.choice(ALFABETO) for _ in range(k * n)]
    for i, ch in enumerate(parola):
        lettere[(i + 1) * k - 1] = ch
    evid = {(i + 1) * k - 1 for i in range(n)}

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        x = _etichetta_casella(c, x0, y, "Il tuo numero:", numero, sol, w=38)
        _etichetta_casella(c, x, y, "Passo (K):", k, sol, w=30)
        _griglia_sequenza(c, x0, w, y - 14, lettere, evid if sol else set())
    return Mini(
        "Una lettera ogni K", 1,
        "Somma le cifre del tuo numero (se il risultato ha due cifre, somma ancora; se viene 1 usa 10): è il passo K. "
        "Nella fila di lettere tieni solo quelle che stanno nelle posizioni K, 2K, 3K... (i numeri sotto le caselle "
        "ti aiutano a contare) e leggile in ordine.",
        f"K = {k}. Le posizioni {', '.join(str((i + 1) * k) for i in range(n))} contengono {', '.join(parola)}: {parola}.",
        disegna, {"passo": k, "lettere": lettere},
    )


# --------------------------------------------------------------------------- 7) gruppi a misura di cifra
def mini_gruppi(numero, parola, rng):
    ds = [d if d > 0 else 10 for d in cifre(numero)]
    n = len(parola)
    misure = [ds[i % len(ds)] for i in range(n)]
    lettere, inizi = [], []
    for ch, m in zip(parola, misure):
        inizi.append(len(lettere))
        lettere.append(ch)
        lettere += [rng.choice(ALFABETO) for _ in range(m - 1)]

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        _etichetta_casella(c, x0, y, "Il tuo numero:", numero, sol, w=38)
        _griglia_sequenza(c, x0, w, y - 14, lettere, set(inizi) if sol else set(), gruppi=inizi[1:] if sol else None)
    return Mini(
        "Gruppi a misura di cifra", 2,
        "Dividi la fila di lettere in gruppi consecutivi: il primo lungo quanto la prima cifra del tuo numero, il "
        "secondo quanto la seconda, poi si ricomincia dalla prima cifra (lo 0 vale 10). Disegna una riga verticale "
        "tra un gruppo e l'altro (i numeri ti aiutano a contare) e leggi la PRIMA lettera di ogni gruppo.",
        f"Cifre di {numero}: {', '.join(map(str, ds))} (0 = 10). Gruppi lunghi {', '.join(map(str, misure))}; "
        f"le prime lettere formano {parola}.",
        disegna, {"misure": misure, "lettere": lettere, "inizi": inizi},
    )


# --------------------------------------------------------------------------- 8) alfabeto a rovescio
def mini_rovescio(numero, parola, rng):
    s = somma_cifre(numero)
    rev = ALFABETO[::-1]
    numeri = [rev.index(ch) + 1 + s for ch in parola]

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        x = _etichetta_casella(c, x0, y, "Il tuo numero:", numero, sol, w=38)
        _etichetta_casella(c, x, y, "Somma delle cifre:", s, sol, w=30)
        _testo(c, x0, y - 22, "L'ALFABETO A ROVESCIO (Z=1)", 10)
        _tabella_a1(c, x0, y - 28, w, ch=26, rovescia=True)
        n = len(parola)
        lato, gap = 40, 8
        xm = x0 + 76 + _x_centrato(w - 76, n, lato, gap)
        ym = y - 28 - 52 - 52
        c.setFillColor(black)
        c.setFont(FONT_B, 8.5)
        c.drawString(x0, ym + 16, "Numero del")
        c.drawString(x0, ym + 6, "messaggio")
        c.drawString(x0, ym - 40, "Lettera vera")
        for i in range(n):
            xx = xm + i * (lato + gap)
            _cas(c, xx, ym, lato, 32, numeri[i], size=15, raggio=5)
            _cas(c, xx, ym - 46, lato, 32, parola[i] if sol else None, size=18, fill=GRIGIO, raggio=5)
    return Mini(
        "L'alfabeto a rovescio", 2,
        "Questa volta l'alfabeto si legge al contrario: Z=1, V=2, U=3... Ogni numero del messaggio è il numero "
        "della lettera AUMENTATO della somma delle cifre del tuo numero. Sottrai la somma delle cifre e cerca "
        "il risultato nell'alfabeto a rovescio.",
        f"Somma delle cifre di {numero} = {s}. Numeri {', '.join(map(str, numeri))} - {s} = "
        f"{', '.join(str(x - s) for x in numeri)} -> {parola} (Z=1).",
        disegna, {"numeri": numeri, "somma": s},
    )


# --------------------------------------------------------------------------- 9) numeri romani
def mini_romani(numero, parola, rng):
    s = somma_cifre(numero)
    indici = [ALFABETO.index(ch) + 1 for ch in parola]
    romani = [romano(j + s) for j in indici]

    def disegna(c, box, sol):
        x0, y0, w, h = box
        y = y0 + h - 26
        x = _etichetta_casella(c, x0, y, "Il tuo numero:", numero, sol, w=38)
        _etichetta_casella(c, x, y, "Somma delle cifre:", s, sol, w=30)
        _testo(c, x0, y - 18, "LA TABELLA A=1", 9.5)
        _striscia(c, x0, y - 48, w)
        c.setFillColor(GRIGIO_SCURO)
        c.setFont(FONT_I, 9)
        c.drawString(x0, y - 68, "Numeri romani: I = 1, V = 5, X = 10; IV = 4, IX = 9; XL = 40... (si leggono sommando i valori).")
        yt = y - 74
        rh = min(18, (h - 112) / len(parola))
        cols = [("NUMERO ROMANO", 120), ("IN CIFRE", 90), ("MENO LA SOMMA", 110), ("LETTERA", 80)]
        xx = x0 + (w - sum(cw for _, cw in cols)) / 2
        for nome, cw in cols:
            _cas(c, xx, yt - 16, cw, 16, nome, size=8, fill=GRIGIO, spessore=1.0)
            xx += cw
        for i in range(len(parola)):
            xx = x0 + (w - sum(cw for _, cw in cols)) / 2
            yy = yt - 16 - (i + 1) * rh
            _cas(c, xx, yy, 120, rh, romani[i], size=11, spessore=1.0)
            _cas(c, xx + 120, yy, 90, rh, (indici[i] + s) if sol else None, size=11, spessore=1.0)
            _cas(c, xx + 210, yy, 110, rh, indici[i] if sol else None, size=11, spessore=1.0)
            _cas(c, xx + 320, yy, 80, rh, parola[i] if sol else None, size=12, fill=GRIGIO, spessore=1.0)
    return Mini(
        "Numeri romani", 3,
        "Ogni lettera del messaggio è nascosta in un NUMERO ROMANO: è il numero della lettera nella tabella A=1 "
        "AUMENTATO della somma delle cifre del tuo numero. Trasforma il numero romano in cifre, sottrai la "
        "somma delle cifre e cerca il risultato nella tabella.",
        f"Somma delle cifre di {numero} = {s}. " + "; ".join(
            f"{r} = {j + s} -> {j} = {ch}" for r, j, ch in zip(romani, indici, parola)) + ".",
        disegna, {"romani": romani, "somma": s},
    )


# --------------------------------------------------------------------------- 10) Pigpen + Cesare
def mini_pigpen_cesare(numero, parola, rng):
    s = somma_cifre(numero)
    spostata = sposta(parola, s)
    spec = _specifiche_pigpen()

    def disegna(c, box, sol):
        x0, y0, w, h = box
        lato = 58
        yk = y0 + h - 16 - lato
        gap = (w * 0.58 - 3 * lato) / 2
        _testo(c, x0, yk + lato + 2, "LA CHIAVE PIGPEN", 9)
        _chiave_griglia(c, x0, yk, lato, False, ALFABETO[:9])
        _chiave_griglia(c, x0 + lato + gap, yk, lato, True, ALFABETO[9:18])
        _chiave_x(c, x0 + 2 * (lato + gap), yk, lato, {"su": ALFABETO[18], "sinistra": ALFABETO[19], "destra": ALFABETO[20]})
        xr = x0 + w * 0.62
        _testo(c, xr, yk + lato + 2, "L'ALFABETO", 9)
        _tabella_a1(c, xr, yk + lato - 2, w * 0.38, ch=22, size=9)
        _etichetta_casella(c, xr, yk - 8, "Numero:", numero, sol, w=34, h=20, size=11)
        _etichetta_casella(c, xr + 100, yk - 8, "Somma:", s, sol, w=26, h=20, size=11)
        n = len(parola)
        lato_s = 38
        gap_s = 10
        xm = x0 + 86 + _x_centrato(w - 86, n, lato_s, gap_s)
        ym = yk - 56
        c.setFillColor(black)
        c.setFont(FONT_B, 8.5)
        c.drawString(x0, ym + 16, "Messaggio")
        c.drawString(x0, ym - 24, "Lettera Pigpen")
        c.drawString(x0, ym - 58, "Lettera vera")
        for i in range(n):
            xx = xm + i * (lato_s + gap_s)
            c.setLineWidth(1.2)
            c.setStrokeColor(GRIGIO_SCURO)
            c.roundRect(xx - 3, ym - 3, lato_s + 6, lato_s + 6, 4, stroke=1, fill=0)
            _simbolo_pigpen(c, spec[spostata[i]], xx + lato_s / 2, ym + lato_s / 2, lato_s * 0.55)
            _cas(c, xx + 5, ym - 34, lato_s - 10, 26, spostata[i] if sol else None, size=14, raggio=4)
            _cas(c, xx + 5, ym - 66, lato_s - 10, 26, parola[i] if sol else None, size=14, fill=GRIGIO, raggio=4)
    return Mini(
        "Pigpen e Cesare insieme", 3,
        "Due cifrari in uno. 1) Traduci ogni simbolo con la chiave Pigpen (attenzione ai puntini!). 2) Le lettere "
        "che ottieni sono state spostate AVANTI di tanti posti quanto la somma delle cifre del tuo numero: "
        "torna INDIETRO di quel numero di posti con l'alfabeto e leggi la parola.",
        f"Somma delle cifre di {numero} = {s}. I simboli dicono {spostata}; spostati indietro di {s} danno {parola}.",
        disegna, {"somma": s, "pigpen": spostata},
    )


# --------------------------------------------------------------------------- elenco
MINI = [
    mini_cesare_somma, mini_griglia, mini_multipli, mini_chiave_cifre, mini_ruota,
    mini_gruppi, mini_calcoli, mini_rovescio, mini_romani, mini_pigpen_cesare,
]


def crea_mini(numero, parola, seed=1):
    """I 10 mini enigmi per (numero, parola), dal più facile al più difficile."""
    valida(numero, parola)
    out = []
    for i, f in enumerate(MINI):
        out.append(f(numero, parola, random.Random(seed * 100 + i)))
    out.sort(key=lambda m: m.livello)
    return out
