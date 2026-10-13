# Caccia al tesoro: fascicolo di enigmi

Genera due PDF A4 in bianco e nero:

- `fascicolo.pdf`: copertina + 12 enigmi, una pagina ciascuno, da stampare per i giocatori.
- `soluzioni.pdf`: le stesse pagine risolte, con spiegazione. Riservato all'organizzatore.

## Gli enigmi

| # | Livello | Tipo | Risposta breve |
|---|---------|------|----------------|
| 1 | Facile | Sudoku 4×4 con simboli | codice di 3 cifre |
| 2 | Facile | Completa le serie numeriche | un numero (somma dei mancanti) |
| 3 | Medio | Sudoku 6×6 | codice di 4 cifre |
| 4 | Medio | Futoshiki 5×5 | codice di 4 cifre |
| 5 | Facile | Labirinto con lettere sul percorso | una parola |
| 6 | Facile | Unisci i puntini | una parola (la figura) |
| 7 | Medio | Trova le 7 differenze | il numero 7 |
| 8 | Medio | Quanti quadrati e triangoli? | un numero |
| 9 | Facile | Indovinelli in rima | una parola (le iniziali) |
| 10 | Facile | Chi ha rubato la torta? | un nome |
| 11 | Medio | Griglia logica "cugini e animali" | un nome |
| 12 | Medio | Chi dice la verità? | un nome |

Ogni enigma ha una **risposta breve e univoca**, così puoi collegarli a una storia o a un codice finale
quando avrai deciso il tesoro (per esempio: una cifra da ogni enigma per un lucchetto, o una parola
da ogni enigma per comporre una frase).

## Uso

Serve Python 3 e `reportlab` (`pip install reportlab`).

```bash
cd caccia_al_tesoro
python genera.py                  # scrive fascicolo.pdf e soluzioni.pdf
python -m unittest test_enigmi -v # controlla che ogni enigma abbia soluzione unica
```

## Personalizzazione

In `config.py`:

- `SEED`: stesso seme = stessi enigmi. Cambialo per ottenere sudoku, labirinto, futoshiki,
  griglia logica e "chi dice la verità" nuovi. Poi controlla le risposte stampate dallo script.
- `NOMI`: i 5 nomi usati negli enigmi di deduzione (conviene usare nomi dei vostri familiari).
- `PAROLA_LABIRINTO`: la parola nascosta nel labirinto (3-8 lettere).
- `TITOLO`, `SOTTOTITOLO`: testi della copertina.

Per cambiare gli indovinelli o le serie numeriche modifica `INDOVINELLI` in `enigmi/deduzione.py`
e `SEQUENZE` in `enigmi/logica.py`. Le risposte nei PDF si aggiornano da sole.
Se cambi gli indovinelli, controlla che la parola formata dalle iniziali abbia ancora senso.

## Note

- Sudoku, futoshiki, labirinto, griglia logica e "chi dice la verità" hanno una soluzione unica
  verificata dal programma (e dai test). I sudoku e i labirinti possono variare a ogni seme.
- Le differenze, i puntini e le figure geometriche sono disegni fissi: se cambi il seme restano uguali.
- Sono usati solo i font standard dei PDF (Helvetica): non servono font da installare.
