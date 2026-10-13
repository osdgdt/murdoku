"""Helper di impaginazione reportlab: pagine, intestazioni, forme semplici."""
import math

from reportlab.lib.colors import black, white, Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

from .base import FACILE

W, H = A4
MARGINE = 42
GRIGIO = Color(0.82, 0.82, 0.82)
GRIGIO_SCURO = Color(0.35, 0.35, 0.35)
FONT = "Helvetica"
FONT_B = "Helvetica-Bold"
FONT_I = "Helvetica-Oblique"

# Zona riservata al riquadro risposta in fondo alla pagina
Y_RISPOSTA = 46
H_RISPOSTA = 66


def stella(c, cx, cy, r, pieno=False, spessore=1.2):
    c.setLineWidth(spessore)
    p = c.beginPath()
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.42
        x, y = cx + rr * math.cos(ang), cy + rr * math.sin(ang)
        if i == 0:
            p.moveTo(x, y)
        else:
            p.lineTo(x, y)
    p.close()
    c.setFillColor(black)
    c.drawPath(p, stroke=1, fill=1 if pieno else 0)


def a_capo(c, testo, x, y, larghezza, font=FONT, size=12.5, leading=17):
    """Scrive un paragrafo a capo automatico partendo da y (alto). Restituisce la y sotto l'ultima riga."""
    c.setFont(font, size)
    c.setFillColor(black)
    for riga in testo.split("\n"):
        for parte in simpleSplit(riga, font, size, larghezza) or [""]:
            y -= leading
            c.drawString(x, y, parte)
    return y


def _intestazione(c, numero, enigma, y_alto):
    # Etichetta "ENIGMA n"
    c.setFillColor(black)
    c.roundRect(MARGINE, y_alto - 26, 122, 26, 6, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont(FONT_B, 14)
    c.drawString(MARGINE + 12, y_alto - 18, f"ENIGMA N° {numero}")

    # Difficoltà: stelle + parola
    livello_txt = "FACILE" if enigma.livello == FACILE else "MEDIO"
    c.setFillColor(black)
    c.setFont(FONT_B, 12)
    c.drawRightString(W - MARGINE, y_alto - 18, livello_txt)
    larg = c.stringWidth(livello_txt, FONT_B, 12)
    for k in range(enigma.livello):
        stella(c, W - MARGINE - larg - 16 - k * 20, y_alto - 13, 8, pieno=True)

    # Titolo e categoria
    c.setFillColor(black)
    c.setFont(FONT_B, 26)
    c.drawString(MARGINE, y_alto - 62, enigma.titolo)
    c.setFillColor(GRIGIO_SCURO)
    c.setFont(FONT, 10.5)
    c.drawString(MARGINE, y_alto - 79, enigma.categoria.upper())
    c.setStrokeColor(black)
    c.setLineWidth(1.5)
    c.line(MARGINE, y_alto - 86, W - MARGINE, y_alto - 86)
    return y_alto - 86


def _riquadro_risposta(c, enigma, soluzione):
    x, y, w, h = MARGINE, Y_RISPOSTA, W - 2 * MARGINE, H_RISPOSTA
    c.setStrokeColor(black)
    c.setLineWidth(1.8)
    c.setFillColor(white)
    c.roundRect(x, y, w, h, 8, stroke=1, fill=0)
    c.setFillColor(black)
    c.setFont(FONT_B, 11)
    c.drawString(x + 12, y + h - 18, "RISPOSTA")
    c.setFont(FONT, 10.5)
    c.drawString(x + 12, y + h - 33, enigma.prompt_risposta)
    if soluzione:
        c.setFont(FONT_B, 20)
        c.drawString(x + 12, y + 9, enigma.risposta)
    else:
        c.setLineWidth(1)
        c.line(x + 12, y + 12, x + w - 12, y + 12)


def pagina_enigma(c, numero, totale, enigma, soluzione=False):
    y = _intestazione(c, numero, enigma, H - MARGINE + 4)
    c.setFillColor(black)
    if not soluzione:
        y = a_capo(c, enigma.consegna, MARGINE, y - 2, W - 2 * MARGINE)
        y_basso = Y_RISPOSTA + H_RISPOSTA + 12
    else:
        c.setFont(FONT_B, 11)
        c.setFillColor(GRIGIO_SCURO)
        c.drawString(MARGINE, y - 18, "SOLUZIONE (riservata all'organizzatore)")
        y -= 20
        # spiegazione in fondo, sopra il riquadro risposta
        righe = []
        for riga in enigma.spiegazione.split("\n"):
            righe += simpleSplit(riga, FONT, 11, W - 2 * MARGINE) or [""]
        h_spieg = 15 * len(righe) + 12
        y_basso = Y_RISPOSTA + H_RISPOSTA + 12 + h_spieg
        c.setFillColor(black)
        c.setFont(FONT, 11)
        yy = Y_RISPOSTA + H_RISPOSTA + 12 + h_spieg - 14
        for r in righe:
            c.drawString(MARGINE, yy, r)
            yy -= 15
    box = (MARGINE, y_basso, W - 2 * MARGINE, y - 10 - y_basso)
    c.saveState()
    enigma.disegna(c, box, soluzione)
    c.restoreState()
    _riquadro_risposta(c, enigma, soluzione)
    c.setFillColor(GRIGIO_SCURO)
    c.setFont(FONT, 9)
    c.drawCentredString(W / 2, 24, f"{numero} / {totale}")
    c.showPage()


def copertina(c, titolo, sottotitolo, soluzioni=False):
    c.setFillColor(black)
    # cornice
    c.setLineWidth(5)
    c.rect(MARGINE, MARGINE, W - 2 * MARGINE, H - 2 * MARGINE, stroke=1, fill=0)
    c.setLineWidth(1.2)
    c.rect(MARGINE + 9, MARGINE + 9, W - 2 * MARGINE - 18, H - 2 * MARGINE - 18, stroke=1, fill=0)
    for k, (cx, cy) in enumerate([(W / 2 - 70, H - 150), (W / 2, H - 150), (W / 2 + 70, H - 150)]):
        stella(c, cx, cy + (12 if k == 1 else 0), 26 if k == 1 else 20, pieno=True)
    c.setFont(FONT_B, 40)
    c.drawCentredString(W / 2, H - 250, titolo)
    c.setFont(FONT, 20)
    c.drawCentredString(W / 2, H - 285, sottotitolo)
    if soluzioni:
        c.setFont(FONT_B, 22)
        c.drawCentredString(W / 2, H - 340, "SOLUZIONI")
        c.setFont(FONT, 13)
        c.drawCentredString(W / 2, H - 362, "Riservate all'organizzatore: non farle vedere ai giocatori!")
        c.showPage()
        return
    c.setFont(FONT_B, 15)
    c.drawString(MARGINE + 40, H - 350, "COME SI GIOCA")
    regole = [
        "Ogni pagina è un enigma da risolvere con la matita.",
        "Il bollino in alto a destra dice se l'enigma è facile (1 stella) o medio (2 stelle).",
        "Leggi bene la consegna: spiega cosa fare e cosa scrivere.",
        "Scrivi la risposta nel riquadro in fondo alla pagina.",
        "Si può collaborare: grandi e piccoli, tutti insieme!",
        "Si può saltare un enigma e tornarci dopo.",
        "Niente telefonini né ricerche su internet.",
    ]
    y = H - 366
    for r in regole:
        fine = a_capo(c, r, MARGINE + 64, y, W - 2 * MARGINE - 110, size=13, leading=18)
        stella(c, MARGINE + 50, y - 13, 5.5, pieno=True)
        y = fine - 9
    c.setFont(FONT_B, 13)
    c.drawString(MARGINE + 40, 190, "Squadra:")
    c.setLineWidth(1)
    c.line(MARGINE + 110, 188, W - MARGINE - 40, 188)
    c.drawString(MARGINE + 40, 160, "Ora di partenza:")
    c.line(MARGINE + 150, 158, MARGINE + 260, 158)
    c.drawString(MARGINE + 290, 160, "Ora di arrivo:")
    c.line(MARGINE + 380, 158, W - MARGINE - 40, 158)
    c.showPage()
