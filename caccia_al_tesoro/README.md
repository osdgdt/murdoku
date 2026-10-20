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

## Plancia rifinita + mini enigma 10 (versione "da scatola", per la stampa in bianco e nero)

Versione molto più curata dell'enigma 8, in due pagine seguite dal mini enigma 10 che trasforma il numero in parola:

```bash
python genera_plancia.py                  # punteggio e parola da config.py (50 -> COLPEVOLE)
python genera_plancia.py 72 TESORO 7      # punteggio (19-85), parola (3-9 lettere), seme
```

Scrive `plancia_e_mini10.pdf` (2 pagine per i giocatori) e `plancia_e_mini10_soluzioni.pdf`.

- **Pagina 1, "Serata giochi da tavolo":** isola di 19 esagoni con terreni illustrati (foresta, campi, colline, mare,
  montagna), meeple di 4 stili, dadi, monete, carte e un rosone di triangoli, con cornice, striscione e ombre. Sei
  domande: la **somma delle risposte è il punteggio finale**.
- **Pagina 2, "Il codice del tesoro" (mini enigma 10):** il punteggio, le cifre sommate (chiave), i simboli Pigpen da
  tradurre e l'alfabeto per tornare indietro della chiave: esce la parola.
- **Soluzioni:** gli elementi contati sono cerchiati e numerati; sotto dadi, monete e rosone c'è il conteggio.
- Il punteggio (`PUNTEGGIO_ENIGMA_8`) e la parola (`PAROLA_PLANCIA`, ora **COLPEVOLE**, 9 lettere: la soluzione del mini enigma 10) sono in `config.py` (`SOLUZIONI["forme"]` resta la parola dell'enigma 8 del fascicolo); i sei conteggi sono
  scelti dal programma con somma esatta (un tipo di domanda ciascuno, ognuno nel suo intervallo).
- Le pagine non riportano il numero dell'enigma né la difficoltà.
- In fondo a entrambe le pagine dei giocatori c'è un biglietto con puntina da mappa: «Se non riesci a risolvere l'enigma, vai a
  Desteenazione → Via Livorno 7, Brescia». Testi in `config.py` (`AIUTO_INTRO`, `AIUTO_LUOGO`, `AIUTO_INDIRIZZO`; con
  `AIUTO_LUOGO = ""` il biglietto sparisce). Non compare nelle soluzioni.
- Tutto è in scala di grigi (verificato dai test) e usa solo font standard dei PDF.

## Mini enigmi di conversione (numero → parola)

Se la soluzione di un enigma è un numero (per esempio il 50 della plancia, o il 43 delle vecchie forme), questi
10 mini enigmi lo trasformano in una parola. Sono costruiti dal programma per **qualsiasi numero da 1 a 99 e
qualsiasi parola di 3-7 lettere**: il giocatore conosce solo il numero, la parola sta nel messaggio.

```bash
python genera_mini.py              # esempio: numero 43 -> MEEPLE
python genera_mini.py 50 SOLE      # qualsiasi numero (1-99) e parola (3-7 lettere)
```

Scrive `mini_enigmi.pdf` (per i giocatori, 2 mini per pagina) e `mini_enigmi_soluzioni.pdf`.

| # | Livello | Mini enigma | Come il numero diventa la chiave |
|---|---------|-------------|----------------------------------|
| 1 | Facile | Cesare con la somma delle cifre | chiave = somma delle cifre (43 → 7); si torna indietro di 7 posti |
| 2 | Facile | La casella di partenza | decine = riga, unità = colonna di una griglia 10×10; si leggono le lettere verso destra |
| 3 | Facile | Una lettera ogni K | K = somma cifre ridotta a una cifra (1 → 10); si tengono le lettere in posizione K, 2K, 3K... |
| 4 | Medio | Cesare con le cifre, una alla volta | ogni lettera ha uno spostamento diverso: le cifre del numero, a rotazione |
| 5 | Medio | La ruota dei salti | salto = K; dalla stella si salta di K lettere su una ruota di 23 |
| 6 | Medio | Gruppi a misura di cifra | la fila di lettere si divide in gruppi lunghi come le cifre (0 = 10); vale la prima lettera di ogni gruppo |
| 7 | Medio | Calcoli con il tuo numero | espressioni con N, S (somma cifre) e P (prodotto cifre) che danno 1-21, poi tabella A=1 |
| 8 | Medio | L'alfabeto a rovescio | Z=1, V=2...; ogni numero è aumentato della somma delle cifre |
| 9 | Difficile | Numeri romani | numero della lettera + somma delle cifre, scritto in numeri romani |
| 10 | Difficile | Pigpen e Cesare insieme | prima si decifra il Pigpen, poi si torna indietro della somma delle cifre |

La verifica (`python -m unittest test_enigmi`) decodifica ognuno dei 10 mini enigmi con le regole della consegna,
per vari numeri e parole.

## Enigma "I codici della professoressa" (dossier segreto, una griglia 5×5 per lettera)

Una professoressa è stata rapita e ha lasciato i suoi codici per farsi trovare: una mini griglia 5×5 per ogni lettera
della parola finale. I numeri attorno alla griglia NON sono quelli dei nonogrammi: seguono una regola da scoprire
guardando 1-2 esempi già risolti. Ogni lettera ha una regola diversa, presa da un **pool unico di 22 regole**; i blocchi
vanno dal più facile al più difficile.

```bash
python genera_codici.py              # parola NASCONDIGLIO (12 lettere: 12 regole del pool, a distanza regolare)
python genera_codici.py SOLE         # da 1 a 22 lettere; con 22 lettere si usano tutte le regole
```

Scrive:

- `codici_professoressa.pdf`: pagine dei giocatori (storia, frase d'aiuto generale, griglie, riquadro risposta con una casellina per lettera). Non dice quali regole ci sono.
- `codici_professoressa_spiegatori.pdf`: gli stessi blocchi risolti, con sotto ognuno un riquadro che spiega la regola (e l'eventuale trabocchetto), e la parola nelle caselline.
- `catalogo_regole.pdf` / `catalogo_regole_soluzioni.pdf`: anteprima di tutte le 22 regole (8 pagine) con bersagli dalla parola CASTELLO.

Il pool (`CATALOGO` in `enigmi/codici.py`, nell'ordine di difficoltà): Salti, Binario a due metà, Somme progressive, Somma delle
posizioni, Quante nere e l'ultima (medie); poi, difficili: Dispari e pari, Quadrati e conteggio, Binario intero, Inizio e
lunghezza, Potenze di 3, Fattoriali, Estremi, Monete romane, Somma e prodotto, Prodotti di numeri primi, Binario a due metà +
specchio, Binario romano, Somme progressive + capovolto, Codice Gray, Somma delle posizioni + negativo, Prodotto dei posti,
Tre misure. Tre hanno un trabocchetto sulla lettera (specchio, capovolto, negativo); due scrivono i numeri in cifre romane
(se un numero di colonna è troppo largo, le colonne vicine vengono alzate di un livello).

**Lunghezza della parola:** da 1 a 22 lettere dell'alfabeto italiano. Gli esempi usano lettere che NON sono nella parola,
quindi servono lettere libere: con troppe lettere diverse nella parola il programma si ferma con un errore chiaro.

**Verifica:** per ognuna delle 22 regole e per tutte le 21 lettere la griglia da risolvere ha una sola soluzione, controllata
con una forza bruta indipendente dal solver (righe candidate dalla funzione della regola, colonne ricalcolate a mano). Le
regole "a incrocio" hanno al massimo 4 caselle di partenza (puntino bianco = già nera, crocetta = già vuota): fino a 4 nella
somma delle posizioni, fino a 2 in "quante nere e l'ultima" e nel negativo, 1-2 nel prodotto dei posti. Gli esempi sono scelti
dal programma e non valgono per nessuna delle altre 21 regole. `crea_enigma` controlla l'unicità di ogni blocco prima di
disegnarlo.

### Enigma a gruppi: PARCHEGGIO (regola 3 + regola 4, una pagina)

Una parola divisa in serie, ognuna con la sua regola del pool: le prime 5 lettere (P A R C H) con la regola 3
(Somme progressive), le ultime 5 (E G G I O) con la regola 4 (Somma delle posizioni). La prima griglia di ogni serie
(P ed E) è già risolta e la sua lettera è già scritta nella parola; le altre 8 vanno risolte con la stessa regola.

```bash
python genera_parcheggio.py                         # PARCHEGGIO, regole 3 e 4 (5 lettere ciascuna)
python genera_parcheggio.py PARCHEGGIO 3x5,4x5      # parola e gruppi "numero regola x lettere" (numeri del catalogo di 22)
```

Scrive `codici_parcheggio.pdf` (giocatori, una pagina: due file da 5 griglie, riquadro con le 10 caselline con P ed E
precompilate, riquadro REFERTO «La parola che trovi è un referto: segnalo sul tuo passaporto» e biglietto con puntina da
mappa «Se ti serve un indizio, vai alla Biblioteca di San Polo → Via Tiziano 246, Brescia»; i testi sono in cima a
`enigmi/dossier_gruppi.py`, `referto=""` o `indizio=None` li tolgono) e `codici_parcheggio_spiegatori.pdf` (griglie annerite con la lettera, regola spiegata
sotto ogni fila, parola completa, e gli stessi due riquadri). Ogni griglia da risolvere ha soluzione unica (verifica a forza bruta nei test): solo la
O ha 3 caselle di partenza (puntino bianco), tutte le altre 0. Le celle sono piccole (circa 10 pt) perché 5 griglie
devono stare in fila; per griglie più grandi si può dividere una serie su due file.

## Labirinto con parola/frase e riquadro REPERTO (pagina singola)

Versione facile del labirinto (12×12, una sola strada, lettere trappola nei vicoli ciechi) in un PDF a parte, senza numero
d'enigma né difficoltà. La frase è **PARCO GALLO** (10 lettere sul percorso, gruppi di caselline 5+5) e sotto il labirinto
c'è il riquadro «REPERTO · Il reperto è: POLIZIOTTO».

```bash
python genera_labirinto.py                       # PARCO GALLO / POLIZIOTTO da config.py
python genera_labirinto.py "ARCHIVIO SOLE" PIPPO 7   # frase (3-14 lettere, spazi ammessi), reperto, seme
```

Scrive `labirinto.pdf` e `labirinto_soluzione.pdf` (percorso in grigio, lettere e frase scritte); il riquadro REPERTO
c'è in entrambi. In `config.py`: `PAROLA_LABIRINTO_PAGINA` e `REPERTO` (`PAROLA_LABIRINTO` resta la parola del labirinto
del fascicolo, che non cambia).

## Come sono verificati

- Mastermind: la parola segreta è l'unica sequenza di lettere diverse compatibile con tutti i tentativi (controllo su tutte le combinazioni).
- Pixel nascosti: ogni griglia ha soluzione unica; se una lettera da sola è ambigua, il programma svela il minimo di caselle necessarie.
- Serie di figure, ombre e specchi: in ogni prova una sola opzione è giusta; le forme usate non sono simmetriche, quindi lo specchio non coincide con nessuna rotazione.
- Cifrari: la decodifica del messaggio stampato restituisce la parola. Enigma 8: ogni conteggio è ricalcolato dai dati disegnati; i triangoli del rosone sono contati con due algoritmi indipendenti.
- Labirinto, ladro e cugini e animali: un solo percorso / un solo colpevole / una sola soluzione.

## Note

- Sono usati solo i font standard dei PDF (Helvetica): non servono font da installare.
- La storia e il tesoro non sono ancora decisi: ogni parola è indipendente dalle altre.
