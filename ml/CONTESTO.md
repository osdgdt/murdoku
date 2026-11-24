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

| Tema | Scelta |
|---|---|
| Foto | Una cartella per caso (`caso-NNN/` con personaggi, mappa, passaggi). L'autore ha le foto dei **primi 80 casi** |
| Dove stanno i dati | **Fuori dal repository** (cartella locale/Drive/Colab, variabile `MURDOKU_DATA`). Nel repository solo codice, in `ml/`. **Le foto sono pagine di un libro: non vanno mai committate** |
| Estensioni di app e solver | **Rimandate**: un caso con elementi non supportati è *messo da parte* (`unsupported`), non si estende nulla finché non sono arrivate tutte le foto |
| Lettura della mappa | **Ibrida**: OpenCV per griglia e stanze, piccolo classificatore per gli oggetti, controllo col solver |
| Correzione | Pagina di correzione nell'app (foto accanto ai dati estratti, solver che dice se la soluzione è unica e uguale a quella stampata) |
| Modello | Piccolo e aperto (Qwen2.5 1,5-3B o Llama 3.2 3B), LoRA/QLoRA su Colab gratuito |
| Dati | Sintetici (generatore dell'app, validati dal solver) + trasformazioni dei casi reali, poi rifinitura sui reali |
| Passaggi logici | La rete li scrive nello stile del libro; un controllo verifica che siano deduzioni valide per il solver |
| Uscita | Caso `.murdoku.json` + pagina stampabile in stile libro |
| Successo | Tutti validi: si generano più candidati e si tengono solo quelli con soluzione unica e difficoltà richiesta (campionamento con scarto) |
| Lingua | Solo italiano |

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
