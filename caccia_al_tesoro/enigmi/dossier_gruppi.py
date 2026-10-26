"""Enigma dei codici a gruppi (per esempio PARCHEGGIO): una sola pagina, una fila di griglie per ogni regola.

In ogni fila la prima griglia è già risolta (e la sua lettera è già scritta nella parola); le altre vanno risolte
applicando la stessa regola. La versione per gli spiegatori mostra tutte le griglie annerite e, sotto ogni fila, una
cornice che spiega la regola.
"""
from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

from . import grafica_tavolo as G
from .codici import N, REGOLE, livello_voce, nome_voce
from .dossier_codici import SPIEGAZIONE_TRABOCCHETTO, disegna_unita
from .dossier_enigma import NOMI_LIVELLO, X, WB, _riquadro_risposta, _testata

W, H = A4
GR = G.gr
SCALA = 0.85  # carattere dei numeri attorno alle griglie
SPAZIO = 8
CELLA_MAX, CELLA_MIN = 15, 10
BASSO = 60

NUMERO_REPERTO = 11
REPERTO = "La parola che trovi è il reperto numero {n}: segnalo sul tuo passaporto"
INDIZIO = {"intro": "Se ti serve un indizio, vai alla", "luogo": "Biblioteca di San Polo",
           "indirizzo": "Via Tiziano 246, Brescia"}
H_REPERTO, H_BIGLIETTO = 52, 58


def _testo_clue(clue):
    return " ".join(str(n) for n in clue)


def _larghezza_riga(c, b):
    m = max(c.stringWidth(_testo_clue(cl), G.FONT_B, 9 * SCALA) for cl in b["righe"])
    return min(max(m + 7, 20), 52)


def _righe_spiegazione(voce):
    base, trab = voce
    t = REGOLE[base].breve + (" " + SPIEGAZIONE_TRABOCCHETTO[trab] if trab else "")
    return simpleSplit(t, G.FONT_I, 8.6, WB - 40)


def _cella_fila(c, griglie):
    wr = [_larghezza_riga(c, g) for g in griglie]
    return min(CELLA_MAX, (WB - 24 - sum(wr) - (len(griglie) - 1) * SPAZIO) / (N * len(griglie)))


def _altezze_fila(griglie, cella, soluzione):
    """(altezza dei numeri di colonna, altezza della cornice con la spiegazione, altezza totale della fila)."""
    hc = max(len(cl) for g in griglie for cl in g["colonne"]) * 9.6 * SCALA + 6
    righe_sp = _righe_spiegazione(griglie[0]["voce"]) if soluzione else []
    h_sp = (6 + 12 * len(righe_sp) + 4 + 8) if soluzione else 0
    return hc, h_sp, 16 + hc + N * cella + 22 + h_sp


def _disegna_fila(c, y_alto, titolo, griglie, primo_numero, soluzione, cella):
    """griglie = [dati dell'esempio, dati dei bersagli...]. Restituisce l'altezza usata."""
    wr = [_larghezza_riga(c, g) for g in griglie]
    hc, h_sp, h = _altezze_fila(griglie, cella, soluzione)
    righe_sp = _righe_spiegazione(griglie[0]["voce"]) if soluzione else []
    y = y_alto - h
    G.cartiglio(c, X, y, WB, h, titolo)
    tot = sum(wr) + N * cella * len(griglie) + (len(griglie) - 1) * SPAZIO
    xx = X + (WB - tot) / 2
    y_base = y + 22 + h_sp
    for i, g in enumerate(griglie):
        esempio = i == 0
        disegna_unita(c, xx, y_base, cella, g["righe"], g["colonne"], g["pattern"], {} if esempio else g["hint"],
                      mostra=esempio or soluzione, wr=wr[i], hc=hc, evidenzia=False, scala_testo=SCALA)
        c.setFillColor(black)
        c.setFont(G.FONT_B, 8.2)
        etichetta = f"{primo_numero + i} · ESEMPIO" if esempio else f"{primo_numero + i}"
        if soluzione:
            etichetta += f" = {g['lettera']}"
        c.drawCentredString(xx + wr[i] + N * cella / 2, y_base - 12, etichetta)
        xx += wr[i] + N * cella + SPAZIO
    if soluzione:
        yb = y + 12
        hb = 6 + 12 * len(righe_sp) + 4
        c.setFillColor(GR(0.9))
        c.setStrokeColor(GR(0.45))
        c.setLineWidth(0.7)
        c.roundRect(X + 14, yb, WB - 28, hb, 4, stroke=1, fill=1)
        c.setFillColor(GR(0.1))
        c.setFont(G.FONT_I, 8.6)
        yy = yb + hb - 12
        for r in righe_sp:
            c.drawString(X + 22, yy, r)
            yy -= 12
    return h


def _riquadro_reperto(c, y_alto, testo, numero):
    """Riquadro REPERTO N° x con passaporto e frase; restituisce l'altezza usata."""
    y = y_alto - H_REPERTO
    G.cartiglio(c, X, y, WB, H_REPERTO, f"REPERTO N° {numero}")
    G.passaporto(c, X + 20, y + 8, H_REPERTO - 22)
    size = 12.5
    while c.stringWidth(testo, G.FONT_B, size) > WB - 110 and size > 8:
        size -= 0.5
    c.setFillColor(GR(0.05))
    c.setFont(G.FONT_B, size)
    c.drawCentredString(X + 56 + (WB - 56) / 2, y + 17, testo)
    return H_REPERTO


def scrivi_gruppi(blocchi, parola, percorso, soluzione, reperto=REPERTO, indizio=INDIZIO, numero_reperto=NUMERO_REPERTO):
    """Una pagina. `blocchi` = risultato di codici.crea_gruppi. Restituisce il numero di pagine (1)."""
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle("I codici della professoressa" + (" - Spiegazioni" if soluzione else ""))
    c.setAuthor("Caccia al tesoro")
    G.cornice_pagina(c, W, H)
    y = _testata(c, soluzione, con_testo=False) - 12
    nomi = ["PRIMA", "SECONDA", "TERZA", "QUARTA", "QUINTA", "SESTA"]
    numero, pre = 1, []
    file_ = [[dict(b["esempio"], voce=b["voce"])] + [dict(t, voce=b["voce"]) for t in b["bersagli"]] for b in blocchi]
    cella = min(_cella_fila(c, g) for g in file_)  # stessa grandezza in tutte le file
    if cella < CELLA_MIN:
        raise ValueError("Le griglie non entrano in una pagina: servono meno griglie per fila")
    # spazio tra i riquadri: si distribuisce il vuoto della pagina (tra 14 e 34 pt)
    altezze = [_altezze_fila(g, cella, soluzione)[2] for g in file_] + [76] + ([H_REPERTO] if reperto else []) \
        + ([H_BIGLIETTO] if indizio else [])
    libero = y - BASSO - sum(altezze)
    if libero < 14 * (len(altezze) - 1):
        raise ValueError("La pagina è piena: troppe file o riquadri")
    gap = min(34, libero / (len(altezze) - 1))
    for k, (b, griglie) in enumerate(zip(blocchi, file_)):
        titolo = f"{nomi[k] if k < len(nomi) else k + 1} SERIE · LETTERE {numero}-{numero + len(griglie) - 1}"
        if soluzione:
            titolo += f" · {nome_voce(b['voce']).upper()} · {NOMI_LIVELLO[livello_voce(b['voce'])]}"
        h = _disegna_fila(c, y, titolo, griglie, numero, soluzione, cella)
        pre.append(numero - 1)
        numero += len(griglie)
        y -= h + gap
    _riquadro_risposta(c, parola, soluzione, y, precompilate=set(pre))
    y -= 76 + gap
    if reperto:
        y -= _riquadro_reperto(c, y, reperto.format(n=numero_reperto), numero_reperto) + gap
    if indizio:
        G.biglietto_destinazione(c, X, y - H_BIGLIETTO, WB, H_BIGLIETTO, indizio["intro"], indizio["luogo"], indizio["indirizzo"])
    c.showPage()
    c.save()
    return 1
