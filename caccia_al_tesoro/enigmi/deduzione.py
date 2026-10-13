"""Enigmi di osservazione e deduzione: chi ha rubato la torta e la griglia logica dei cugini."""
import itertools
import random

from reportlab.lib.colors import black, white
from reportlab.lib.utils import simpleSplit

from .base import Enigma, FACILE, MEDIO
from .impagina import GRIGIO, GRIGIO_SCURO, FONT, FONT_B, FONT_I, W

CATEGORIA = "Osservazione e deduzione"

# --------------------------------------------------------------------------- chi ha rubato la torta
CARATTERISTICHE = ["occhiali", "cappello", "baffi", "sciarpa"]
# nome -> insieme di caratteristiche
def _sospetti(nomi):
    return {
        nomi[0]: {"occhiali", "cappello"},
        nomi[1]: {"occhiali", "baffi"},
        nomi[2]: {"cappello", "sciarpa"},
        nomi[3]: {"baffi", "sciarpa", "cappello"},
    }


INDIZI_LADRO = [("occhiali", True), ("cappello", False), ("sciarpa", False)]


def colpevoli_ladro(sospetti, indizi=INDIZI_LADRO):
    return [n for n, car in sospetti.items() if all((ch in car) == presente for ch, presente in indizi)]


def _faccia(c, cx, cy, r, car):
    c.setStrokeColor(black)
    c.setLineWidth(2)
    c.setFillColor(white)
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setFillColor(black)
    c.circle(cx - r * 0.35, cy + r * 0.2, 2.6, stroke=0, fill=1)
    c.circle(cx + r * 0.35, cy + r * 0.2, 2.6, stroke=0, fill=1)
    c.setLineWidth(1.8)
    c.arc(cx - r * 0.4, cy - r * 0.55, cx + r * 0.4, cy - r * 0.05, 200, 140)
    if "occhiali" in car:
        c.setLineWidth(2)
        c.circle(cx - r * 0.35, cy + r * 0.2, r * 0.26, stroke=1, fill=0)
        c.circle(cx + r * 0.35, cy + r * 0.2, r * 0.26, stroke=1, fill=0)
        c.line(cx - r * 0.09, cy + r * 0.2, cx + r * 0.09, cy + r * 0.2)
    if "baffi" in car:
        c.setFillColor(black)
        c.roundRect(cx - r * 0.42, cy - r * 0.2, r * 0.84, r * 0.14, 3, stroke=0, fill=1)
    if "cappello" in car:
        c.setFillColor(GRIGIO_SCURO)
        c.rect(cx - r * 0.65, cy + r * 0.86, r * 1.3, r * 0.17, stroke=1, fill=1)
        c.rect(cx - r * 0.42, cy + r * 1.0, r * 0.84, r * 0.55, stroke=1, fill=1)
    if "sciarpa" in car:
        c.setFillColor(GRIGIO)
        c.rect(cx - r * 0.75, cy - r * 1.25, r * 1.5, r * 0.3, stroke=1, fill=1)
        c.rect(cx + r * 0.25, cy - r * 1.7, r * 0.3, r * 0.6, stroke=1, fill=1)


def disegna_ladro(c, box, sospetti, indizi_testo, colpevole, soluzione):
    x0, y0, w, h = box
    nomi = list(sospetti)
    col = w / len(nomi)
    cy = y0 + h - 100
    r = min(42, col / 2 - 12)
    for i, nome in enumerate(nomi):
        cx = x0 + col * (i + 0.5)
        _faccia(c, cx, cy, r, sospetti[nome])
        c.setFillColor(black)
        c.setFont(FONT_B, 15)
        c.drawCentredString(cx, cy - r * 1.95 - 14, nome)
        if soluzione and nome == colpevole:
            c.setLineWidth(3)
            c.setStrokeColor(black)
            c.roundRect(cx - col / 2 + 6, cy - r * 1.95 - 24, col - 12, r * 3.75 + 24, 10, stroke=1, fill=0)
    y = cy - r * 1.95 - 54
    c.setFillColor(black)
    c.setFont(FONT_B, 14)
    c.drawString(x0, y, "GLI INDIZI")
    c.setFont(FONT, 13.5)
    y -= 26
    for k, t in enumerate(indizi_testo):
        c.drawString(x0 + 6, y, f"{k + 1})  {t}")
        y -= 24
    c.setFont(FONT_I, 12)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0 + 6, y - 6, "Suggerimento: per ogni indizio, depenna con la matita i sospetti che non vanno bene.")


def ladro_facile(nomi):
    sospetti = _sospetti(nomi)
    colpevoli = colpevoli_ladro(sospetti)
    assert len(colpevoli) == 1
    colp = colpevoli[0]
    indizi_testo = [
        ("Il ladro porta gli occhiali." if p else "Il ladro NON porta gli occhiali.") if ch == "occhiali" else
        ("Il ladro ha il cappello." if p else "Il ladro NON ha il cappello.") if ch == "cappello" else
        ("Il ladro ha i baffi." if p else "Il ladro NON ha i baffi.") if ch == "baffi" else
        ("Il ladro ha la sciarpa." if p else "Il ladro NON ha la sciarpa.")
        for ch, p in INDIZI_LADRO
    ]
    return Enigma(
        titolo="Chi ha rubato la torta?",
        categoria=CATEGORIA,
        livello=FACILE,
        consegna=(
            "Qualcuno ha mangiato la torta di nascosto! Ci sono quattro sospetti. Guardali bene e usa gli "
            "indizi per scoprire chi è il ladro."
        ),
        prompt_risposta="Scrivi il nome del ladro:",
        risposta=colp.upper(),
        spiegazione=f"Solo {colp} soddisfa tutti gli indizi (verificato dal programma).",
        disegna=lambda c, box, sol: disegna_ladro(c, box, sospetti, indizi_testo, colp, sol),
    ), colp


# --------------------------------------------------------------------------- griglia logica
CATEGORIE_LOGICA = {
    "persona": None,
    "animale": ["il cane", "il gatto", "il pesce rosso", "il coniglio"],
    "colore": ["il rosso", "il blu", "il verde", "il giallo"],
    "sport": ["il calcio", "il nuoto", "il tennis", "il basket"],
}
NOMI_COLONNA = {
    "animale": ["cane", "gatto", "pesce", "coniglio"],
    "colore": ["rosso", "blu", "verde", "giallo"],
    "sport": ["calcio", "nuoto", "tennis", "basket"],
}
NOMI_CAT = ["persona", "animale", "colore", "sport"]


def _descrizione(cat, val, nomi, soggetto):
    """Testo per un'asserzione. soggetto=True -> inizio di frase ('Chi ha il cane')."""
    if cat == "persona":
        return nomi[val]
    voce = CATEGORIE_LOGICA[cat][val]
    verbo = {"animale": "ha", "colore": "ama", "sport": "pratica"}[cat]
    return (f"Chi {verbo} {voce}", f"{verbo} {voce}")[0 if soggetto else 1]


def _verbo_negato(cat, val):
    verbo = {"animale": "ha", "colore": "ama", "sport": "pratica"}[cat]
    return f"non {verbo} {CATEGORIE_LOGICA[cat][val]}"


def _frase(indizio, nomi):
    pos, (ca, va), (cb, vb) = indizio
    if cb == "persona":  # metti la persona per prima
        ca, va, cb, vb = cb, vb, ca, va
    soggetto = _descrizione(ca, va, nomi, True)
    pred = _descrizione(cb, vb, nomi, False) if pos else _verbo_negato(cb, vb)
    if ca != "persona" and cb == "persona":
        pass
    return f"{soggetto} {pred}."


def _persona_di(ass, cat, val):
    return val if cat == "persona" else ass[cat][val]


def _vero(ass, indizio):
    pos, (ca, va), (cb, vb) = indizio
    return (_persona_di(ass, ca, va) == _persona_di(ass, cb, vb)) == pos


_PERMS = list(itertools.permutations(range(4)))
TUTTE = [
    {"animale": pa, "colore": pc, "sport": ps}
    for pa in _PERMS for pc in _PERMS for ps in _PERMS
]


def _soluzioni(indizi, limite=2):
    """Assegnazioni compatibili con tutti gli indizi (ferma il conteggio a `limite`)."""
    trovate = []
    for ass in TUTTE:
        if all(_vero(ass, i) for i in indizi):
            trovate.append(ass)
            if len(trovate) >= limite:
                break
    return trovate


def genera_logica(rng, max_positivi=5, campione=8):
    """Sceglie indizi veri sulla soluzione nascosta finché è unica, poi toglie quelli ridondanti."""
    for _ in range(100):
        nascosta = rng.choice(TUTTE)
        fatti = []
        for ca, cb in itertools.combinations(NOMI_CAT, 2):
            for va in range(4):
                for vb in range(4):
                    pos = _persona_di(nascosta, ca, va) == _persona_di(nascosta, cb, vb)
                    fatti.append((pos, (ca, va), (cb, vb)))
        indizi, candidati = [], TUTTE
        while len(candidati) > 1:
            n_pos = sum(1 for i in indizi if i[0])
            pool = [f for f in fatti if f not in indizi and not (f[0] and n_pos >= max_positivi)]
            scelte = rng.sample(pool, min(campione, len(pool)))
            migliore = min(scelte, key=lambda f: sum(1 for a in candidati if _vero(a, f)))
            ristretti = [a for a in candidati if _vero(a, migliore)]
            if len(ristretti) == len(candidati):
                continue  # non aggiunge informazione
            indizi.append(migliore)
            candidati = ristretti
        for f in list(indizi):
            resto = [i for i in indizi if i is not f]
            if len(_soluzioni(resto)) == 1:
                indizi = resto
        if 8 <= len(indizi) <= 11:
            rng.shuffle(indizi)
            return nascosta, indizi
    raise RuntimeError("impossibile generare la griglia logica")


def disegna_logica(c, box, nomi, indizi, ass, soluzione):
    x0, y0, w, h = box
    y = y0 + h - 4
    c.setFillColor(black)
    c.setFont(FONT_B, 14)
    c.drawString(x0, y - 14, "GLI INDIZI")
    c.setFont(FONT, 12.5)
    y -= 36
    for k, ind in enumerate(indizi):
        testo = f"{k + 1})  {_frase(ind, nomi)}"
        for riga in simpleSplit(testo, FONT, 12.5, w - 10):
            c.drawString(x0 + 4, y, riga)
            y -= 17
        y -= 3
    # tre tabelle: persona x animale, persona x colore, persona x sport
    cella = 26
    larg_nomi = 52
    larg_blocco = larg_nomi + 4 * cella
    spazio = (w - 3 * larg_blocco) / 2
    y_top = y - 82  # sotto le intestazioni ruotate
    for b, cat in enumerate(("animale", "colore", "sport")):
        bx = x0 + b * (larg_blocco + spazio)
        c.setLineWidth(1.6)
        c.setStrokeColor(black)
        c.setFillColor(black)
        for j in range(4):
            c.saveState()
            c.translate(bx + larg_nomi + j * cella + cella / 2 + 4, y_top + 6)
            c.rotate(90)
            c.setFont(FONT_B, 10.5)
            c.drawString(0, 0, NOMI_COLONNA[cat][j])
            c.restoreState()
        for i in range(4):
            c.setFont(FONT_B, 11)
            c.drawString(bx, y_top - (i + 1) * cella + 8, nomi[i])
            for j in range(4):
                c.rect(bx + larg_nomi + j * cella, y_top - (i + 1) * cella, cella, cella, stroke=1, fill=0)
                if soluzione and ass[cat][j] == i:
                    c.setFont(FONT_B, 17)
                    c.drawCentredString(bx + larg_nomi + j * cella + cella / 2, y_top - (i + 1) * cella + 7, "X")
    c.setFont(FONT_I, 11)
    c.setFillColor(GRIGIO_SCURO)
    c.drawString(x0, y_top - 4 * cella - 18,
                 "Come usare le tabelle: metti una X dove l'indizio dice SI, un puntino dove dice NO.")


def logica_medio(rng, nomi):
    ass, indizi = genera_logica(rng)
    nomi4 = nomi[:4]
    chi_pesce = nomi4[ass["animale"].index(2)]
    return Enigma(
        titolo="Cugini e animali",
        categoria=CATEGORIA,
        livello=MEDIO,
        consegna=(
            f"Quattro cugini ({', '.join(nomi4[:-1])} e {nomi4[-1]}) hanno ognuno un animale diverso, "
            "un colore preferito diverso e uno sport diverso. Usa gli indizi per scoprire chi è chi: "
            "le tre tabelle ti aiutano a tenere il conto."
        ),
        prompt_risposta="Scrivi il nome del cugino che ha il pesce rosso:",
        risposta=chi_pesce.upper(),
        spiegazione=(
            "Soluzione completa (verificata: unica): "
            + "; ".join(
                f"{nomi4[i]} ha {CATEGORIE_LOGICA['animale'][ass['animale'].index(i)]}, "
                f"ama {CATEGORIE_LOGICA['colore'][ass['colore'].index(i)]} e "
                f"pratica {CATEGORIE_LOGICA['sport'][ass['sport'].index(i)]}"
                for i in range(4)
            )
            + "."
        ),
        disegna=lambda c, box, sol: disegna_logica(c, box, nomi4, indizi, ass, sol),
    ), (ass, indizi)


def crea(seed, nomi):
    """Restituisce gli enigmi 10 (il ladro) e 11 (cugini e animali) e i dati grezzi per i test."""
    r = lambda k: random.Random(seed * 100 + k)
    e10, colp = ladro_facile(nomi)
    e11, dati11 = logica_medio(r(11), nomi)
    return [e10, e11], {"ladro": colp, "logica": dati11}
