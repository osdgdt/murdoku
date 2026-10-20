"""Parametri personalizzabili del fascicolo.

Cambia qui nomi, parole e titoli, poi rigenera con `python genera.py`.
Le parole possono usare solo le 21 lettere dell'alfabeto italiano (niente J, K, W, X, Y).
"""

# Seme fisso: stesso seme = stessi enigmi a ogni rigenerazione.
# Cambialo (es. 7, 99, 2027) per ottenere un fascicolo con labirinto, mastermind, ecc. nuovi.
SEED = 2026

TITOLO = "CACCIA AL TESORO"
SOTTOTITOLO = "Il fascicolo degli enigmi"

# Nomi dei personaggi usati nei giochi di deduzione (5 nomi, iniziali tutte diverse).
# I primi 4 sono i cugini dell'enigma 11; il ladro dell'enigma 10 è uno dei primi 4.
NOMI = ["Anna", "Bruno", "Carla", "Dario", "Elisa"]

# Parola nascosta nel labirinto (enigma 5): 3-8 lettere.
PAROLA_LABIRINTO = "CHIAVE"

# Le parole-soluzione degli enigmi nuovi. Regole:
#   simboli, cesare, pigpen: qualsiasi parola; conviene 5-8 lettere
#   mastermind:              4-6 lettere, tutte DIVERSE tra loro
#   serie, ombre:            esattamente 5 lettere
#   forme (enigma 8):        3-6 lettere, senza spazi
#   pixel:                   4-6 lettere
# Non cambiano: la scala di parole (enigma 2: MARE) e i nomi degli enigmi 10 e 11.
SOLUZIONI = {
    "simboli": "NUVOLA",     # enigma 1
    "mastermind": "FIORE",   # enigma 3
    "pigpen": "TESORO",      # enigma 4
    "serie": "BARCA",        # enigma 6
    "ombre": "ISOLA",        # enigma 7
    "forme": "MEEPLE",       # enigma 8, serata giochi da tavolo (una domanda per lettera)
    "cesare": "ESTATE",      # enigma 9
    "pixel": "STELLA",       # enigma 12
}

# Metodo di conversione numero -> parola dell'enigma 8 nel fascicolo.
# Uno tra: "tabella_a1", "tracciato", "griglia_esagonale", "carte", "classifica", "personaggi".
# In varianti_enigma8.pdf trovi tutti e sei per confrontarli.
METODO_ENIGMA_8 = "tracciato"

# Punteggio finale della plancia "Serata giochi da tavolo" (genera_plancia.py): è la somma delle sei risposte
# (tessere, meeple, dadi, monete, carte, triangoli) e il numero che il mini enigma 10 trasforma nella parola
# SOLUZIONI["forme"]. Tra 19 e 85.
PUNTEGGIO_ENIGMA_8 = 50

# Biglietto "se non riesci a risolvere l'enigma" in fondo alle pagine di plancia_e_mini10.pdf
# (non compare nelle soluzioni). Lascia AIUTO_LUOGO vuoto ("") per non disegnarlo.
AIUTO_INTRO = "Se non riesci a risolvere l'enigma, vai a"
AIUTO_LUOGO = "Desteenazione"
AIUTO_INDIRIZZO = "Via Livorno 7, Brescia"
