"""Pagine del catalogo delle regole (anteprima per l'organizzatore): ogni regola ha 1-2 esempi risolti e una griglia da risolvere."""
from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

from . import grafica_tavolo as G
from .codici import N, REGOLE, livello_voce, nome_voce

W, H = A4
GR = G.gr
DY = 16
H_BANDA = 216
GAP = 6
SPIEGAZIONE_TRABOCCHETTO = {
    "specchio": "Trabocchetto: i numeri descrivono la lettera RIFLESSA (destra e sinistra scambiate): dopo aver annerito, leggi la lettera allo specchio.",
    "capovolto": "Trabocchetto: la lettera è A TESTA IN GIÙ (ruotata di 180°): dopo aver annerito, girala per leggerla.",
    "negativo": "Trabocchetto: la lettera è fatta dalle caselle che restano BIANCHE, le nere sono lo sfondo.",
}


def _testo_clue(clue):
    return " ".join(str(n) for n in clue)


def disegna_unita(c, x, y, cella, righe, colonne, pattern, hint, mostra, wr, hc, evidenzia=False, sfalsa=False,
                  scala_testo=1.0):
    """Griglia 5x5 con i numeri a bordo. (x, y) = angolo in basso a sinistra dell'area (numeri di riga compresi)."""
    gx = x + wr
    if evidenzia:  # alone dietro la griglia da risolvere
        c.setFillColor(GR(0.93))
        c.setStrokeColor(GR(0.5))
        c.setLineWidth(0.8)
        c.setDash(3, 2)
        c.roundRect(x - 3, y - 4, wr + N * cella + 6, hc + N * cella + 8, 6, stroke=1, fill=1)
        c.setDash()
    for r in range(N):
        yy = y + (N - 1 - r) * cella
        for cc in range(N):
            xx = gx + cc * cella
            nero = (mostra and pattern[r][cc]) or hint.get((r, cc)) == 1
            c.setFillColor(GR(0.08) if nero else white)
            c.setStrokeColor(GR(0.3))
            c.setLineWidth(0.7)
            c.rect(xx, yy, cella, cella, stroke=1, fill=1)
            if hint.get((r, cc)) == 1:  # casella di partenza: puntino bianco
                c.setFillColor(white)
                c.circle(xx + cella / 2, yy + cella / 2, cella * 0.13, stroke=0, fill=1)
            elif hint.get((r, cc)) == 0:  # casella di partenza vuota: crocetta
                c.setStrokeColor(GR(0.35))
                c.setLineWidth(1.1)
                d = cella * 0.22
                c.line(xx + cella / 2 - d, yy + cella / 2 - d, xx + cella / 2 + d, yy + cella / 2 + d)
                c.line(xx + cella / 2 - d, yy + cella / 2 + d, xx + cella / 2 + d, yy + cella / 2 - d)
    c.setStrokeColor(black)
    c.setLineWidth(1.8)
    c.rect(gx, y, N * cella, N * cella, stroke=1, fill=0)
    # numeri di riga (a sinistra, allineati a destra)
    c.setFillColor(black)
    for r in range(N):
        t = _testo_clue(righe[r])
        size = 9 * scala_testo if c.stringWidth(t, G.FONT_B, 9 * scala_testo) <= wr - 6 else 7.6 * scala_testo
        c.setFont(G.FONT_B, size)
        c.drawRightString(gx - 5, y + (N - 1 - r) * cella + cella / 2 - size * 0.33, t)
    # numeri di colonna (impilati dal basso verso l'alto sopra la griglia)
    for cc in range(N):
        nums = colonne[cc]
        for k, v in enumerate(reversed(nums)):
            t = str(v)
            if sfalsa:  # numeri larghi (cifre romane): colonne alterne alzate di un livello, così hanno il doppio dello spazio
                size = min(8.2, (2 * cella - 3) / c.stringWidth(t, G.FONT_B, 1))
                alza = (cc % 2) * 9
            else:
                size = max(min(8.6 * scala_testo, (cella - 2.5) / (0.556 * len(t))), 5.6)
                alza = 0
            c.setFont(G.FONT_B, size)
            c.drawCentredString(gx + cc * cella + cella / 2, y + N * cella + 4 + k * 9.6 * scala_testo + alza, t)


def _larghezza_riga(c, blocchi, size=9):
    m = 0
    for b in blocchi:
        for clue in b["righe"]:
            m = max(m, c.stringWidth(_testo_clue(clue), G.FONT_B, size))
    return min(max(m + 10, 24), 54)


def serve_sfalsa(blocchi, cella):
    """Ci sono numeri di colonna troppo larghi per la casella (cifre romane lunghe)?"""
    return any((cella - 2.5) / (0.556 * len(str(v))) < 6.4 for b in blocchi for clue in b["colonne"] for v in clue)


def _altezza_colonne(blocchi, cella=19.5):
    return max(len(clue) for b in blocchi for clue in b["colonne"]) * 9.6 + 6 + (9 if serve_sfalsa(blocchi, cella) else 0)


def disegna_banda(c, y_alto, n, blocco, soluzione):
    voce = blocco["voce"]
    x, w = 44, W - 88
    y = y_alto - H_BANDA
    livello = "MEDIO" if livello_voce(voce) <= 1 else "DIFFICILE"
    titolo = f"REGOLA {n} · {nome_voce(voce).upper()} · {livello}" if soluzione else f"REGOLA {n} · {livello}"
    G.cartiglio(c, x, y, w, H_BANDA, titolo)
    base, trab = voce
    y_testo = y_alto - 26
    if soluzione:
        t = REGOLE[base].breve + (" " + SPIEGAZIONE_TRABOCCHETTO[trab] if trab else "")
        c.setFillColor(GR(0.2))
        c.setFont(G.FONT_I, 8.2)
        yy = y_testo
        for riga in simpleSplit(t, G.FONT_I, 8.2, w - 28)[:2]:
            c.drawString(x + 14, yy, riga)
            yy -= 9.6
    tutti = blocco["esempi"] + [blocco["bersaglio"]]
    cella = 19.5
    wr = _larghezza_riga(c, tutti)
    hc = _altezza_colonne(tutti, cella)
    sfalsa = serve_sfalsa(tutti, cella)
    unita_w = wr + N * cella
    n_unita = len(tutti)
    spazio = (w - 28 - n_unita * unita_w) / max(n_unita - 1, 1)
    spazio = min(spazio, 50)
    tot = n_unita * unita_w + (n_unita - 1) * spazio
    x0 = x + (w - tot) / 2
    y_gr = y + 26  # sotto: didascalia
    for i, b in enumerate(tutti):
        xx = x0 + i * (unita_w + spazio)
        ultimo = i == n_unita - 1
        hint = b["hint"] if ultimo else {}
        disegna_unita(c, xx, y_gr, cella, b["righe"], b["colonne"], b["pattern"], hint, mostra=(not ultimo) or soluzione,
                      wr=wr, hc=hc, evidenzia=ultimo, sfalsa=sfalsa)
        c.setFillColor(black)
        if ultimo:
            c.setFont(G.FONT_B, 9)
            etichetta = f"DA RISOLVERE{f'  =  {b['lettera']}' if soluzione else ''}"
        else:
            c.setFont(G.FONT_B, 9)
            etichetta = f"ESEMPIO  =  {b['lettera']}"
        c.drawCentredString(xx + wr + N * cella / 2, y_gr - 14, etichetta)
        if i < n_unita - 1:  # freccia tra le unità
            ax = xx + unita_w + spazio / 2
            if ultimo is False:
                G.freccia_destra(c, ax - 8, y_gr + N * cella / 2, 16, 2.2) if spazio >= 24 else None


def pagina_catalogo(c, blocchi, indice, totale, soluzione, primo_numero, titolo="CATALOGO DELLE REGOLE"):
    G.cornice_pagina(c, W, H)
    c.saveState()
    c.translate(0, DY)
    G.striscione(c, W / 2, 766, 420, 44, titolo + (" · SOLUZIONI" if soluzione else ""), 25)
    c.restoreState()
    c.setFillColor(GR(0.25))
    c.setFont(G.FONT_I, 9)
    c.drawCentredString(W / 2, 740, ("Soluzioni e spiegazioni (riservate all'organizzatore). " if soluzione else
                                     "Anteprima per l'organizzatore. ") +
                        "Ogni regola ha 1-2 esempi già risolti e una griglia da risolvere.")
    y = 724
    for k, b in enumerate(blocchi):
        disegna_banda(c, y, primo_numero + k, b, soluzione)
        y -= H_BANDA + GAP
    c.setFillColor(GR(0.3))
    c.setFont(G.FONT, 8)
    c.drawCentredString(W / 2, 40, "Casella con puntino bianco = già annerita (di partenza) · casella con crocetta = già vuota · "
                                   f"pagina {indice} / {totale}")
    c.showPage()


def scrivi_catalogo(blocchi, percorso, soluzione, titolo="CATALOGO DELLE REGOLE", primo=1):
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle(titolo.capitalize() + (" - Soluzioni" if soluzione else ""))
    per_pagina = 3
    totale = (len(blocchi) + per_pagina - 1) // per_pagina
    for p in range(totale):
        pagina_catalogo(c, blocchi[p * per_pagina:(p + 1) * per_pagina], p + 1, totale, soluzione, primo + p * per_pagina, titolo)
    c.save()
