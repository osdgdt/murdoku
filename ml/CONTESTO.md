# Contesto del progetto «rete neurale che genera Murdoku»

Questo file serve a chi riprende il lavoro in una **nuova sessione** (per esempio sul computer dell'autore, con la cartella dei casi
sotto mano) senza aver visto la conversazione precedente. Lo si legge insieme a `ml/README.md` e `ml/FORMATO.md`.

## Chi, che cosa, come si lavora

- Progetto: **Murdoku**, app web statica (moduli ES, nessun build; interfaccia in italiano, dizionario inglese), repository
  `osdgdt/murdoku`, Firebase `murdoku-61284`, pubblicazione su GitHub Pages con Actions.
- L'autore programma soprattutto in **Python** (elaborazione di immagini, reti neurali). Si risponde **in italiano**. Si fanno domande
  sui requisiti prima di decisioni che contano.
- **Una PR per passo**, aperta solo quando l'autore la chiede; la unisce lui. Dopo l'unione il ramo di lavoro si riporta su
  `origin/main`. Mai segreti nella chat o nel repository.
- Controlli prima di consegnare: `npm run lint`, `npm run i18n`, `npm test`, `npm run ml:test` per la parte Python (e2e con
  `npm run e2e:*`; prettier solo su `src/**` e `test/**`, mai su `styles/` o `README.md`).

## Obiettivo

L'autore ha **circa 100 Murdoku stampati** (pagine di un libro: personaggi con indizi, mappa, pagina dei passaggi logici con la
soluzione) e vuole **una rete neurale che generi nuovi casi su richiesta** (dimensione, forma, difficoltà, tema, tipi di indizio,
colpevole). Il piano completo, approvato, è in `ml/README.md` (passi 1-6); la sintesi delle decisioni:

| Tema                       | Scelta                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foto                       | Una cartella per caso (`caso-NNN/` con personaggi, mappa, passaggi). L'autore ha le foto dei **primi 80 casi**                                                                        |
| Dove stanno i dati         | **Fuori dal repository** (cartella locale/Drive/Colab, variabile `MURDOKU_DATA`). Nel repository solo codice, in `ml/`. **Le foto sono pagine di un libro: non vanno mai committate** |
| Estensioni di app e solver | **Rimandate**: un caso con elementi non supportati è _messo da parte_ (`unsupported`), non si estende nulla finché non sono arrivate tutte le foto                                    |
| Lettura della mappa        | **Ibrida**: OpenCV per griglia e stanze, piccolo classificatore per gli oggetti, controllo col solver                                                                                 |
| Correzione                 | Pagina di correzione nell'app (foto accanto ai dati estratti, solver che dice se la soluzione è unica e uguale a quella stampata)                                                     |
| Modello                    | Piccolo e aperto (Qwen2.5 1,5-3B o Llama 3.2 3B), LoRA/QLoRA su Colab gratuito                                                                                                        |
| Dati                       | Sintetici (generatore dell'app, validati dal solver) + trasformazioni dei casi reali, poi rifinitura sui reali                                                                        |
| Passaggi logici            | La rete li scrive nello stile del libro; un controllo verifica che siano deduzioni valide per il solver                                                                               |
| Uscita                     | Caso `.murdoku.json` + pagina stampabile in stile libro                                                                                                                               |
| Successo                   | Tutti validi: si generano più candidati e si tengono solo quelli con soluzione unica e difficoltà richiesta (campionamento con scarto)                                                |
| Lingua                     | Solo italiano                                                                                                                                                                         |

## Cosa è già fatto

- **Passo 1 (unito)**: scheletro `ml/murdoku_ml/` (`validate.py`, `record.py`, `unsupported.py`), ponte di validazione
  `tools/ml-validate.mjs` (+ `tools/lib/ml-validate.mjs`), formato dei record (`FORMATO.md`), test (`npm run ml:test`) con un caso
  inventato (`ml/tests/fixtures/mini-unico.murdoku.json`).
- **Il giudice è il solver dell'app** (JavaScript, non si riscrive): dice se il caso ricostruito ha soluzione **unica** e se coincide con
  la **soluzione stampata**. Ricostruendo a mano i casi 1 e 2 la soluzione unica coincide con quella stampata, quindi la strada è
  sensata.
- Il **solver umano** (`src/solver/techniques/`) stima il livello di difficoltà ed è stato rafforzato per usare gli indizi generali
  («esattamente N persone accanto a un tavolo», «una donna era su un giaciglio»).
- Nell'ambiente cloud erano installati Tesseract (lingua `ita`) e OpenCV; in locale vanno installati (vedi `ml/README.md`).

## Cosa insegnano le foto già viste (casi 1, 2, 3, 4, 63, 75)

- Le **lettere** dei personaggi (A, B, C…) sono l'**ordine alfabetico dei nomi**; la **V** è la vittima. Non si leggono dai cerchietti.
- Le pagine delle soluzioni sono **ruotate di 90°**: si provano le 4 rotazioni e si tiene quella con più parole italiane riconosciute
  dall'OCR (ha scelto bene su tutte e 5 le pagine ruotate provate).
- Mappa: meglio leggerla dalla **pagina dei passaggi** (stampa pulita, con le pedine) che da quella con le matite. Le stanze si
  riconoscono dai **muri spessi**; gli oggetti si mappano così: quadrati scuri con le gambe = `table`, poltrone bianche = `chair`, il
  letto del libro occupa **due caselle** (due oggetti `bed`).
- Soluzione: posizioni dalle pedine e da «R/C» nel testo (due fonti che si controllano a vicenda).
- Elementi che l'app **non** rappresenta (codici in `ml/murdoku_ml/unsupported.py`): ruoli nascosti da scoprire, «non era accanto a
  un muro», «la colonna direttamente a est/ovest di lei era vuota», colonne con un oggetto, animali occupabili, griglie non quadrate.
  Quei casi vanno marcati `unsupported` con il motivo e restano fuori dal dataset; l'elenco dei motivi è la base per estendere app e
  solver **dopo** aver visto tutte le foto.

## Prossimo passo: lettore v1 (`ml/reader/`)

1. **Ingresso e pagine**: raggruppa per caso, raddrizza (4 rotazioni, OCR), riconosce il tipo di pagina (personaggi / mappa / passaggi).
2. **Pagina dei personaggi**: isola i fumetti (componenti connesse), OCR con Tesseract in italiano; grammatica degli indizi (frasi
   italiane → tipi e parametri dell'app, vedi `src/model/clueTypes.js`); frasi non riconosciute → il caso va in revisione o in
   `unsupported`.
3. **Mappa**: OpenCV (perimetro, griglia, muri spessi → stanze, etichette delle stanze, oggetti).
4. **Soluzione e passaggi**: pedine e testo, OCR della colonna dei passaggi.
5. **Controllo**: `murdoku_ml.validate` → stato `ok | incerto | scartato` con i motivi, salvato come record (`FORMATO.md`).
6. Test contro i **casi d'oro** (1 e 2 ricostruiti a mano, poi 3 e 4 se la mappa è chiara), tenuti nella cartella dei dati.

Dopo il lettore: pagina di correzione nell'app (`review.html`), formato testo + trasformazioni + sintetico, addestramento di prova,
generazione con scarto e pagina stampabile (passi 3-6 di `ml/README.md`).

## Come avviare una sessione sul computer

1. Aprire la cartella con le foto come cartella di lavoro **oppure** dentro il clone del repository e impostare
   `MURDOKU_DATA` sulla cartella dei dati (record e foto, fuori dal repository).
2. Leggere questo file, `ml/README.md`, `ml/FORMATO.md`.
3. Provare che l'ambiente funzioni: `pip install -r ml/requirements.txt`, Tesseract con la lingua italiana, Node per il giudice,
   `npm run ml:test`.
4. Cominciare dal lettore sui primi casi e confrontare con i casi d'oro; riferire quanti casi vengono `ok`, `incerto`, `scartato`.

## Sessione sul computer dell'autore (24 novembre 2026): cosa è cambiato

**Attenzione — le foto di questa cartella sono di un altro volume.** `MURDOKU_DATA` (cartella `Murdoku2`) contiene **235 foto** di un
libro con **80 casi a capitoli storici** (Medioevo, Far West, Preistoria, Antico Egitto), non dei casi moderni citati sopra («Casa vacanze»
= caso 2, «Al circo» = caso 75…). Quei casi d'oro, e i codici di `unsupported.py` che ne vengono, **non** corrispondono a questo volume:
qui il caso 2 è «Agguato dei briganti» e il 75 «Ad Alessandria». **Non esistono ancora casi d'oro per questo volume.** Ogni capitolo ha
regole proprie (es. «Nobile / Villico / Cavaliere» nel Medioevo, «mansioni» nella Preistoria): l'app non le rappresenta.

Com'è fatta la cartella: piatta (nessun `caso-NNN/`), foto col telefono (prospettiva, pagina curva, dita), nome `AAAAMMGG_HHMMSS.jpg`.
In ordine di scatto: 5 pagine di prefazione/regole, poi **per ogni caso due pagine, personaggi e mappa**, poi le **pagine dei passaggi**
(due casi per pagina, foto 167-234). Le stesse pagine sono spesso riprese due volte a pochi secondi (due scatti a ≤ 8 s = una pagina).
Le foto sono già dritte (EXIF), la rotazione di 90° vista nell'altro volume qui non serve.

**Secondo volume (`Murdoku1`, casi 1-80 moderni)**: 200 foto = 80 pagine di personaggi + 80 di mappa (si alternano, la mappa ha la griglia
vuota con la soluzione a penna) + **40 pagine di passaggi in fondo, una foto per pagina, due casi per foto** (4 casi = una doppia pagina =
2 foto; l'ordine dei casi nel libro è quello delle foto: la foto _k_ ha i casi 2k+1 e 2k+2). Qui la soluzione è **stampata sulla mappa** con le
pedine, senza «R3 C2» nel testo: i passi dicono «Questo isola …», «in riga 7, colonna 9» e finiscono con «X è l'assassino!». Il riconoscitore
(`pages.looks_like_passaggi`) li riconosce da quel «isola» (≥ 3, o ≥ 2 con «assassino»): prima 16 di queste pagine erano scambiate per
personaggi (0 «R C» nel testo) e sfasavano l'abbinamento. I due titoli per pagina sono in grassetto sans-serif («13. Nella vecchia locanda»):
si leggono come righe che cominciano con un numero e sono più alte (≥ 1,35×) della riga mediana (`pages._bold_titles`), e servono da ancora
nell'assegnazione per sequenza (`inventory.assign_passaggi`). Risultato: 80 P, 80 M, 40 S, ogni caso con la sua foto dei passaggi.

**Lettore sul secondo volume — primo giro (`python -m reader.batch 1-80`, 80 casi, nessuno `ok`)**: 45 griglie schematiche lette (ma con misure
poco credibili: 3×7, 10×11…; 35 non trovate, perché lo schema per le matite qui è una tessera chiara, spesso con scritte a matita), 20 assassini
su 80, 3 casi con tutte le posizioni, 3 con tutte le schede capite, 0 con soluzione unica. Cosa è stato sistemato e cosa blocca ancora:

- _Fatto_: taglio dei due casi per pagina dai titoli in grassetto; assassina al femminile; la cornice della mappa si cerca con più estensioni
  (l'affine dalle etichette sovrastima la larghezza con la prospettiva; sul caso 13 le pedine giuste vanno da 3/8 a 7/8); colori delle
  pedine **per volume** (`lavoro/pawn_colors.json`; quelli del primo volume peggioravano la lettura qui) con `autolearn`, ma servono ≥ 3 pedine
  sicure per lettera e il primo giro ne ha date poche (A, B): conviene rifarlo dopo aver sistemato le etichette.
- _Secondo giro_ (cornice senza etichette + dimensione dal passo delle linee, `solution.rough_frame` / `estimate_size`): le posizioni delle
  pedine passano da 3 a **27 casi completi** (55 casi con almeno 4 pedine; 54 casi hanno usato la cornice); assassino 19 su 80 (invariato:
  la riga «… è l'assassino!» non si legge in 42 pagine), soluzioni uniche ancora 0 (mancano tipi di oggetto e lettere delle schede). La dimensione
  stimata è giusta in 4 mappe su 5 provate; le righe vicino al bordo alto e basso a volte slittano di uno (pagina inclinata).
- _Blocca 1, etichette R/C_ (superato in parte dal secondo giro): in 60 casi su 80 le etichette sono troppo poche (piccole, grigie, a volte coperte): senza reticolo non si leggono
  le pedine. Strada provata: la cornice scura della mappa (componente connessa del nero, `minAreaRect`) si trova bene (4 pagine su 6 provate) e
  non ha bisogno di etichette; resta da ricavare righe e colonne dal passo delle linee sottili della mappa raddrizzata.
- _Nomi e lettere_ (`reader/names.py`, `names_it.txt`): i nomi in corsivo si leggono ritagliandoli stretti attorno all'inchiostro (soglie 80-155
  per i nomi chiari) con più preparazioni, e si confrontano con un elenco di nomi italiani più quelli citati nelle frasi; senza un nome somigliante
  (≥ 0,72) la lettura resta grezza e **non** si usa. Le lettere vengono dall'ordine alfabetico solo se TUTTI i nomi del caso sono letti con sicurezza
  (`Card.by_name`, `draft["letters_by_name"]`); altrimenti restano quelle dell'ordine di lettura e la pagina di correzione lo segnala in arancione.
  Il corsivo pallido e la «A» maiuscola (letta «q») restano i punti deboli. La pagina di
  correzione ha il pulsante «Ordina le lettere per nome»: si correggono i pochi nomi sbagliati sulla foto e un clic rimette A, B, C… in ordine
  (cancella le posizioni già lette, che usavano le vecchie lettere). La vittima non ha il nome con la V: è la scheda «La vittima».
- _Blocca 2, schede_ (vedi sopra per la parte nomi): le polaroid non sono in ordine alfabetico sulla pagina (3 colonne a zig-zag, ma cambia da caso a caso) e i nomi sono in
  corsivo, illeggibili: l'ordine di lettura dà le lettere sbagliate (caso 3: «Era in Cucina» è B, ma viene letta C). Serve leggere l'iniziale del
  nome, o far digitare i nomi nella pagina di correzione.
- _Blocca 3, tipi di oggetto_: la tessera schematica qui non ha le caselle grigie né i rettangoli arrotondati; gli oggetti stanno solo
  nell'illustrazione, e finché non c'è il classificatore nessun caso può diventare `ok` (frasi come «accanto alla TV» non si risolvono).

Cosa c'è in `ml/reader/` (lancio: dalla cartella `ml/`, con `MURDOKU_DATA` impostata):

| Modulo                                        | Stato                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory.py` (`python -m reader.inventory`) | **Funziona.** OCR del titolo + parole italiane per distinguere personaggi/mappa/passaggi, Viterbi per l'alternazione, riprese doppie. Abbina **80 casi, ognuno con personaggi e mappa**; numeri coerenti coi titoli fino al caso 47, un possibile sfasamento di 1 intorno al 61-62 da controllare. **I passaggi sono abbinati** (nel primo volume solo in parte: titoli piccoli, tagliati dalle dita; nel secondo per intero).                                               |
| `schematic.py`                                | **Prototipo.** Legge la **griglia schematica per le matite** (in basso a sinistra nella pagina della mappa): stampa pulita, molto più robusta dell'illustrazione. Reticolo, caselle dentro/fuori e caselle **bloccate** (grigie) corretti sulle 8 mappe guardate (caso 1 controllato cella per cella: 0 errori). **Muri/stanze solo in parte** (corretto sul caso 1; le stanze sono 1 su metà delle mappe). **Rettangoli arrotondati (oggetti occupabili) poco affidabili.** |
| `characters.py`                               | **Insufficiente.** Con l'OCR a pagina intera si legge circa metà delle schede (gli sfondi colorati abbassano il contrasto; il nome gotico è illeggibile). Serve **ritagliare ogni scheda** e fare l'OCR sul ritaglio.                                                                                                                                                                                                                                                        |
| `grammar.py`                                  | **Funziona sulle frasi pulite** (12 test): accanto a (anche «a un muro»), nord/sud/est/ovest di, riga/colonna, stanza, seduto su…, «l'unica persona (seduta su…, accanto a…, un'altra condizione)», «o», negazioni, «e» fra due predicati. Quel che non conosce va in `unknown`/`unsupported`, mai indovinato.                                                                                                                                                                                                                                                    |
| `pipeline.py`                                 | Mette insieme le fasi e scrive i record. Per ora **non ricostruisce nessun caso** (`puzzle` nullo ⇒ `scartato`, con i motivi).                                                                                                                                                                                                                                                                                                                                               |
| `debug.py`                                    | Immagini di controllo in `lavoro/debug/`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Perché oggi nessun caso arriva a `incerto`/`ok`: mancano (1) il **tipo degli oggetti** (serve il classificatore sull'illustrazione: la
griglia schematica dice _dove_ sono gli oggetti, non _che cosa_), (2) la **soluzione stampata**, (3) schede dei personaggi lette per intero.

Cose imparate sul codice che vale la pena sapere:

- Le linee della griglia sono **curve** (pagina del libro): il reticolo costruito dalle rette di Hough è sfasato di 10-30 px nelle caselle
  lontane dal centro. Quindi non campionare in posizioni fisse: cercare in finestre larghe o per forma (coppie di avvallamenti).
- In Hough di OpenCV 5 le linee arrivano **in ordine di voti**: tenere la più votata di ogni gruppo, non la prima per posizione (errore di
  10 px sulle linee spesse). C'è un test con una griglia sintetica (`tests/test_schematic.py`).
- Ambiente Windows: venv fuori dal repository (`murdoku-ml-venv`, perché l'Anaconda ha un conflitto numpy/pandas), Node in
  `C:\Program Files\nodejs` (non nel PATH di Git Bash), Tesseract 5.4 con `ita` in `C:\Program Files\Tesseract-OCR`.
  `npm run ml:test` usa `python3`, che su Windows può non esistere: `python -m pytest ml -q`.

## Prossimo passo (aggiornato)

1. **Schede dei personaggi** (v1 fatta, recall ancora basso). Pipeline in `reader/characters.py`: foto binarizzata (soglia adattiva),
   attacchi di frase («Era», «Non era», «Uno tra», «La vittima») trovati per righe-blob + OCR di pagina, frase intera riletta in una fascia
   attorno all'attacco (psm 6). Sui casi 1-20: 2-9 schede lette per pagina, ma **meno della metà delle frasi capite per intero**.
   Cause misurate: (a) schede perse (la vittima in grassetto quasi mai; schede con attacco non trovato), (b) righe troncate o rumorose,
   (c) **la grammatica non copre il volume**: «l'unica persona su un tappeto», «esattamente una colonna a est di», «sulla stessa
   diagonale», «nella sua area», «sul bordo della griglia», animali («cavallo», «cinghiale», «maiale»), «A o B» fra stanze,
   «Uno tra lui e Bella…». Molti sono tipi di indizio che l'app non ha (⇒ `unsupported`). I nomi in gotico **non** sono letti
   (1 su 8): servono solo come etichetta, i riferimenti nelle frasi si risolvono dall'iniziale (A, B, C… alfabetico).
2. **Muri e oggetti occupabili** sulla griglia schematica: alzare il recall dei muri (misurare la larghezza del solco su più punti, non
   solo nel mezzo) e dei rettangoli arrotondati; aggiungere un controllo contro il numero di etichette di stanza dell'illustrazione.
3. **Tipo degli oggetti**: classificatore sull'illustrazione, nelle caselle già individuate dalla griglia schematica.
4. **Passaggi**: abbinamento per sequenza (le pagine sono in ordine, due casi per pagina) e lettura del colpevole («X è l'assassino») e delle posizioni.
5. Costruire **casi d'oro per questo volume** (2-3 casi ricostruiti a mano) prima di fidarsi di una percentuale.

## Pagina di correzione (`python -m reader.review`)

Strumento locale per correggere a mano quello che il lettore sbaglia, con la foto accanto e il solver come giudice. Solo libreria
standard (server su 127.0.0.1), nessun dato nel repository.

- `reader/draft.py`: la **bozza** (`lavoro/bozze/NNN.json`) = griglia (caselle dentro/fuori/bloccate, stanza, oggetto), stanze, schede
  (lettera, nome, frase, vittima), soluzione stampata (righe/colonne da **1**, come nel libro), codici non supportati. `assemble` la
  trasforma nel caso dell'app (frasi → indizi con la grammatica, nomi/stanze/oggetti risolti in id), `check` la fa giudicare dal solver,
  `accept` scrive `lavoro/record/NNN.record.json`: `verificato` solo se il solver dice «unica e uguale alla stampata» e non ci sono
  problemi né elementi non supportati (= **caso d'oro**), altrimenti `incerto`.
- `reader/review.py` + `review.html`: foto a sinistra (zoom, riquadri A/B/C sulle schede lette), a destra Schede / Mappa / Soluzione
  stampata / Esito. Salvataggio automatico; «Rileggi dalle foto» rifà la bozza da zero.
- Porte e finestre si segnano a mano sui bordi delle caselle (strumenti «porta» e «finestra» della tab Mappa: `edges` della bozza, `{type, row, col, side}` da 0, scritti come nell'app; la lettura automatica non le trova ancora).
- Una frase che la grammatica non capisce si può **comporre col menu** («+ indizio con il menu» sotto la scheda): si sceglie il tipo di indizio (l'elenco e i parametri vengono dall'app: `tools/ml-catalog.mjs`, quindi serve Node) e un controllo per ogni parte (persone della bozza, oggetti, stanze, direzione…), con «no (il contrario)». L'indizio sta nella scheda (`extra`: `{type, negate, params}` con bersagli simbolici `{name|object|room}`), si somma a quelli letti dalla frase e non porta parole del libro; il pezzo di frase non capito si segna «fatto col menu» (`covered`). Ci sono anche tutte le proprietà di una persona (accanto a…, uomo, donna, seduto…, **un'altra condizione**; il bersaglio, l'oggetto o la condizione compaiono solo quando servono: «un'altra condizione» apre un secondo menu con un indizio intero, `customClue`, anche con «no») e, in fondo alla tab Schede, gli **indizi generali** (`general` della bozza: fatti sulla scena senza personaggio, come «nessuno è nella stanza X» o «esattamente due persone accanto a un tavolo»). Non ci sono i tipi che dipendono dal caso (ruoli, luoghi da identificare) né l'«O»: restano da scrivere nella frase o nella grammatica personale.
- Limiti noti: il genere dei personaggi resta vuoto; le icone dei personaggi sono
  tutte la stessa (non influiscono sul solver). Il letto di due caselle si segna come «Letto» su entrambe.

### Lettura di assassino e posizioni (`reader/solution.py`)

La pagina dei passaggi (due casi per pagina, i dispari sopra) dà **assassino** («Dionigi è l'assassino!», nome in carattere normale) e le
**posizioni finali** (pedine con la lettera in bianco sulla mappa illustrata, righe «R1…» e colonne «C1…» ai bordi). Il lettore:
trova i due blocchi (intestazione «L'assassino è…» o riga finale), legge il nome e lo traduce nella lettera (ordine alfabetico dei nomi),
legge le etichette R/C (più letture; le mancanti si cercano dove devono stare), ricava un reticolo affine (incrocio fra la riga di «R1» e
la colonna di «C1», senza ipotesi sulle distanze) e riporta su di esso il centro di ogni lettera trovata (soglia locale, 6 letture OCR per
candidato, una pedina per lettera). Si avvia dalla pagina di correzione (scheda «Soluzione stampata», ~1 minuto per caso: non è
nell'apertura automatica) e **sostituisce** assassino e posizioni della bozza. Le posizioni si correggono **piazzando le pedine sulla mappa** (non si
scrivono più riga e colonna): si sceglie il personaggio nell'elenco o toccando la sua pedina, si tocca la casella; una pedina sulla stessa
riga o colonna di un'altra è rossa, «togli» la leva dalla mappa.

- **Tre aiuti oltre alla lettera** (tutti segnati sulla pagina di correzione):
  1. _Colore_: ogni lettera ha la sua pedina colorata (la B è verde, la C azzurra, la G arancione…, in tutto il libro). `reader/pawn_colors.json`
     tiene il colore tipico (HSV) di ogni lettera, imparato da casi con posizioni note: `python -m reader.solution learn 1 "3:A=1,8;B=4,7;…"`
     (senza testo prende le posizioni dalla bozza). Il colore si somma ai voti dell'OCR: conferma la lettera, e ne smentisce una letta sulla
     pedina sbagliata. Permette di accettare anche lettere lette male (conf. bassa → ⚠). Limiti: A e V sono entrambe rosse (si distinguono solo
     per la lettera); la luce cambia da foto a foto, quindi i prototipi migliorano aggiungendo casi.
  2. _Testo dei passaggi_: le caselle scritte nei passi («in R4 C4») si leggono insieme al nome dell'assassino; una pedina dubbia (conf. < 60 o
     lontana dal centro) a meno di una casella da una casella citata e libera si sposta lì (`via: "testo"`). Le caselle citate sono a volte
     ipotesi («R4 C7 o R5 C1»), per questo vale solo per le pedine già dubbie.
  3. _Solver arbitro_: pulsante «Risolvi i dubbi col solver» (`draft.refine_with_solver`, `/api/refine`). Se il caso come scritto nella bozza ha
     **una sola soluzione**, le pedine dubbie vengono portate sulla casella che il solver indica, se è a meno di una casella dalla posizione
     fotografata (`via: "solver"`). Le pedine sicure non si toccano e, se contraddicono il solver, lo dice (o la lettura o gli indizi sono
     sbagliati). Il verdetto non diventa `ok` finché restano posizioni scelte dal solver: non può confermare sé stesso.
     Le pedine fuori dalla griglia (parti di illustrazione, scritte) si scartano prima dell'OCR.
- **Etichette R/C** (`find_labels`): le mappe stanno in posti diversi da una pagina all'altra (e il testo cita «R4 C7»), quindi non si cerca
  più in un rettangolo fisso. Si legge tutto il blocco del caso a due scale e fra le etichette si cercano _catene_: numeri crescenti su una
  retta con passo costante (le «R» in verticale, le «C» in orizzontale; RANSAC sulle coppie), che stiano insieme (le «C» a destra e sotto
  la prima «R», passo simile). Una catena solida (≥3) batte due catene corte coincidenti per caso; se una sola catena è solida, l'altra si
  cerca in una striscia mirata (sotto l'ultima riga, o a sinistra della prima colonna): la lettura che ne trova di più è la binarizzazione
  adattiva (testo nero su bianco), poi contrasto e elenco di caratteri ammessi. La striscia può scendere oltre il taglio fra i due casi
  (`find_blocks` ricade a metà pagina quando non legge le righe «… è l'assassino/a!», e la mappa del caso di sopra può finire sotto). Dalle etichette
  si ricava anche il rettangolo della mappa (`Lattice.map_box`) per cercare pedine e cornice. Misurato sui 59 fogli di passaggi (118 blocchi): prima 2 blocchi su 10 nelle prime pagine
  provate; sull'insieme, 56 blocchi con ≥3 etichette R e ≥3 C (+5 deboli, 57 senza); su 29 blocchi con R ma senza C una seconda passata
  (strisce con binarizzazione adattiva e taglio più generoso) ne ha recuperati 13 (stima ≈ 69/118, non rimisurata su tutto). I restanti: mappa
  tagliata dal bordo della foto (casi 4 e altri 3), dita o ombra sulle etichette, pagina senza secondo caso. Se la mappa è tagliata dalla foto (caso 4:
  si vedono R1-R6 e nessuna «C») lo dice: «rifotografa la pagina».
- **Reticolo per le pagine curve** (`fit_frame`, `FrameLattice`): oltre al reticolo affine dalle etichette, si cercano i quattro lati della
  cornice scura della mappa (linee scure sottili, «blackhat»; per ogni lato l'angolo e lo scostamento con più pixel in una striscia attorno
  al lato predetto) e se ne ricava un'omografia casella↔pixel. Si usa solo se i quattro lati si trovano, la forma è convessa, gli angoli
  non sono a più di ~2 caselle da quelli predetti e le etichette R/C tornano (mediana entro mezza casella); altrimenti resta l'affine.
  Il caso (`lattice`) è registrato in `solution_source` della bozza («cornice» o «affine»).
- Misurato (con i colori di casi 1 e 3: per questi due la prova non è indipendente): caso 1 perfetto (assassino e 6 posizioni); caso 3 assassino
  e 8 pedine su 8 giuste (prima: 4 su 7, una sbagliata; la A resta a bassa confidenza), con la cornice il margine medio dal centro casella
  scende da 0.20 a 0.10. **Caso 2 (pagina curva, il caso che l'affine sbagliava)**: con la cornice C, V, A, D, E cadono nelle caselle giuste
  (R2 C6, R8 C7, R4 C4, R1 C2, R3 C3; prima C, V e A erano una riga/colonna fuori); restano la F (presa per un altro oggetto, conf. 18, segnata ⚠)
  e la B (non trovata): sono errori di riconoscimento della pedina, non del reticolo.
  I dubbi (pedina non trovata, lettera poco sicura, etichette poche) sono nei «problemi» e con un ⚠ accanto alla riga.
- Se i nomi scritti nelle schede non sono in ordine alfabetico, lo segnala: o i nomi o le lettere sono sbagliati.
- Da fare: più casi per i colori (anche per misurare fuori campione), pedine coperte o tagliate (B del caso 2), altre pagine curve da provare.

## Rotazione delle pagine (OSD) e batch del 24 novembre sera

- `pages.osd_rotation` usa l'OSD di Tesseract (`--psm 0`): se la confidenza è ≥ 8 decide lui la rotazione (12-24 sulle pagine di testo e di schede,
  < 2 sulle mappe, dove non ci si fida). Il vecchio conteggio di parole italiane con psm 3 sbagliava: psm 3 legge bene anche il testo di traverso e dà
  punteggi simili in due rotazioni. Su Murdoku1 corregge le 12 pagine di personaggi che non davano schede (casi 11, 13, 17, 19, 21, 36, 38, 43, 45, 46, 49, 52)
  e 4 pagine di passaggi di traverso (8 casi); i numeri di titolo coerenti con la sequenza salgono da 45 a 55. Se si cambia il criterio va cancellata
  `lavoro/pagine/*.json` e rilanciato l'inventario.
- Batch su 80 casi di Murdoku1 (nessun caso `ok`: manca il classificatore dei tipi di oggetto): griglie 45, assassino letto 25 (era 19), posizioni complete 39 (era 27),
  schede tutte capite 3, lettere dai nomi 20 su 80 (erano 18), nessun caso senza schede (erano 12).
- `python -m reader.review --dati Murdoku1 8766` (e `reader.batch --dati …`) usa un altro volume solo per quel comando, senza cambiare `MURDOKU_DATA`.
- Il lettore ora conosce cavallo («in sella a»), mucca, cinghiale, tigre, albero, vaso, fuoco, ossa, pozza di fango e «un animale» (`objtype:#animal`): il codice
  `animals` resta solo per leone e pecora.
- Passo 4 dell'app (Pirati): il lettore conosce gli oggetti del mare (zattera, amaca, sabbia, cannone, cassa, maiale, squalo, masso, corda, barile) e le frasi «in mare», «a terra» (= «in mare» negato) e «su una nave» (`inSea`, `onShip`); il pappagallo è il codice `parrot` (non supportato finché non si vede una pagina d'esempio). L'app sa anche i luoghi da identificare («???»: `zone.nameHidden`, indizio `inPlaceNamed`) ma il lettore non li legge: la frase del libro che nomina un'isola non è ancora stata vista, e i nomi di quelle stanze vanno inseriti a mano in revisione.
- Passo 3 dell'app (ruoli nascosti, `src/model/roles.js`): l'app sa rappresentare nobili/villici/cavalieri, fuorilegge e mansioni (`puzzle.roles`, `zone.kind: "noble"`, `cell.roleCell`, `solution.roles`) e ha i tre indizi `hasRole`, `roleDirection`, `roleAllInRoom`. Il lettore non li legge ancora (il codice `hidden_roles` resta): servono i nomi dei ruoli dalle pagine di regole di ogni capitolo, i conteggi dichiarati e le caselle riservate dalla mappa.
