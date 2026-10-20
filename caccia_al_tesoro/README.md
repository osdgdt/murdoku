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
| 8 | Medio | Serata giochi da tavolo (plancia da contare) | vedi sotto: 6 metodi | MEEPLE |
| 9 | Facile | Il cifrario di Cesare | chiave con le due strisce dell'alfabeto | ESTATE |
| 10 | Facile | Chi ha rubato la torta? | nome del ladro | BRUNO |
| 11 | Medio | Cugini e animali | nome di chi ha il pesce rosso | ANNA |
| 12 | Medio | Pixel nascosti | 6 mini-nonogram 5×5, ognuno disegna una lettera | STELLA |

### Enigma 8: serata giochi da tavolo

Una partita è rimasta a metà: sulla plancia ci sono un'isola di 19 esagoni con terreni (foresta, campi, colline,
mare, montagna, distinti da trame leggibili in bianco e nero), meeple di 4 "colori" (nero, bianco, rigato, puntinato),
3 dadi, monete, carte a ventaglio e un rosone esagonale di triangoli. Sei domande (una per lettera di MEEPLE) chiedono
ognuna un conteggio diverso: tessere di un terreno, meeple di un colore, somma dei dadi, monete, carte con la
stella, triangoli del rosone. I conteggi sono costruiti su misura: per MEEPLE sono 11, 5, 5, 14, 10, 5 (le lettere in A=1).

Sei metodi per trasformare i numeri nella parola. In `config.py` scegli `METODO_ENIGMA_8`;
`varianti_enigma8.pdf` li mostra tutti (la plancia è la stessa, cambia solo il blocco in basso).

| Metodo | Come funziona |
|--------|---------------|
| `tabella_a1` | Tabella dell'alfabeto con i numeri 1-21: 11 = M, 5 = E, 14 = P, 10 = L. Il più semplice. |
| `tracciato` | Tracciato del punteggio a serpentina di 21 caselle numerate, ognuna con una lettera: si legge la lettera della casella con il proprio numero. È il metodo predefinito. |
| `griglia_esagonale` | Una riga di esagoni di lettere per domanda; il risultato dice la colonna (battaglia navale a esagoni). |
| `carte` | Per ogni domanda tre carte «numero = lettera» (due sbagliate plausibili): si sceglie la carta con il proprio numero. |
| `classifica` | Si sommano le sei risposte (50) e si cerca il totale in una classifica di 7 righe; accanto sta la parola. |
| `personaggi` | Mazzo di 21 personaggi numerati (5 = Elfo, 10 = Lupo...): il numero indica un personaggio e se ne usa l'iniziale. |

## Uso

Serve Python 3 e `reportlab` (`pip install reportlab`).

```bash
cd caccia_al_tesoro
python genera.py                  # scrive i tre PDF e stampa le 12 risposte
python -m unittest test_enigmi -v # controlla soluzioni uniche e risposte coerenti (circa 35 secondi)
```

## Personalizzazione

In `config.py`:

- `SOLUZIONI`: le parole degli enigmi 1, 3, 4, 6, 7, 8, 9, 12. Solo le 21 lettere dell'alfabeto italiano
  (niente J, K, W, X, Y). Vincoli: mastermind 4-6 lettere tutte diverse; serie e ombre esattamente 5 lettere;
  enigma 8 (plancia) 3-6 lettere; pixel 4-6 lettere. Per l'enigma 8 non tutte le parole sono realizzabili: ogni
  domanda usa un pezzo diverso, ognuno con un massimo (dadi 18, carte 10, tessere e meeple 8), quindi troppe
  lettere alte danno un errore chiaro. Il programma si ferma con un errore chiaro se una parola non va bene.
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
- Cifrari: la decodifica del messaggio stampato restituisce la parola. Enigma 8: ogni conteggio è ricalcolato dai dati disegnati; i triangoli del rosone sono contati con due algoritmi indipendenti.
- Labirinto, ladro e cugini e animali: un solo percorso / un solo colpevole / una sola soluzione.

## Note

- Sono usati solo i font standard dei PDF (Helvetica): non servono font da installare.
- La storia e il tesoro non sono ancora decisi: ogni parola è indipendente dalle altre.
