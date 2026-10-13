# Caccia al tesoro: fascicolo di enigmi (versione 2, soluzioni sempre parole)

Genera tre PDF A4 in bianco e nero:

- `fascicolo.pdf`: copertina + 12 enigmi, una pagina ciascuno, da stampare per i giocatori.
- `soluzioni.pdf`: le stesse pagine risolte, con spiegazione. Riservato all'organizzatore.
- `varianti_enigma8.pdf`: i 4 metodi di conversione numero→parola dell'enigma 8, ognuno con pagina del giocatore e pagina della soluzione.

**La soluzione di ogni enigma è una parola.** Nei facili (1, 2, 5, 6, 9, 10) il riquadro risposta ha una casellina per lettera; nei medi ha una linea libera.

## Gli enigmi

| # | Livello | Enigma | Come si arriva alla parola | Parola |
|---|---------|--------|----------------------------|--------|
| 1 | Facile | Messaggio a simboli | tabella simbolo→lettera sulla pagina | NUVOLA |
| 2 | Facile | La scala di parole | si cambia una lettera per volta; l'ultima parola è la risposta | MARE |
| 3 | Medio | Mastermind di lettere | tentativi con cerchi neri/vuoti; la parola segreta è unica | FIORE |
| 4 | Medio | Il cifrario Pigpen | chiave a griglie e X stampata sulla pagina | TESORO |
| 5 | Facile | Il labirinto | lettere lungo il percorso giusto | CHIAVE |
| 6 | Facile | Serie di figure | 5 serie, una lettera sotto ogni figura giusta | BARCA |
| 7 | Medio | Ombre e specchi | 5 prove, una lettera sotto ogni figura giusta | ISOLA |
| 8 | Medio | Quante forme? | vedi sotto: 4 metodi | MAPPA |
| 9 | Facile | Il cifrario di Cesare | chiave con le due strisce dell'alfabeto | ESTATE |
| 10 | Facile | Chi ha rubato la torta? | nome del ladro | BRUNO |
| 11 | Medio | Cugini e animali | nome di chi ha il pesce rosso | ANNA |
| 12 | Medio | Pixel nascosti | 6 mini-nonogram 5×5, ognuno disegna una lettera | STELLA |

### Enigma 8: i quattro metodi

In `config.py` scegli `METODO_ENIGMA_8`; `varianti_enigma8.pdf` li mostra tutti.

| Metodo | Come funziona |
|--------|---------------|
| `scelta_multipla` | Stessa coppia di figure dell'originale (30 quadrati + 13 triangoli = 43). Una tabella "totale → parola" a 7 righe con totali vicini; la riga giusta contiene la parola. |
| `mini_figure` | 5 figure piccole; per ognuna 3 opzioni «numero = lettera». Le 5 lettere formano la parola. |
| `coordinate` | 5 coppie di figure danno riga e colonna di una griglia 6×6 di lettere (battaglia navale). |
| `tabella_a1` | 5 figure piccole, conteggi 1-21 trasformati in lettere con la tabella A=1, B=2... (21 lettere). Usa solo lettere ottenibili con le figure disponibili: se la parola scelta non va bene, il programma usa FALCO. |

## Uso

Serve Python 3 e `reportlab` (`pip install reportlab`).

```bash
cd caccia_al_tesoro
python genera.py                  # scrive i tre PDF e stampa le 12 risposte
python -m unittest test_enigmi -v # controlla soluzioni uniche e risposte coerenti (circa 25 secondi)
```

## Personalizzazione

In `config.py`:

- `SOLUZIONI`: le parole degli enigmi 1, 3, 4, 6, 7, 8, 9, 12. Solo le 21 lettere dell'alfabeto italiano
  (niente J, K, W, X, Y). Vincoli: mastermind 4-6 lettere tutte diverse; serie, ombre e forme esattamente 5 lettere;
  pixel 4-6 lettere. Il programma si ferma con un errore chiaro se una parola non va bene.
- `PAROLA_LABIRINTO`: la parola nascosta nel labirinto (3-8 lettere).
- `NOMI`: i nomi usati nei due enigmi di deduzione. `SEED`: cambialo per avere labirinto, tentativi del mastermind,
  figure e simboli diversi.
- `TITOLO`, `SOTTOTITOLO`: testi della copertina.

La scala di parole (enigma 2, soluzione MARE) è scritta a mano in `enigmi/parole.py` (`SCALA`): se la cambi,
`controlla_scala` verifica che ogni passo cambi una sola lettera.

Dopo ogni cambio lancia `python genera.py`: le soluzioni nei PDF si aggiornano da sole.

## Come sono verificati

- Mastermind: la parola segreta è l'unica sequenza di lettere diverse compatibile con tutti i tentativi (controllo su tutte le combinazioni).
- Pixel nascosti: ogni griglia ha soluzione unica; se una lettera da sola è ambigua, il programma svela il minimo di caselle necessarie.
- Serie di figure, ombre e specchi: in ogni prova una sola opzione è giusta; le forme usate non sono simmetriche, quindi lo specchio non coincide con nessuna rotazione.
- Cifrari: la decodifica del messaggio stampato restituisce la parola. Conteggi dell'enigma 8: confrontati con un calcolo per forza bruta.
- Labirinto, ladro e cugini e animali: un solo percorso / un solo colpevole / una sola soluzione.

## Note

- Sono usati solo i font standard dei PDF (Helvetica): non servono font da installare.
- La storia e il tesoro non sono ancora decisi: ogni parola è indipendente dalle altre.
