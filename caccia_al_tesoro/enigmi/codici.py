"""Codici a griglia: ogni lettera è una griglia 5x5 con numeri a bordo riga e colonna, ma i numeri NON seguono la
regola dei nonogrammi. Ogni blocco ha la sua regola (da scoprire dagli esempi già risolti).

Una regola trasforma una linea di 5 caselle (riga da sinistra a destra, colonna dall'alto in basso) in una tupla
di numeri. Alcune regole decodificano ogni linea da sola ("per riga"); altre (somma delle posizioni, quante nere,
estremi) vanno incrociate tra righe e colonne e, per rendere la lettera univoca, il programma aggiunge il minimo
di caselle di partenza (nere o bianche).
"""
import itertools
import math
import random
from dataclasses import dataclass
from fractions import Fraction
from typing import Callable

from .alfabeto import ALFABETO
from .parole import GLIFI

N = 5
PRIMI = (2, 3, 5, 7, 11)


# --------------------------------------------------------------------------- lettere e trabocchetti
def griglia_glifo(lettera):
    """La lettera come tupla di 5 righe da 5 valori (1 = nera)."""
    return tuple(tuple(1 if ch == "#" else 0 for ch in riga) for riga in GLIFI[lettera])


def applica_trabocchetto(pattern, trab):
    """Disegno da annerire dato il disegno della lettera: specchio, capovolto, negativo (o niente)."""
    if trab == "specchio":
        return tuple(tuple(riga[N - 1 - c] for c in range(N)) for riga in pattern)
    if trab == "capovolto":
        return tuple(tuple(pattern[N - 1 - r][N - 1 - c] for c in range(N)) for r in range(N))
    if trab == "negativo":
        return tuple(tuple(1 - v for v in riga) for riga in pattern)
    return pattern


def togli_trabocchetto(pattern, trab):
    """Dalla griglia annerita alla lettera (specchio, capovolto e negativo sono involuzioni)."""
    return applica_trabocchetto(pattern, trab)


def linee(pattern):
    righe = [tuple(r) for r in pattern]
    colonne = [tuple(pattern[r][c] for r in range(N)) for c in range(N)]
    return righe, colonne


# --------------------------------------------------------------------------- regole su una linea
def _pos(linea):
    return [i + 1 for i, b in enumerate(linea) if b]


def r_salti(linea):
    p = _pos(linea)
    if not p:
        return (0,)
    return (p[0],) + tuple(b - a for a, b in zip(p, p[1:]))


def r_binario2(linea):
    return (linea[0] * 2 + linea[1], linea[2] * 4 + linea[3] * 2 + linea[4])


def r_binario(linea):
    return (sum(b << (N - 1 - i) for i, b in enumerate(linea)),)


def r_somma_pos(linea):
    return (sum(_pos(linea)),)


def r_conteggio(linea):
    """Quante nere e il posto dell'ultima (il solo conteggio lascerebbe troppe soluzioni possibili)."""
    p = _pos(linea)
    return (len(p), p[-1]) if p else (0, 0)


def r_estremi(linea):
    p = _pos(linea)
    return (p[0], p[-1], len(p)) if p else (0, 0, 0)


def r_primi(linea):
    v = 1
    for b, pr in zip(linea, PRIMI):
        if b:
            v *= pr
    return (v,)


def r_ternario(linea):
    return (sum(b * 3 ** i for i, b in enumerate(linea)),)


def r_progressive(linea):
    out, tot = [], 0
    for p in _pos(linea):
        tot += p
        out.append(tot)
    return tuple(out) or (0,)


# ---- seconda serie (tutte difficili, nessun trabocchetto)
def _romano(n):
    """Numero in cifre romane (0 resta 0)."""
    if n == 0:
        return "0"
    out = ""
    for v, r in ((100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while n >= v:
            out += r
            n -= v
    return out


def _pesi(linea, pesi):
    return sum(b * w for b, w in zip(linea, pesi))


def r_fattoriali(linea):
    return (_pesi(linea, (1, 2, 6, 24, 120)),)


def r_gray(linea):
    v = _pesi(linea, (16, 8, 4, 2, 1))
    return (v ^ (v >> 1),)


def r_dispari_pari(linea):
    p = _pos(linea)
    return (sum(x for x in p if x % 2), sum(x for x in p if x % 2 == 0))


def r_inizio_lunghezza(linea):
    out, i = [], 0
    while i < N:
        if linea[i]:
            j = i
            while j < N and linea[j]:
                j += 1
            out += [i + 1, j - i]
            i = j
        else:
            i += 1
    return tuple(out) or (0,)


def r_somma_quadrati(linea):
    p = _pos(linea)
    return (sum(x * x for x in p), len(p))


def r_somma_prodotto(linea):
    p = _pos(linea)
    return (sum(p), math.prod(p))


def r_prodotto_posti(linea):
    return (math.prod(_pos(linea)),)


def r_tre_misure(linea):
    p = _pos(linea)
    return (len(p), sum(p), sum(x * x for x in p))


def r_binario_romano(linea):
    return (_romano(_pesi(linea, (16, 8, 4, 2, 1))),)


def r_monete_romane(linea):
    return (_romano(_pesi(linea, (1, 2, 5, 10, 20))),)


@dataclass(frozen=True)
class Regola:
    chiave: str
    nome: str
    livello: int  # 1 = medio, 2 = difficile
    deduzione: bool  # True: serve incrociare righe e colonne (e caselle di partenza)
    funzione: Callable
    breve: str  # come si legge, per la pagina delle soluzioni
    a_pesi: bool = False  # i numeri sono combinazioni lineari dei bit (test del rango sugli esempi)


REGOLE = {r.chiave: r for r in [
    Regola("salti", "Salti", 1, False, r_salti,
           "Il primo numero è il posto della prima casella nera; gli altri sono le distanze tra una nera e la successiva."),
    Regola("binario2", "Binario a due metà", 1, False, r_binario2,
           "Due numeri: le prime due caselle e le ultime tre lette come numeri in binario (nera = 1, bianca = 0).", True),
    Regola("progressive", "Somme progressive", 1, False, r_progressive,
           "I posti delle caselle nere, sommati uno dopo l'altro: ogni numero è la somma dei posti fino a quella casella."),
    Regola("somma_pos", "Somma delle posizioni", 1, True, r_somma_pos,
           "Somma dei posti (da 1 a 5) delle caselle nere della riga o della colonna."),
    Regola("conteggio", "Quante nere e l'ultima", 1, True, r_conteggio,
           "Due numeri: quante caselle nere ci sono nella riga o nella colonna e il posto (da 1 a 5) dell'ultima nera."),
    Regola("binario", "Binario intero", 2, False, r_binario,
           "Un numero da 0 a 31: le caselle valgono 16-8-4-2-1 (da sinistra a destra o dall'alto in basso) e si sommano le nere.", True),
    Regola("ternario", "Potenze di 3", 2, False, r_ternario,
           "Un numero da 0 a 121: le caselle valgono 1-3-9-27-81 (da sinistra a destra o dall'alto in basso) e si sommano le nere.", True),
    Regola("estremi", "Estremi", 2, True, r_estremi,
           "Tre numeri: il posto della prima nera, della ultima e quante nere ci sono in tutto."),
    Regola("primi", "Prodotti di numeri primi", 2, False, r_primi,
           "Le caselle valgono 2-3-5-7-11: il numero è il prodotto di quelle annerite (nessuna nera = 1).", True),
    Regola("fattoriali", "Fattoriali", 2, False, r_fattoriali,
           "Un numero: le caselle valgono 1-2-6-24-120 (da sinistra a destra o dall'alto in basso) e si sommano le nere.", True),
    Regola("gray", "Codice Gray", 2, False, r_gray,
           "Un numero: il binario 16-8-4-2-1 trasformato in codice Gray (v XOR v/2). Due numeri vicini cambiano una sola casella."),
    Regola("dispari_pari", "Dispari e pari", 2, False, r_dispari_pari,
           "Due numeri: la somma dei posti DISPARI neri (1, 3, 5) e la somma dei posti PARI neri (2, 4)."),
    Regola("inizio_lunghezza", "Inizio e lunghezza", 2, False, r_inizio_lunghezza,
           "Per ogni gruppo di caselle nere vicine: il posto da cui parte e quante sono. Es.: 1 3 5 1 = tre nere dal posto 1 e una nera al posto 5."),
    Regola("somma_quadrati", "Quadrati e conteggio", 2, False, r_somma_quadrati,
           "Due numeri: la somma dei quadrati dei posti neri (1, 4, 9, 16, 25) e quante nere ci sono."),
    Regola("somma_prodotto", "Somma e prodotto", 2, False, r_somma_prodotto,
           "Due numeri: la somma dei posti neri e il loro prodotto (nessuna nera: 0 e 1)."),
    Regola("prodotto_posti", "Prodotto dei posti", 2, True, r_prodotto_posti,
           "Un numero: il prodotto dei posti (da 1 a 5) delle caselle nere della riga o della colonna (nessuna nera = 1)."),
    Regola("tre_misure", "Tre misure", 2, False, r_tre_misure,
           "Tre numeri: quante nere, la somma dei loro posti e la somma dei quadrati dei loro posti."),
    Regola("binario_romano", "Binario romano", 2, False, r_binario_romano,
           "Come il binario (16-8-4-2-1 da sinistra a destra o dall'alto in basso) ma il totale è scritto in cifre romane; 0 resta 0.", True),
    Regola("monete_romane", "Monete romane", 2, False, r_monete_romane,
           "Le caselle valgono 1-2-5-10-20 (I, II, V, X, XX) e si sommano le nere; il totale è scritto in cifre romane; 0 resta 0.", True),
]}

# Pool delle 22 regole: (chiave regola, trabocchetto). Ordinato dalla più facile alla più difficile da intuire:
# prima le 5 medie, poi le difficili (alcune con trabocchetto: specchio, capovolto, negativo).
CATALOGO = [
    ("salti", None), ("binario2", None), ("progressive", None), ("somma_pos", None), ("conteggio", None),
    ("dispari_pari", None), ("somma_quadrati", None), ("binario", None), ("inizio_lunghezza", None),
    ("ternario", None), ("fattoriali", None), ("estremi", None), ("monete_romane", None), ("somma_prodotto", None),
    ("primi", None), ("binario2", "specchio"), ("binario_romano", None), ("progressive", "capovolto"),
    ("gray", None), ("somma_pos", "negativo"), ("prodotto_posti", None), ("tre_misure", None),
]
NOMI_TRABOCCHETTO = {"specchio": "specchio", "capovolto": "capovolto", "negativo": "negativo"}


def livello_voce(voce):
    base, trab = voce
    return REGOLE[base].livello + (1 if trab else 0)


def nome_voce(voce):
    base, trab = voce
    return REGOLE[base].nome + (f" · {NOMI_TRABOCCHETTO[trab]}" if trab else "")


# tutte le 32 linee possibili
LINEE = list(itertools.product((0, 1), repeat=N))

# per ogni regola: clue -> linee compatibili; e per ogni prefisso, i clue raggiungibili (per potare la ricerca)
_PER_CLUE, _RAGGIUNGIBILI = {}, {}
for _k, _r in REGOLE.items():
    pc, ragg = {}, {}
    for _l in LINEE:
        _c = _r.funzione(_l)
        pc.setdefault(_c, []).append(_l)
        for _n in range(N + 1):
            ragg.setdefault(_l[:_n], set()).add(_c)
    _PER_CLUE[_k], _RAGGIUNGIBILI[_k] = pc, ragg
    if not _r.deduzione:
        assert all(len(v) == 1 for v in pc.values()), f"la regola {_k} non è iniettiva per riga"


def clue_pattern(pattern, regola):
    righe, colonne = linee(pattern)
    f = REGOLE[regola].funzione
    return tuple(f(r) for r in righe), tuple(f(c) for c in colonne)


# --------------------------------------------------------------------------- solver
def risolvi(righe, colonne, regola, noti=None, limite=2):
    """Griglie (tuple di righe) compatibili con i numeri; noti = {(r, c): 0/1} caselle di partenza."""
    noti = noti or {}
    pc = _PER_CLUE[regola]
    ragg = _RAGGIUNGIBILI[regola]
    cand = []
    for r in range(N):
        ok = [l for l in pc.get(righe[r], []) if all(noti.get((r, c), l[c]) == l[c] for c in range(N))]
        cand.append(ok)
    sol = []

    def rec(r, scelte):
        if len(sol) >= limite:
            return
        if r == N:
            sol.append(tuple(scelte))
            return
        for l in cand[r]:
            nuovo = scelte + [l]
            if all(colonne[c] in ragg.get(tuple(riga[c] for riga in nuovo), ()) for c in range(N)):
                rec(r + 1, nuovo)

    rec(0, [])
    return sol


def crea_hint(pattern, regola):
    """Minimo di caselle di partenza (greedy) perché la griglia sia l'unica soluzione. {(r, c): valore}."""
    righe, colonne = clue_pattern(pattern, regola)
    noti = {}
    while True:
        sol = risolvi(righe, colonne, regola, noti, 2)
        assert sol, "nessuna soluzione: errore di codifica"
        if len(sol) == 1:
            return noti
        altra = next(s for s in sol if s != pattern)
        diff = [(r, c) for r in range(N) for c in range(N) if pattern[r][c] != altra[r][c] and (r, c) not in noti]
        # preferisce svelare caselle nere (più facili da vedere); in parità, la prima trovata
        diff.sort(key=lambda rc: -pattern[rc[0]][rc[1]])
        noti[diff[0]] = pattern[diff[0][0]][diff[0][1]]


# --------------------------------------------------------------------------- scelta degli esempi
def _rango(vettori):
    """Rango (su razionali) di un insieme di vettori di bit."""
    righe = [[Fraction(x) for x in v] for v in vettori]
    rango = 0
    for col in range(N):
        piv = next((i for i in range(rango, len(righe)) if righe[i][col] != 0), None)
        if piv is None:
            continue
        righe[rango], righe[piv] = righe[piv], righe[rango]
        for i in range(len(righe)):
            if i != rango and righe[i][col] != 0:
                f = righe[i][col] / righe[rango][col]
                righe[i] = [a - f * b for a, b in zip(righe[i], righe[rango])]
        rango += 1
    return rango


def pattern_voce(lettera, voce):
    return applica_trabocchetto(griglia_glifo(lettera), voce[1])


def esempi_validi(voce, lettere, catalogo):
    """Gli esempi bastano a capire la regola? (1) i pesi sono determinabili, (2) nessun'altra regola del catalogo
    dà gli stessi numeri su tutti gli esempi, (3) il trabocchetto si vede (la lettera non è simmetrica)."""
    base, trab = voce
    patt = [pattern_voce(l, voce) for l in lettere]
    if trab in ("specchio", "capovolto") and any(p == griglia_glifo(l) for p, l in zip(patt, lettere)):
        return False
    if REGOLE[base].a_pesi:
        vettori = [v for p in patt for v in (*linee(p)[0], *linee(p)[1])]
        if _rango(vettori) < N:
            return False
    mio = [clue_pattern(p, base) for p in patt]
    for altra in catalogo:
        if altra == voce:
            continue
        altri = [clue_pattern(pattern_voce(l, altra), altra[0]) for l in lettere]
        if altri == mio:
            return False
    return True


def _ricchezza(lettera):
    g = griglia_glifo(lettera)
    return len(set(g)) + len(set(linee(g)[1]))


def scegli_esempi(voce, escluse, catalogo=CATALOGO, minimo=None, usate=None):
    """1-2 lettere di esempio, non tra `escluse`, sufficienti a capire la regola. `usate` (lettera -> quante volte
    è già stata usata come esempio) fa variare le lettere da una regola all'altra."""
    usate = usate if usate is not None else {}
    candidate = sorted((l for l in ALFABETO if l not in escluse), key=lambda l: (-_ricchezza(l), l))
    minimo = minimo or (1 if livello_voce(voce) <= 1 else 2)
    for k in range(minimo, 3):
        combos = sorted(itertools.combinations(candidate, k),
                        key=lambda cb: (sum(usate.get(l, 0) for l in cb) * 6 - sum(_ricchezza(l) for l in cb), cb))
        for cb in combos:
            if esempi_validi(voce, cb, catalogo):
                return list(cb)
    raise RuntimeError(f"nessun insieme di esempi valido per {voce}")


# --------------------------------------------------------------------------- blocco completo
def crea_blocco(voce, lettera_bersaglio, parola_esclusa, usate=None, catalogo=CATALOGO):
    """Esempi risolti + griglia da risolvere (con caselle di partenza se serve) per una voce del catalogo."""
    base, trab = voce
    esempi = scegli_esempi(voce, set(parola_esclusa) | {lettera_bersaglio}, catalogo=catalogo, usate=usate)
    if usate is not None:
        for l in esempi:
            usate[l] = usate.get(l, 0) + 1
    blocchi_esempio = []
    for l in esempi:
        p = pattern_voce(l, voce)
        righe, colonne = clue_pattern(p, base)
        blocchi_esempio.append({"lettera": l, "pattern": p, "righe": righe, "colonne": colonne})
    p = pattern_voce(lettera_bersaglio, voce)
    righe, colonne = clue_pattern(p, base)
    hint = crea_hint(p, base)
    return {
        "voce": voce, "esempi": blocchi_esempio,
        "bersaglio": {"lettera": lettera_bersaglio, "pattern": p, "righe": righe, "colonne": colonne, "hint": hint},
    }


def crea_catalogo(parola_demo="CASTELLO", voci=None, catalogo=CATALOGO):
    """Un blocco per ogni voce (nell'ordine del pool: dal più facile al più difficile); i bersagli sono le lettere
    della parola, a rotazione. `catalogo` = le voci da cui gli esempi devono saper distinguere la regola."""
    voci = list(voci or CATALOGO)
    blocchi, usate = [], {}
    for i, voce in enumerate(voci):
        blocchi.append(crea_blocco(voce, parola_demo[i % len(parola_demo)], parola_demo, usate, catalogo))
    return blocchi


# --------------------------------------------------------------------------- enigma completo
def verifica_unica(blocco):
    """Controllo sul blocco: la griglia da risolvere (con le sue caselle di partenza) ha UNA sola soluzione, ed è la lettera."""
    base = blocco["voce"][0]
    b = blocco["bersaglio"]
    sol = risolvi(b["righe"], b["colonne"], base, b["hint"], 2)
    return len(sol) == 1 and sol[0] == b["pattern"]


def scegli_voci(quante):
    """Le voci del pool da usare per una parola di `quante` lettere: tutte se sono 22, altrimenti quelle distribuite
    in modo regolare dalla più facile alla più difficile (la prima e l'ultima ci sono sempre)."""
    voci = list(CATALOGO)
    if not 1 <= quante <= len(voci):
        raise ValueError(f"La parola deve avere da 1 a {len(voci)} lettere (una regola diversa per lettera)")
    if quante == len(voci):
        return voci
    if quante == 1:
        return voci[:1]
    idx = [round(i * (len(voci) - 1) / (quante - 1)) for i in range(quante)]
    return [voci[i] for i in idx]


def crea_enigma(parola):
    """Un blocco per lettera della parola, dalla regola più facile alla più difficile; esempi con lettere fuori dalla parola."""
    lettere = [ch for ch in parola.upper() if ch != " "]
    if any(ch not in ALFABETO for ch in lettere):
        raise ValueError(f"Lettere non supportate in '{parola}'")
    voci = scegli_voci(len(lettere))
    usate, blocchi = {}, []
    for voce, lettera in zip(voci, lettere):
        try:
            b = crea_blocco(voce, lettera, lettere, usate)
        except RuntimeError:
            raise ValueError(f"Con '{parola}' restano troppo poche lettere libere per gli esempi della regola "
                             f"{nome_voce(voce)}: usa una parola con meno lettere diverse") from None
        assert verifica_unica(b), f"soluzione non unica per {voce} / {lettera}"
        blocchi.append(b)
    return blocchi


def crea_gruppi(parola, gruppi):
    """Parola divisa in gruppi di lettere consecutive, ognuno con la sua regola. `gruppi` = [(voce, quante_lettere), ...].
    La prima lettera di ogni gruppo è l'esempio già risolto; le altre sono le griglie da risolvere (con le caselle di
    partenza strettamente necessarie). Un solo esempio deve bastare a distinguere la regola da tutte quelle del pool."""
    lettere = [ch for ch in parola.upper() if ch != " "]
    if any(ch not in ALFABETO for ch in lettere):
        raise ValueError(f"Lettere non supportate in '{parola}'")
    if sum(n for _, n in gruppi) != len(lettere) or any(n < 2 for _, n in gruppi):
        raise ValueError("I gruppi devono coprire tutte le lettere, con almeno 2 lettere ciascuno (esempio + griglia)")
    blocchi, i = [], 0
    for voce, n in gruppi:
        base = voce[0]
        gruppo = lettere[i:i + n]
        i += n
        if not esempi_validi(voce, [gruppo[0]], CATALOGO):
            raise ValueError(f"La lettera {gruppo[0]} da sola non basta a far capire la regola {nome_voce(voce)}")

        def dati(l):
            p = pattern_voce(l, voce)
            righe, colonne = clue_pattern(p, base)
            return {"lettera": l, "pattern": p, "righe": righe, "colonne": colonne}

        bersagli = []
        for l in gruppo[1:]:
            d = dati(l)
            d["hint"] = crea_hint(d["pattern"], base)
            bersagli.append(d)
        blocco = {"voce": voce, "esempio": dati(gruppo[0]), "bersagli": bersagli}
        for d in bersagli:
            assert verifica_unica({"voce": voce, "bersaglio": d}), f"soluzione non unica per {voce} / {d['lettera']}"
        blocchi.append(blocco)
    return blocchi
