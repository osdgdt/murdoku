"""L'enigma dei codici della professoressa: dossier da agenzia di spionaggio, una griglia per lettera.

Pagine dei giocatori: storia, frase d'aiuto, un blocco per lettera (esempi risolti + griglia da risolvere, dal più
facile al più difficile) e riquadro risposta con una casellina per lettera.
Pagine per gli spiegatori: gli stessi blocchi risolti, con sotto un riquadro che spiega la regola.
"""
from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

from . import grafica_tavolo as G
from .codici import N, REGOLE, livello_voce, nome_voce
from .dossier_codici import SPIEGAZIONE_TRABOCCHETTO, _altezza_colonne, _larghezza_riga, disegna_unita, serve_sfalsa

W, H = A4
GR = G.gr
CELLA = 14
X, WB = 44, W - 88
BASSO = 58  # margine inferiore (sotto: legenda e numero di pagina)
ALTO = 806

STORIA = ("La professoressa è scomparsa: l'hanno rapita. Prima che la portassero via ha nascosto i suoi codici segreti, "
          "uno per lettera: sono l'unico indizio che ci ha lasciato per farsi trovare. Decifrali tutti e leggi, in ordine, "
          "la parola che ti dice dove cercarla.")
AIUTO = ("Come si fa: in ogni codice i numeri attorno alla griglia descrivono quali caselle sono nere, ma non come in un "
         "nonogramma. Guarda gli esempi già risolti, scopri la regola e applicala alla griglia vuota. Poi leggi la lettera "
         "che compare e scrivila nella casella giusta. Qualche codice nasconde un trabocchetto.")

NOMI_LIVELLO = {1: "MEDIO", 2: "DIFFICILE", 3: "DIFFICILE"}


def _altezza_blocco(c, blocco, soluzione, cella=CELLA):
    tutti = blocco["esempi"] + [blocco["bersaglio"]]
    h = 14 + _altezza_colonne(tutti, cella) + N * cella + 22
    if soluzione:
        h += 6 + 12 * len(_righe_spiegazione(blocco)) + 10
    return h


def _righe_spiegazione(blocco):
    base, trab = blocco["voce"]
    t = REGOLE[base].breve + (" " + SPIEGAZIONE_TRABOCCHETTO[trab] if trab else "")
    return simpleSplit(t, G.FONT_I, 8.6, WB - 40)


def disegna_blocco(c, y_alto, n, blocco, soluzione, cella=CELLA):
    """Disegna un blocco con il bordo superiore a y_alto; restituisce l'altezza usata."""
    voce = blocco["voce"]
    h = _altezza_blocco(c, blocco, soluzione, cella)
    y = y_alto - h
    titolo = f"CODICE {n}"
    if soluzione:
        titolo += f" · {nome_voce(voce).upper()} · {NOMI_LIVELLO[livello_voce(voce)]}"
    G.cartiglio(c, X, y, WB, h, titolo)
    tutti = blocco["esempi"] + [blocco["bersaglio"]]
    wr = _larghezza_riga(c, tutti)
    hc = _altezza_colonne(tutti, cella)
    sfalsa = serve_sfalsa(tutti, cella)
    unita_w = wr + N * cella
    k = len(tutti)
    spazio = min((WB - 36 - k * unita_w) / max(k - 1, 1), 54)
    x0 = X + (WB - (k * unita_w + (k - 1) * spazio)) / 2
    y_base = y + 22 + (6 + 12 * len(_righe_spiegazione(blocco)) + 10 if soluzione else 0)
    for i, b in enumerate(tutti):
        ultimo = i == k - 1
        xx = x0 + i * (unita_w + spazio)
        disegna_unita(c, xx, y_base, cella, b["righe"], b["colonne"], b["pattern"], b["hint"] if ultimo else {},
                      mostra=(not ultimo) or soluzione, wr=wr, hc=hc, evidenzia=ultimo, sfalsa=sfalsa)
        c.setFillColor(black)
        c.setFont(G.FONT_B, 8.6)
        if ultimo:
            testo = f"DA RISOLVERE{'  =  ' + b['lettera'] if soluzione else ''}"
        else:
            testo = f"ESEMPIO  =  {b['lettera']}"
        c.drawCentredString(xx + wr + N * cella / 2, y_base - 12, testo)
        if not ultimo:
            G.freccia_destra(c, xx + unita_w + spazio / 2 - 7, y_base + N * cella / 2, 14, 2) if spazio >= 22 else None
    if soluzione:  # riquadro che spiega la regola, sotto le griglie
        righe = _righe_spiegazione(blocco)
        hb = 6 + 12 * len(righe) + 4
        yb = y + 14
        c.setFillColor(GR(0.9))
        c.setStrokeColor(GR(0.45))
        c.setLineWidth(0.7)
        c.roundRect(X + 14, yb, WB - 28, hb, 4, stroke=1, fill=1)
        c.setFillColor(GR(0.1))
        c.setFont(G.FONT_I, 8.6)
        yy = yb + hb - 12
        for r in righe:
            c.drawString(X + 22, yy, r)
            yy -= 12
    return h


def _testata(c, soluzione, aiuto=AIUTO):
    """Striscione, timbro e storia; restituisce la y sotto cui comincia il primo blocco."""
    G.striscione(c, W / 2, 782, 420, 42, "I CODICI DELLA PROFESSORESSA", 24)
    c.setFillColor(GR(0.25))
    c.setFont(G.FONT_B, 8)
    c.drawCentredString(W / 2, 752, "DOSSIER RISERVATO · CLASSIFICATO · NON LASCIARE INCUSTODITO"
                        + (" · COPIA DEGLI SPIEGATORI" if soluzione else ""))
    y = 736
    if soluzione:
        return y
    c.setFillColor(GR(0.08))
    c.setFont(G.FONT, 9.2)
    for t, font in ((STORIA, G.FONT), (aiuto, G.FONT_I)):
        for riga in simpleSplit(t, font, 9.2, WB - 10):
            c.drawString(X + 5, y, riga)
            y -= 11.6
        y -= 5
    return y - 2


def _riquadro_risposta(c, parola, soluzione, y_alto, precompilate=()):
    n = len(parola)
    h = 66
    y = y_alto - h
    G.cartiglio(c, X, y, WB, h, "LA PAROLA DELLA PROFESSORESSA")
    lato = min(36, (WB - 36 - (n - 1) * 4) / n)
    tot = n * lato + (n - 1) * 4
    x0 = X + (WB - tot) / 2
    for i, ch in enumerate(parola):
        xx = x0 + i * (lato + 4)
        c.setFillColor(white)
        c.setStrokeColor(black)
        c.setLineWidth(1.4)
        c.rect(xx, y + 10, lato, lato * 1.15, stroke=1, fill=1)
        c.setFillColor(GR(0.4))
        c.setFont(G.FONT, 6.5)
        c.drawString(xx + 2, y + 10 + lato * 1.15 - 7, str(i + 1))
        if soluzione or i in precompilate:
            c.setFillColor(black)
            c.setFont(G.FONT_B, lato * 0.6)
            c.drawCentredString(xx + lato / 2, y + 10 + lato * 0.37, ch)
    return h


def scrivi_enigma(blocchi, parola, percorso, soluzione):
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(percorso, pagesize=A4)
    c.setTitle("I codici della professoressa" + (" - Spiegazioni" if soluzione else ""))
    c.setAuthor("Caccia al tesoro")
    h_risp = 66 + 10
    pagina = 1
    y = None

    def nuova_pagina():
        nonlocal y
        G.cornice_pagina(c, W, H)
        if pagina == 1:
            y = _testata(c, soluzione)
        else:
            G.striscione(c, W / 2, 786, 300, 30, "I CODICI DELLA PROFESSORESSA" if not soluzione else "SPIEGAZIONI", 17)
            y = 748

    def chiudi_pagina():
        c.setFillColor(GR(0.3))
        c.setFont(G.FONT, 7.8)
        c.drawCentredString(W / 2, 36, "Casella con puntino bianco = già annerita (di partenza) · casella con crocetta = già vuota"
                            f" · pagina {pagina}")
        c.showPage()

    nuova_pagina()
    for i, b in enumerate(blocchi):
        h = _altezza_blocco(c, b, soluzione)
        ultimo = i == len(blocchi) - 1
        servono = h + (h_risp if ultimo else 0)
        if y - servono < BASSO:
            chiudi_pagina()
            pagina += 1
            nuova_pagina()
        disegna_blocco(c, y, i + 1, b, soluzione)
        y -= h + 11
    if y - 66 < BASSO - 6:  # il riquadro risposta non ci sta: pagina nuova
        chiudi_pagina()
        pagina += 1
        nuova_pagina()
    _riquadro_risposta(c, parola, soluzione, y - 2)
    chiudi_pagina()
    c.save()
    return pagina
